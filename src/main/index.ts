import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  ipcMain,
  nativeImage,
  screen,
  Tray,
  Menu,
  dialog
} from "electron";
import * as path from "node:path";

const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3");

type ClipKind = "text" | "image";

type ClipItem = {
  id: string;
  kind: ClipKind;
  text?: string;
  imageDataUrl?: string;
  imageName?: string;
  color?: string;
  createdAt: number;
  pinned: 0 | 1;
  tags: string[];
  borderColor?: string;
bgColor?: string;
};

type Settings = { popupShortcut: string };

type Theme = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  danger: string;
  accent: string;
};

type Lang = "en" | "km";

const DEFAULT_THEME: Theme = {
  bg: "#0f1115",
  panel: "#151922",
  border: "rgba(255, 255, 255, 0.12)",
  text: "rgba(235, 242, 251, 0.95)",
  muted: "rgba(160, 175, 195, 0.9)",
  danger: "#ff5a5a",
  accent: "#5aa0ff"
};

let win: BrowserWindow | null = null;
let tray: Tray | null = null;

let db!: import("better-sqlite3").Database;

// ---------- Single instance lock ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) showPopupNearCursor();
  });
}

// ---------- Paths ----------
function userDataPath(...p: string[]) {
  return path.join(app.getPath("userData"), ...p);
}

function getResourcePath(...p: string[]) {
  // Packaged resources live under process.resourcesPath
  return app.isPackaged
    ? path.join(process.resourcesPath, ...p)
    : path.join(app.getAppPath(), ...p);
}

// ---------- JSON helper ----------
function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// ---------- DB migrations ----------
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(ddl);
}

function dbInit() {
  const dbFile = userDataPath("clipvault.sqlite");
  db = new BetterSqlite3(dbFile);

  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      text TEXT,
      imageDataUrl TEXT,
      createdAt INTEGER NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      tagsJson TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migrations
  ensureColumn("clips", "imageName", `ALTER TABLE clips ADD COLUMN imageName TEXT;`);
  ensureColumn("clips", "color", `ALTER TABLE clips ADD COLUMN color TEXT;`);
  ensureColumn("clips", "borderColor", `ALTER TABLE clips ADD COLUMN borderColor TEXT;`);
ensureColumn("clips", "bgColor", `ALTER TABLE clips ADD COLUMN bgColor TEXT;`);

  // Defaults
  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get("popupShortcut")) {
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(
      "popupShortcut",
      "CommandOrControl+Shift+V"
    );
  }

  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get("theme")) {
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run(
      "theme",
      JSON.stringify(DEFAULT_THEME)
    );
  }

  if (!db.prepare("SELECT 1 FROM settings WHERE key=?").get("lang")) {
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").run("lang", "en");
  }
}

// ---------- Theme / Settings ----------
function getSettings(): Settings {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get("popupShortcut") as
    | { value: string }
    | undefined;
  return { popupShortcut: r?.value ?? "CommandOrControl+Shift+V" };
}

function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

function getTheme(): Theme {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get("theme") as
    | { value: string }
    | undefined;
  const parsed = r?.value ? safeJson<Theme>(r.value, DEFAULT_THEME) : DEFAULT_THEME;
  return { ...DEFAULT_THEME, ...parsed };
}

function setTheme(theme: Theme) {
  setSetting("theme", JSON.stringify({ ...DEFAULT_THEME, ...theme }));
}

function getLang(): Lang {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get("lang") as
    | { value: string }
    | undefined;
  const v = (r?.value ?? "en") as Lang;
  return v === "km" ? "km" : "en";
}

function setLang(lang: Lang) {
  setSetting("lang", lang);
}

// ---------- Clip helpers ----------
function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultImageName() {
  const d = new Date();
  return `Image-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(
    d.getHours()
  )}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}.png`;
}

function tryGetClipboardFileName(): string | undefined {
  try {
    // macOS: file URL UTI
    const buf = clipboard.readBuffer("public.file-url");
    if (!buf?.length) return undefined;

    const s = buf.toString("utf8").trim();
    const first = s.split("\n")[0].trim();
    const decoded = decodeURIComponent(first.replace(/^file:\/\//, ""));
    const base = path.basename(decoded);
    return base || undefined;
  } catch {
    return undefined;
  }
}

function rowToClip(r: any) {
  return {
    id: r.id,
    kind: r.kind,
    text: r.text ?? undefined,
    imageDataUrl: r.imageDataUrl ?? undefined,
    imageName: r.imageName ?? undefined,
    borderColor: r.borderColor ?? undefined,
    bgColor: r.bgColor ?? undefined,
    createdAt: r.createdAt,
    pinned: r.pinned,
    tags: safeJson(r.tagsJson, [])
  };
}

function insertClip(item: Omit<ClipItem, "id" | "createdAt" | "pinned" | "tags">) {
  const id = nowId();
  const createdAt = Date.now();

  if (item.kind === "text") {
    const text = (item.text ?? "").trim();
    if (!text) return;

    const existing = db
      .prepare("SELECT id FROM clips WHERE kind='text' AND text=?")
      .get(text) as { id: string } | undefined;
    if (existing?.id) db.prepare("DELETE FROM clips WHERE id=?").run(existing.id);

    db.prepare(
      `INSERT INTO clips(id, kind, text, imageDataUrl, imageName, color, createdAt, pinned, tagsJson)
       VALUES(?, 'text', ?, NULL, NULL, NULL, ?, 0, '[]')`
    ).run(id, text, createdAt);

    return;
  }

  const dataUrl = item.imageDataUrl ?? "";
  if (!dataUrl.startsWith("data:image/png;base64,")) return;
  if (dataUrl.length < 2000) return;

  const imageName = (item.imageName ?? "").trim() || defaultImageName();

  // cheap de-dup in last 30 images
  const sig = dataUrl.slice(0, 100) + ":" + dataUrl.length;
  const existing = db
    .prepare("SELECT id, imageDataUrl FROM clips WHERE kind='image' ORDER BY createdAt DESC LIMIT 30")
    .all() as { id: string; imageDataUrl: string }[];

  for (const e of existing) {
    const esig = (e.imageDataUrl?.slice(0, 100) ?? "") + ":" + (e.imageDataUrl?.length ?? 0);
    if (esig === sig) {
      db.prepare("DELETE FROM clips WHERE id=?").run(e.id);
      break;
    }
  }

  db.prepare(
    `INSERT INTO clips(id, kind, text, imageDataUrl, imageName, color, createdAt, pinned, tagsJson)
     VALUES(?, 'image', NULL, ?, ?, NULL, ?, 0, '[]')`
  ).run(id, dataUrl, imageName, createdAt);
}

function getHistory(query: string): ClipItem[] {
  const q = (query ?? "").trim().toLowerCase();

  const rows = db.prepare("SELECT * FROM clips ORDER BY pinned DESC, createdAt DESC LIMIT 300").all();
  const items = rows.map(rowToClip);

  if (!q) return items;

  return items.filter((it: ClipItem) => {
    const tags = (it.tags ?? []).join(",").toLowerCase();
    const text = (it.text ?? "").toLowerCase();
    const name = (it.imageName ?? "").toLowerCase();

    // "image" filter
    if (q === "image") return it.kind === "image";

    return text.includes(q) || tags.includes(q) || name.includes(q);
  });
}

// ---------- Window / tray ----------
function createWindow() {
  win = new BrowserWindow({
    width: 560,
    height: 620,
    show: !app.isPackaged,
    frame: false,
    transparent: false,
    backgroundColor: "#0f1115",
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = "http://localhost:5173";
  const prodHtml = path.join(app.getAppPath(), "dist/renderer/index.html");

  if (!app.isPackaged) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(prodHtml);
  }

  win.on("blur", () => {
    if (!app.isPackaged) return;
    win?.hide();
  });
}

function showPopupNearCursor() {
  if (!win) return;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;

  const w = 560;
  const h = 620;

  const px = Math.min(Math.max(cursor.x - Math.floor(w / 2), x), x + width - w);
  const py = Math.min(Math.max(cursor.y - Math.floor(h / 3), y), y + height - h);

  win.setBounds({ x: px, y: py, width: w, height: h }, false);
  win.show();
  win.focus();
  win.webContents.send("popup-opened");
}

function createTray() {
  const trayIconPath = getResourcePath("trayTemplate.png");
  tray = new Tray(trayIconPath);

  tray.setToolTip("Quantum Clipboard");

  const menu = Menu.buildFromTemplate([
    { label: "Open Quantum Clipboard", click: () => showPopupNearCursor() },
    { type: "separator" },
    { label: `Version ${app.getVersion()}`, enabled: false },
    {
      label: "Check for Updates…",
      click: async () => {
        dialog.showMessageBox({
          type: "info",
          title: "Updates",
          message: "Auto-update is not configured yet.",
          detail: "Publish a new release to update the Homebrew cask."
        });
      }
    },
    { type: "separator" },
    { label: "Quit", role: "quit" }
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => showPopupNearCursor());
}

// ---------- Shortcut (robust) ----------
function normalizeAccelerator(raw: string) {
  return (raw || "").trim().replace(/\s+/g, "").replace(/^\+|\+$/g, "");
}

function setGlobalShortcut(accelRaw: string) {
  const accel = normalizeAccelerator(accelRaw);
  if (!accel) return { ok: false as const, reason: "Empty shortcut" };

  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(accel, () => showPopupNearCursor());
  if (!ok) return { ok: false as const, reason: "Invalid or already in use" };

  return { ok: true as const };
}

// ---------- Clipboard polling ----------
let lastText = "";
let lastImageSig = "";
let lastSeenTick = 0;

function sigFromImage(img: Electron.NativeImage) {
  const png = img.toPNG();
  if (!png.length) return "";
  return png.subarray(0, Math.min(64, png.length)).toString("hex") + ":" + png.length;
}

function pollClipboard() {
  setInterval(() => {
    const tick = Date.now();
    if (tick - lastSeenTick < 200) return;
    lastSeenTick = tick;

    // Text first
    const text = clipboard.readText();
    const trimmed = text.trim();
    if (trimmed && trimmed !== lastText) {
      lastText = trimmed;
      insertClip({ kind: "text", text: trimmed });
      win?.webContents.send("history-updated");
      return;
    }

    // Image second
    const img = clipboard.readImage();
    if (img.isEmpty()) return;

    const png = img.toPNG();
    if (png.length < 8192) return; // ignore tiny ghost icons

    const sig = sigFromImage(img);
    if (!sig || sig === lastImageSig) return;
    lastImageSig = sig;

    const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
    const fileName = tryGetClipboardFileName() ?? defaultImageName();

    insertClip({ kind: "image", imageDataUrl: dataUrl, imageName: fileName });
    win?.webContents.send("history-updated");
  }, 450);
}

// ---------- IPC ----------
function setupIPC() {
  ipcMain.handle("get-history", async (_e, payload: { query: string }) => {
    return getHistory(payload?.query ?? "");
  });

  ipcMain.handle(
    "set-clipboard",
    async (_e, payload: { kind: ClipKind; text?: string; imageDataUrl?: string }) => {
      try {
        if (payload.kind === "text") {
          clipboard.writeText(payload.text ?? "");
          return true;
        }

        const d = payload.imageDataUrl ?? "";
        if (!d.startsWith("data:image/")) return false;

        const img = nativeImage.createFromDataURL(d);
        if (img.isEmpty()) return false;

        clipboard.writeImage(img);
        return true;
      } catch {
        return false;
      }
    }
  );

  ipcMain.handle("delete-clip", async (_e, id: string) => {
    db.prepare("DELETE FROM clips WHERE id=?").run(id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("clear-all", async () => {
    db.prepare("DELETE FROM clips").run();
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("toggle-pin", async (_e, id: string) => {
    const r = db.prepare("SELECT pinned FROM clips WHERE id=?").get(id) as { pinned: number } | undefined;
    const next = r?.pinned ? 0 : 1;
    db.prepare("UPDATE clips SET pinned=? WHERE id=?").run(next, id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("set-tags", async (_e, payload: { id: string; tags: string[] }) => {
    const tags = Array.isArray(payload.tags) ? payload.tags : [];
    db.prepare("UPDATE clips SET tagsJson=? WHERE id=?").run(JSON.stringify(tags), payload.id);
    win?.webContents.send("history-updated");
    return true;
  });
  ipcMain.handle("set-clip-border-color", async (_e, payload: { id: string; color: string }) => {
    const color = (payload.color ?? "").trim();
    db.prepare("UPDATE clips SET borderColor=? WHERE id=?").run(color, payload.id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("set-clip-bg-color", async (_e, payload: { id: string; color: string }) => {
    const color = (payload.color ?? "").trim();
    db.prepare("UPDATE clips SET bgColor=? WHERE id=?").run(color, payload.id);
    win?.webContents.send("history-updated");
    return true;
  });


  ipcMain.handle("update-clip-text", async (_e, payload: { id: string; text: string }) => {
    const text = (payload.text ?? "").trim();
    db.prepare("UPDATE clips SET text=? WHERE id=? AND kind='text'").run(text, payload.id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("rename-clip", async (_e, payload: { id: string; name: string }) => {
    const name = (payload.name ?? "").trim();
    db.prepare("UPDATE clips SET imageName=? WHERE id=? AND kind='image'").run(name, payload.id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("set-clip-color", async (_e, payload: { id: string; color: string }) => {
    const color = (payload.color ?? "").trim();
    db.prepare("UPDATE clips SET color=? WHERE id=?").run(color, payload.id);
    win?.webContents.send("history-updated");
    return true;
  });

  ipcMain.handle("hide-popup", async () => {
    win?.hide();
    return true;
  });

  ipcMain.handle("get-settings", async () => getSettings());

  ipcMain.handle("set-popup-shortcut", async (_e, accelerator: string) => {
    const res = setGlobalShortcut(accelerator);
    if (!res.ok) return res;

    setSetting("popupShortcut", normalizeAccelerator(accelerator));
    return { ok: true };
  });

  ipcMain.handle("get-theme", async () => getTheme());
  ipcMain.handle("set-theme", async (_e, theme: Theme) => {
    setTheme(theme);
    return true;
  });

  ipcMain.handle("get-lang", async () => getLang());
  ipcMain.handle("set-lang", async (_e, lang: Lang) => {
    setLang(lang === "km" ? "km" : "en");
    return true;
  });
}

// ---------- App lifecycle ----------
app.whenReady().then(() => {
  dbInit();
  createWindow();
  setupIPC();
  pollClipboard();

  const s = getSettings();
  const reg = setGlobalShortcut(s.popupShortcut);
  if (!reg.ok) {
    // fallback
    setGlobalShortcut("CommandOrControl+Shift+V");
    setSetting("popupShortcut", "CommandOrControl+Shift+V");
  }

  if (process.platform === "darwin" && app.isPackaged) {
    app.dock.hide();
    createTray();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});