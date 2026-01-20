// src/main/index.ts
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

// better-sqlite3 (CommonJS require)
const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3");

type ClipItem = {
  id: string;
  kind: "text" | "image";
  text?: string;
  imageDataUrl?: string;
  imageName?: string;
  createdAt: number;
  pinned: 0 | 1;
  tags: string[];
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
let db: import("better-sqlite3").Database;

// ---------------- Single instance lock (MUST be near top) ----------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

app.on("second-instance", () => {
  if (win) showPopupNearCursor();
});

// ---------------- Paths / resources ----------------
function userDataPath(...p: string[]) {
  return path.join(app.getPath("userData"), ...p);
}

function getResourcePath(...p: string[]) {
  return app.isPackaged ? path.join(process.resourcesPath, ...p) : path.join(app.getAppPath(), ...p);
}

// ---------------- DB helpers ----------------
function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function rowToClip(r: any): ClipItem {
  return {
    id: r.id,
    kind: r.kind,
    text: r.text ?? undefined,
    imageDataUrl: r.imageDataUrl ?? undefined,
    imageName: r.imageName ?? undefined,
    createdAt: r.createdAt,
    pinned: r.pinned,
    tags: safeJson(r.tagsJson, [])
  };
}

function ensureColumn(table: string, column: string, ddl: string) {
  // IMPORTANT: db must exist before this runs (we only call it inside dbInit)
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(ddl);
}

function dbInit() {
  const dbFile = userDataPath("clipvault.sqlite");
  db = new BetterSqlite3(dbFile);

  // Base schema
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

  // Defaults
  if (!db.prepare("SELECT 1 FROM settings WHERE key = ?").get("popupShortcut")) {
    db.prepare("INSERT INTO settings(key, value) VALUES(?, ?)").run("popupShortcut", "CommandOrControl+Shift+V");
  }

  if (!db.prepare("SELECT 1 FROM settings WHERE key = ?").get("theme")) {
    db.prepare("INSERT INTO settings(key, value) VALUES(?, ?)").run("theme", JSON.stringify(DEFAULT_THEME));
  }
}

function getSettings(): Settings {
  const s = db.prepare("SELECT value FROM settings WHERE key=?").get("popupShortcut") as { value: string } | undefined;
  return { popupShortcut: s?.value ?? "CommandOrControl+Shift+V" };
}

function setSetting(key: string, value: string) {
  db.prepare("INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(
    key,
    value
  );
}

function getTheme(): Theme {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get("theme") as { value: string } | undefined;
  const parsed = r?.value ? safeJson<Theme>(r.value, DEFAULT_THEME) : DEFAULT_THEME;
  return { ...DEFAULT_THEME, ...parsed };
}

function setTheme(theme: Theme) {
  setSetting("theme", JSON.stringify({ ...DEFAULT_THEME, ...theme }));
}

// ---------------- Clip operations ----------------
function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function defaultImageName() {
  const d = new Date();
  return `Image-${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}-${pad2(d.getHours())}-${pad2(
    d.getMinutes()
  )}-${pad2(d.getSeconds())}.png`;
}

function tryGetClipboardFileName(): string | undefined {
  try {
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

function insertTextClip(textRaw: string) {
  const text = (textRaw ?? "").trim();
  if (!text) return;

  // de-dup by text
  const existing = db.prepare("SELECT id FROM clips WHERE kind='text' AND text=?").get(text) as
    | { id: string }
    | undefined;
  if (existing?.id) db.prepare("DELETE FROM clips WHERE id=?").run(existing.id);

  db.prepare(
    "INSERT INTO clips(id, kind, text, imageDataUrl, imageName, createdAt, pinned, tagsJson) VALUES(?, 'text', ?, NULL, NULL, ?, 0, '[]')"
  ).run(nowId(), text, Date.now());
}

function insertImageClip(png: Buffer, imageName?: string) {
  if (!png?.length) return;

  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  if (dataUrl.length < 2000) return;

  const name = (imageName ?? "").trim() || defaultImageName();

  // de-dup by prefix+length (cheap)
  const sig = dataUrl.slice(0, 100) + ":" + dataUrl.length;
  const recent = db
    .prepare("SELECT id, imageDataUrl FROM clips WHERE kind='image' ORDER BY createdAt DESC LIMIT 30")
    .all() as { id: string; imageDataUrl: string }[];

  for (const e of recent) {
    const esig = (e.imageDataUrl?.slice(0, 100) ?? "") + ":" + (e.imageDataUrl?.length ?? 0);
    if (esig === sig) {
      db.prepare("DELETE FROM clips WHERE id=?").run(e.id);
      break;
    }
  }

  db.prepare(
    "INSERT INTO clips(id, kind, text, imageDataUrl, imageName, createdAt, pinned, tagsJson) VALUES(?, 'image', NULL, ?, ?, ?, 0, '[]')"
  ).run(nowId(), dataUrl, name, Date.now());
}

function getHistory(query: string): ClipItem[] {
  const q = (query ?? "").trim().toLowerCase();

  const rows = db.prepare("SELECT * FROM clips ORDER BY pinned DESC, createdAt DESC LIMIT 300").all();
  const items = rows.map(rowToClip);

  if (!q) return items;

  return items.filter((it) => {
    if (q === "image") return it.kind === "image";
    const tags = (it.tags ?? []).join(",").toLowerCase();
    const text = (it.text ?? "").toLowerCase();
    const name = (it.imageName ?? "").toLowerCase();
    return text.includes(q) || tags.includes(q) || name.includes(q);
  });
}

// ---------------- Window / Tray ----------------
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

  tray.setToolTip("ClipVault");

  const menu = Menu.buildFromTemplate([
    { label: "Open ClipVault", click: () => showPopupNearCursor() },
    { type: "separator" },
    { label: `Version ${app.getVersion()}`, enabled: false },
    {
      label: "Check for Updates…",
      click: async () => {
        dialog.showMessageBox({
          type: "info",
          title: "Updates",
          message: "Auto-update is not configured yet.",
          detail: "Later you can enable publishing and autoUpdater here."
        });
      }
    },
    { type: "separator" },
    { label: "Quit", role: "quit" }
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => showPopupNearCursor());
}

// ---------------- Clipboard polling (stable) ----------------
let lastText = "";
let lastImageSig = "";
let lastSeenTick = 0;

function sigFromPng(png: Buffer) {
  if (!png?.length) return "";
  const head = png.subarray(0, Math.min(64, png.length)).toString("hex");
  return `${head}:${png.length}`;
}

function pollClipboard() {
  setInterval(() => {
    const tick = Date.now();
    if (tick - lastSeenTick < 200) return;
    lastSeenTick = tick;

    // 1) Text first
    const text = clipboard.readText();
    const trimmed = text.trim();
    if (trimmed && trimmed !== lastText) {
      lastText = trimmed;
      insertTextClip(trimmed);
      win?.webContents.send("history-updated");
      return;
    }

    // 2) Image second
    const img = clipboard.readImage();
    if (img.isEmpty()) return;

    const png = img.toPNG();
    // ignore tiny "ghost" icons
    if (png.length < 8192) return;

    const sig = sigFromPng(png);
    if (!sig || sig === lastImageSig) return;
    lastImageSig = sig;

    const fileName = tryGetClipboardFileName() ?? defaultImageName();
    insertImageClip(png, fileName);
    win?.webContents.send("history-updated");
  }, 450);
}

// ---------------- Shortcuts ----------------
function registerShortcut(accel: string) {
  globalShortcut.unregisterAll();
  return globalShortcut.register(accel, () => showPopupNearCursor());
}

// ---------------- IPC ----------------
function setupIPC() {
  ipcMain.handle("get-history", async (_e, payload: { query: string }) => {
    return getHistory(payload?.query ?? "");
  });

  ipcMain.handle(
    "set-clipboard",
    async (_e, payload: { kind: "text" | "image"; text?: string; imageDataUrl?: string }) => {
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

  ipcMain.handle("hide-popup", async () => {
    win?.hide();
    return true;
  });

  ipcMain.handle("get-settings", async () => getSettings());

  ipcMain.handle("set-popup-shortcut", async (_e, accelerator: string) => {
    const accel = (accelerator ?? "").trim();
    if (!accel) return { ok: false, reason: "Empty shortcut" };

    const ok = registerShortcut(accel);
    if (!ok) return { ok: false, reason: "Invalid or already in use" };

    setSetting("popupShortcut", accel);
    return { ok: true };
  });

  ipcMain.handle("get-theme", async () => getTheme());

  ipcMain.handle("set-theme", async (_e, theme: Theme) => {
    setTheme(theme);
    return true;
  });
}

// ---------------- App lifecycle ----------------
app.whenReady().then(() => {
  dbInit();
  createWindow();
  setupIPC();
  pollClipboard();

  const s = getSettings();
  registerShortcut(s.popupShortcut);

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