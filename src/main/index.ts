// ============================
// FILE: src/main/index.ts
// ============================

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
  dialog,
} from "electron";
import * as path from "node:path";
import * as fs from "node:fs";

const BetterSqlite3 = require("better-sqlite3") as typeof import("better-sqlite3");

type ClipKind = "text" | "image";
type Lang = "en" | "km";

type ClipItem = {
  id: string;
  kind: ClipKind;
  text?: string;
  imageDataUrl?: string;
  imageName?: string;
  createdAt: number;
  updatedAt?: number;
  pinned: 0 | 1;
  tags: string[];
  borderColor?: string;
  bgColor?: string;
};

type Theme = Record<string, any>;

type AppSettings = {
  popupShortcut: string;
  closeOnCopy: boolean;
  closeOnCopyDelayMs: number;
  closeOnBlur: boolean;
  startAtLogin: boolean;
  lang: Lang;
  theme: Partial<Theme>;
};

const DEFAULT_THEME: Theme = {
  bg: "#0f1115",
  panel: "#151922",
  border: "rgba(255, 255, 255, 0.12)",
  text: "rgba(235, 242, 251, 0.95)",
  muted: "rgba(160, 175, 195, 0.9)",
  danger: "#ff5a5a",
  accent: "#5aa0ff",

  itemBorder: "#2A2F3A",
  itemBg: "#151922",

  controlBg: "#1B2130",
  controlBorder: "#2A2F3A",

  itemText: "#EBF2FB",
  itemMuted: "#A0AFC3",
  controlText: "#EBF2FB",
};

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let db!: import("better-sqlite3").Database;

// -------------------- single instance --------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) showPopupNearCursor();
  });
}

// -------------------- helpers --------------------
function userDataPath(...p: string[]) {
  return path.join(app.getPath("userData"), ...p);
}

function safeJson<T>(s: string | undefined, fallback: T): T {
  try {
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function setSetting(key: string, value: string) {
  db.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).run(key, value);
}

function getSetting(key: string): string | undefined {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get(key) as { value: string } | undefined;
  return r?.value;
}

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) db.exec(ddl);
}

function randId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function notifyHistoryUpdated() {
  win?.webContents.send("historyUpdated");
}

function notifySettingsUpdated() {
  win?.webContents.send("settingsUpdated", getAppSettings());
}

// -------------------- DB --------------------
function dbInit() {
  const dbFile = userDataPath("clipvault.sqlite");
  db = new BetterSqlite3(dbFile);

  db.exec(`
    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      text TEXT,
      imageDataUrl TEXT,
      imageName TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER,
      pinned INTEGER NOT NULL DEFAULT 0,
      tagsJson TEXT NOT NULL DEFAULT '[]',
      borderColor TEXT,
      bgColor TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  ensureColumn("clips", "imageName", `ALTER TABLE clips ADD COLUMN imageName TEXT;`);
  ensureColumn("clips", "updatedAt", `ALTER TABLE clips ADD COLUMN updatedAt INTEGER;`);
  ensureColumn("clips", "borderColor", `ALTER TABLE clips ADD COLUMN borderColor TEXT;`);
  ensureColumn("clips", "bgColor", `ALTER TABLE clips ADD COLUMN bgColor TEXT;`);

  if (!getSetting("popupShortcut")) setSetting("popupShortcut", "CommandOrControl+Shift+V");
  if (!getSetting("lang")) setSetting("lang", "en");
  if (!getSetting("theme")) setSetting("theme", JSON.stringify(DEFAULT_THEME));

  if (!getSetting("closeOnCopy")) setSetting("closeOnCopy", "true");
  if (!getSetting("closeOnCopyDelayMs")) setSetting("closeOnCopyDelayMs", "0");
  if (!getSetting("closeOnBlur")) setSetting("closeOnBlur", "false");
  if (!getSetting("startAtLogin")) setSetting("startAtLogin", "false");
}

function getAppSettings(): AppSettings {
  const popupShortcut = getSetting("popupShortcut") ?? "CommandOrControl+Shift+V";
  const closeOnCopy = (getSetting("closeOnCopy") ?? "true") === "true";
  const closeOnCopyDelayMs = Number(getSetting("closeOnCopyDelayMs") ?? "0");
  const closeOnBlur = (getSetting("closeOnBlur") ?? "false") === "true";
  const startAtLogin = (getSetting("startAtLogin") ?? "false") === "true";
  const lang = ((getSetting("lang") ?? "en") === "km" ? "km" : "en") as Lang;
  const theme = safeJson<Theme>(getSetting("theme"), DEFAULT_THEME);

  return {
    popupShortcut,
    closeOnCopy,
    closeOnCopyDelayMs,
    closeOnBlur,
    startAtLogin,
    lang,
    theme,
  };
}

function savePartialSettings(partial: Partial<AppSettings>) {
  if (typeof partial.popupShortcut === "string") setSetting("popupShortcut", partial.popupShortcut);
  if (typeof partial.closeOnCopy === "boolean") setSetting("closeOnCopy", String(partial.closeOnCopy));
  if (typeof partial.closeOnCopyDelayMs === "number") setSetting("closeOnCopyDelayMs", String(partial.closeOnCopyDelayMs));
  if (typeof partial.closeOnBlur === "boolean") setSetting("closeOnBlur", String(partial.closeOnBlur));
  if (typeof partial.startAtLogin === "boolean") setSetting("startAtLogin", String(partial.startAtLogin));
  if (typeof partial.lang === "string") setSetting("lang", partial.lang === "km" ? "km" : "en");
  if (partial.theme) setSetting("theme", JSON.stringify({ ...DEFAULT_THEME, ...partial.theme }));
}

function rowToClip(r: any): ClipItem {
  return {
    id: r.id,
    kind: r.kind,
    text: r.text ?? undefined,
    imageDataUrl: r.imageDataUrl ?? undefined,
    imageName: r.imageName ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt ?? undefined,
    pinned: r.pinned,
    tags: safeJson<string[]>(r.tagsJson, []),
    borderColor: r.borderColor ?? undefined,
    bgColor: r.bgColor ?? undefined,
  };
}

function getHistory(query: string): ClipItem[] {
  const q = (query ?? "").trim().toLowerCase();
  const rows = db.prepare("SELECT * FROM clips ORDER BY pinned DESC, createdAt DESC LIMIT 400").all();
  const items = rows.map(rowToClip);

  if (!q) return items;

  return items.filter((it) => {
    if (q === "image") return it.kind === "image";
    const text = (it.text ?? "").toLowerCase();
    const name = (it.imageName ?? "").toLowerCase();
    const tags = (it.tags ?? []).join(",").toLowerCase();
    return text.includes(q) || name.includes(q) || tags.includes(q);
  });
}

function insertClipText(text: string) {
  const now = Date.now();
  const id = randId();
  db.prepare("INSERT INTO clips(id, kind, text, createdAt, pinned, tagsJson) VALUES(?,?,?,?,0,'[]')")
    .run(id, "text", text, now);
}

function insertClipImage(imageDataUrl: string, imageName?: string) {
  const now = Date.now();
  const id = randId();
  db.prepare(
    "INSERT INTO clips(id, kind, imageDataUrl, imageName, createdAt, pinned, tagsJson) VALUES(?,?,?,?,?,0,'[]')"
  ).run(id, "image", imageDataUrl, imageName ?? "", now);
}

// -------------------- interaction locks --------------------
const interaction = {
  isSettingsOpen: false,
  isModalOpen: false,
  isPickingColor: false,
  isRecordingShortcut: false,
  isTypingSearch: false,
};

// -------------------- window + tray --------------------
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
      nodeIntegration: false,
    },
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

    const s = getAppSettings();
    if (!s.closeOnBlur) return;

    if (
      interaction.isPickingColor ||
      interaction.isTypingSearch ||
      interaction.isModalOpen ||
      interaction.isSettingsOpen ||
      interaction.isRecordingShortcut
    ) return;

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

  win.webContents.send("popupOpened");
}

// ---- Start at login ----
function applyStartAtLoginFromSettings() {
  try {
    const s = getAppSettings();
    const want = !!s.startAtLogin;

    app.setLoginItemSettings({
      openAtLogin: want,
      path: process.execPath, // important for Windows
      args: [],
    });

    const actual = app.getLoginItemSettings().openAtLogin;
    setSetting("startAtLogin", String(!!actual));
    notifySettingsUpdated();
  } catch (err) {
    console.error("applyStartAtLoginFromSettings failed", err);
  }
}
function getResourcePath(...p: string[]) {
  // Packaged resources live under process.resourcesPath
  return app.isPackaged
    ? path.join(process.resourcesPath, ...p)
    : path.join(app.getAppPath(), ...p);
}

// ---- Tray (works on macOS + Windows) ----
function createTray() {

  const trayIconPath = getResourcePath("trayTemplate.png");
  tray = new Tray(trayIconPath);
  tray.setToolTip("ClipVault");

  const buildMenu = () => {
    const checked = app.getLoginItemSettings().openAtLogin;

    return Menu.buildFromTemplate([
      { label: "Open ClipVault", click: () => showPopupNearCursor() },
      { type: "separator" },
      {
        label: "Start at Login",
        type: "checkbox",
        checked,
        click: (item) => {
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            path: process.execPath,
            args: [],
          });
          setSetting("startAtLogin", String(item.checked));
          notifySettingsUpdated();
          tray?.setContextMenu(buildMenu());
        },
      },
      { type: "separator" },
      { label: `Version ${app.getVersion()}`, enabled: false },
      {
        label: "Check for Updates…",
        click: async () => {
          dialog.showMessageBox({
            type: "info",
            title: "Updates",
            message: "Auto-update is not configured yet.",
          });
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]);
  };

  tray.setContextMenu(buildMenu());
  tray.on("click", () => showPopupNearCursor());
}

// -------------------- shortcuts --------------------
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

// -------------------- clipboard polling --------------------
let lastText = "";
let lastImageHash = "";

// stable signature for images
function imageHash(img: Electron.NativeImage) {
  try {
    const buf = img.toPNG();
    const head = buf.subarray(0, Math.min(64, buf.length)).toString("hex");
    return `${buf.length}:${head}`;
  } catch {
    return "";
  }
}

function pollClipboardStart() {
  setInterval(() => {
    try {
      // text
      const txt = clipboard.readText() || "";
      const trimmed = txt.trim();
      if (trimmed && trimmed !== lastText) {
        lastText = trimmed;
        insertClipText(trimmed);
        notifyHistoryUpdated();
        return;
      }

      // image
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const h = imageHash(img);
        if (h && h !== lastImageHash) {
          lastImageHash = h;
          const dataUrl = img.toDataURL();
          insertClipImage(dataUrl, "clipboard-image.png");
          notifyHistoryUpdated();
        }
      }
    } catch {
      // ignore polling errors
    }
  }, 450);
}

// -------------------- IPC --------------------
function setupIPC() {
  ipcMain.on("rendererReady", () => {
    // optional
  });

  ipcMain.handle("showPopup", async () => {
    showPopupNearCursor();
    return { ok: true };
  });

  ipcMain.handle("hidePopup", async () => {
    win?.hide();
    return { ok: true };
  });

  ipcMain.handle("minimizePopup", async () => {
    win?.minimize();
    return { ok: true };
  });

  ipcMain.handle("setInteractionState", async (_e, partial: Partial<typeof interaction>) => {
    Object.assign(interaction, partial || {});
    return { ok: true };
  });

  ipcMain.handle("getSettings", async () => getAppSettings());

  ipcMain.handle("setSettings", async (_e, partial: Partial<AppSettings>) => {
    savePartialSettings(partial || {});
    notifySettingsUpdated();
    return { ok: true };
  });

  ipcMain.handle("setPopupShortcut", async (_e, accelerator: string) => {
    const res = setGlobalShortcut(accelerator);
    if (!res.ok) return res;

    setSetting("popupShortcut", normalizeAccelerator(accelerator));
    notifySettingsUpdated();
    return { ok: true };
  });

  // start at login
  ipcMain.handle("getStartAtLogin", async () => {
    return { ok: true, openAtLogin: app.getLoginItemSettings().openAtLogin };
  });

  ipcMain.handle("setStartAtLogin", async (_e, openAtLogin: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: !!openAtLogin,
        path: process.execPath,
        args: [],
      });

      setSetting("startAtLogin", String(!!openAtLogin));
      const actual = app.getLoginItemSettings().openAtLogin;

      notifySettingsUpdated();
      tray?.setContextMenu(
        Menu.buildFromTemplate([
          { label: "Open ClipVault", click: () => showPopupNearCursor() },
          { type: "separator" },
          {
            label: "Start at Login",
            type: "checkbox",
            checked: actual,
            click: (item) => {
              app.setLoginItemSettings({
                openAtLogin: item.checked,
                path: process.execPath,
                args: [],
              });
              setSetting("startAtLogin", String(item.checked));
              notifySettingsUpdated();
            },
          },
          { type: "separator" },
          { label: `Version ${app.getVersion()}`, enabled: false },
          { type: "separator" },
          { label: "Quit", click: () => app.quit() },
        ])
      );

      return { ok: true, openAtLogin: actual };
    } catch (err: any) {
      return { ok: false, reason: err?.message ?? String(err) };
    }
  });

  // history
  ipcMain.handle("getHistory", async (_e, query: string) => getHistory(query ?? ""));

  // clipboard write
  ipcMain.handle(
    "setClipboard",
    async (_e, payload: { kind: ClipKind; text?: string; imageDataUrl?: string }) => {
      try {
        if (payload.kind === "text") {
          clipboard.writeText(payload.text ?? "");
          return { ok: true };
        }

        const d = payload.imageDataUrl ?? "";
        if (!d.startsWith("data:image/")) return { ok: false, reason: "invalid image" };

        const img = nativeImage.createFromDataURL(d);
        if (img.isEmpty()) return { ok: false, reason: "empty image" };

        clipboard.writeImage(img);
        return { ok: true };
      } catch (err: any) {
        return { ok: false, reason: err?.message ?? String(err) };
      }
    }
  );

  ipcMain.handle("deleteClip", async (_e, id: string) => {
    db.prepare("DELETE FROM clips WHERE id=?").run(id);
    notifyHistoryUpdated();
    return { ok: true };
  });

  ipcMain.handle("clearAll", async () => {
    db.prepare("DELETE FROM clips").run();
    notifyHistoryUpdated();
    return { ok: true };
  });

  ipcMain.handle("togglePin", async (_e, id: string) => {
    const r = db.prepare("SELECT pinned FROM clips WHERE id=?").get(id) as { pinned: number } | undefined;
    const next = r?.pinned ? 0 : 1;
    db.prepare("UPDATE clips SET pinned=? WHERE id=?").run(next, id);
    notifyHistoryUpdated();
    return { ok: true };
  });

  ipcMain.handle("setTags", async (_e, id: string, tags: string[]) => {
    const safeTags = Array.isArray(tags) ? tags : [];
    db.prepare("UPDATE clips SET tagsJson=?, updatedAt=? WHERE id=?")
      .run(JSON.stringify(safeTags), Date.now(), id);
    notifyHistoryUpdated();
    return { ok: true };
  });

  ipcMain.handle("updateClipText", async (_e, id: string, text: string) => {
    const t = (text ?? "").trim();
    db.prepare("UPDATE clips SET text=?, updatedAt=? WHERE id=? AND kind='text'")
      .run(t, Date.now(), id);
    notifyHistoryUpdated();
    return { ok: true };
  });

  ipcMain.handle("renameClip", async (_e, id: string, name: string) => {
    const n = (name ?? "").trim();
    db.prepare("UPDATE clips SET imageName=?, updatedAt=? WHERE id=? AND kind='image'")
      .run(n, Date.now(), id);
    notifyHistoryUpdated();
    return { ok: true };
  });
}

// -------------------- lifecycle --------------------
app.whenReady().then(() => {
  dbInit();

  // ✅ Apply "Start at login" immediately at launch
  applyStartAtLoginFromSettings();

  createWindow();
  setupIPC();

  pollClipboardStart();

  // shortcuts
  const s = getAppSettings();
  const reg = setGlobalShortcut(s.popupShortcut);
  if (!reg.ok) {
    setGlobalShortcut("CommandOrControl+Shift+V");
    setSetting("popupShortcut", "CommandOrControl+Shift+V");
  }

  // tray behavior
  if (process.platform === "darwin") {
    // background app
    try {
      app.dock.hide();
    } catch {
      // ignore
    }
    createTray();
  } else if (process.platform === "win32") {
    createTray();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});