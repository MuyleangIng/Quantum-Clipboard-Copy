import { contextBridge, ipcRenderer } from "electron";

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

contextBridge.exposeInMainWorld("clipvault", {
  // Clips
  getHistory: (query?: string) =>
    ipcRenderer.invoke("get-history", { query: query ?? "" }) as Promise<ClipItem[]>,

  setClipboard: (payload: { kind: ClipKind; text?: string; imageDataUrl?: string }) =>
    ipcRenderer.invoke("set-clipboard", payload) as Promise<boolean>,

  deleteClip: (id: string) => ipcRenderer.invoke("delete-clip", id) as Promise<boolean>,
  clearAll: () => ipcRenderer.invoke("clear-all") as Promise<boolean>,
  togglePin: (id: string) => ipcRenderer.invoke("toggle-pin", id) as Promise<boolean>,

  setTags: (id: string, tags: string[]) =>
    ipcRenderer.invoke("set-tags", { id, tags }) as Promise<boolean>,

  updateClipText: (id: string, text: string) =>
    ipcRenderer.invoke("update-clip-text", { id, text }) as Promise<boolean>,

  renameClip: (id: string, name: string) =>
    ipcRenderer.invoke("rename-clip", { id, name }) as Promise<boolean>,

  setClipColor: (id: string, color: string) =>
    ipcRenderer.invoke("set-clip-color", { id, color }) as Promise<boolean>,

  // Window
  hidePopup: () => ipcRenderer.invoke("hide-popup") as Promise<boolean>,

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings") as Promise<Settings>,
  setPopupShortcut: (accelerator: string) =>
    ipcRenderer.invoke("set-popup-shortcut", accelerator) as Promise<{ ok: boolean; reason?: string }>,

  // Theme
  getTheme: () => ipcRenderer.invoke("get-theme") as Promise<Theme>,
  setTheme: (theme: Theme) => ipcRenderer.invoke("set-theme", theme) as Promise<boolean>,

  // Language
  getLang: () => ipcRenderer.invoke("get-lang") as Promise<Lang>,
  setLang: (lang: Lang) => ipcRenderer.invoke("set-lang", lang) as Promise<boolean>,

  // Events
  onHistoryUpdated: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("history-updated", handler);
    return () => ipcRenderer.removeListener("history-updated", handler);
  },

  setClipBorderColor: (id: string, color: string) =>
  ipcRenderer.invoke("set-clip-border-color", { id, color }) as Promise<boolean>,

setClipBgColor: (id: string, color: string) =>
  ipcRenderer.invoke("set-clip-bg-color", { id, color }) as Promise<boolean>,
  onPopupOpened: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("popup-opened", handler);
    return () => ipcRenderer.removeListener("popup-opened", handler);
  }
});