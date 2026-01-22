// ============================
// FILE: src/main/preload.ts
// ============================

import { contextBridge, ipcRenderer } from "electron";

type ClipKind = "text" | "image";
type Lang = "en" | "km";

type Theme = Record<string, any>;

type Settings = {
  popupShortcut: string;
  closeOnCopy: boolean;
  closeOnCopyDelayMs: number;
  closeOnBlur: boolean;
  startAtLogin: boolean;
  lang: Lang;
  theme: Partial<Theme>;
};

type InteractionState = {
  isSettingsOpen: boolean;
  isModalOpen: boolean;
  isPickingColor: boolean;
  isRecordingShortcut: boolean;
  isTypingSearch: boolean;
};

contextBridge.exposeInMainWorld("clipvault", {
  // lifecycle
  rendererReady: () => ipcRenderer.send("rendererReady"),

  // window controls
  showPopup: () => ipcRenderer.invoke("showPopup"),
  hidePopup: () => ipcRenderer.invoke("hidePopup"),
  minimizePopup: () => ipcRenderer.invoke("minimizePopup"),

  // interaction locks
  setInteractionState: (partial: Partial<InteractionState>) =>
    ipcRenderer.invoke("setInteractionState", partial),

  // settings
  getSettings: (): Promise<Settings> => ipcRenderer.invoke("getSettings"),
  setSettings: (partial: Partial<Settings>) => ipcRenderer.invoke("setSettings", partial),
  setPopupShortcut: (accelerator: string) => ipcRenderer.invoke("setPopupShortcut", accelerator),

  // start at login
  getStartAtLogin: () => ipcRenderer.invoke("getStartAtLogin"),
  setStartAtLogin: (openAtLogin: boolean) => ipcRenderer.invoke("setStartAtLogin", openAtLogin),

  // history
  getHistory: (query: string) => ipcRenderer.invoke("getHistory", query),

  // clipboard write (copy from app -> system clipboard)
  setClipboard: (payload: { kind: ClipKind; text?: string; imageDataUrl?: string }) =>
    ipcRenderer.invoke("setClipboard", payload),

  // CRUD
  deleteClip: (id: string) => ipcRenderer.invoke("deleteClip", id),
  clearAll: () => ipcRenderer.invoke("clearAll"),
  togglePin: (id: string) => ipcRenderer.invoke("togglePin", id),

  // IMPORTANT: match main signatures (separate args, not object)
  setTags: (id: string, tags: string[]) => ipcRenderer.invoke("setTags", id, tags),
  updateClipText: (id: string, text: string) => ipcRenderer.invoke("updateClipText", id, text),
  renameClip: (id: string, name: string) => ipcRenderer.invoke("renameClip", id, name),

  // events (must match main)
  onPopupOpened: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("popupOpened", handler);
    return () => ipcRenderer.removeListener("popupOpened", handler);
  },

  onSettingsUpdated: (cb: (s: Settings) => void) => {
    const handler = (_: any, s: Settings) => cb(s);
    ipcRenderer.on("settingsUpdated", handler);
    return () => ipcRenderer.removeListener("settingsUpdated", handler);
  },

  // when DB changes (polling inserts, delete, pin, etc.)
  onHistoryUpdated: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("historyUpdated", handler);
    return () => ipcRenderer.removeListener("historyUpdated", handler);
  },
});

// Optional: TypeScript typing helper (safe even if you omit)
export {};