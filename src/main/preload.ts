import { contextBridge, ipcRenderer } from "electron";

export type ClipItem = {
  id: string;
  kind: "text" | "image";
  text?: string;
  imageDataUrl?: string;
  imageName?: string; // ✅ add this
  createdAt: number;
  pinned: 0 | 1;
  tags: string[];
};

export type Settings = {
  popupShortcut: string;
};

export type Theme = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  danger: string;
  accent: string;
};

contextBridge.exposeInMainWorld("clipvault", {
  // Clips
  getHistory: (query?: string) =>
    ipcRenderer.invoke("get-history", { query: query ?? "" }) as Promise<ClipItem[]>,

  setClipboard: (payload: { kind: "text" | "image"; text?: string; imageDataUrl?: string }) =>
    ipcRenderer.invoke("set-clipboard", payload) as Promise<boolean>,

  deleteClip: (id: string) => ipcRenderer.invoke("delete-clip", id) as Promise<boolean>,
  clearAll: () => ipcRenderer.invoke("clear-all") as Promise<boolean>,
  togglePin: (id: string) => ipcRenderer.invoke("toggle-pin", id) as Promise<boolean>,
  setTags: (id: string, tags: string[]) => ipcRenderer.invoke("set-tags", { id, tags }) as Promise<boolean>,

  renameClip: (id: string, name: string) =>
    ipcRenderer.invoke("rename-clip", { id, name }) as Promise<boolean>,

  // Window
  hidePopup: () => ipcRenderer.invoke("hide-popup") as Promise<boolean>,

  // Settings
  getSettings: () => ipcRenderer.invoke("get-settings") as Promise<Settings>,
  setPopupShortcut: (accelerator: string) =>
    ipcRenderer.invoke("set-popup-shortcut", accelerator) as Promise<{ ok: boolean; reason?: string }>,

  // Theme
  getTheme: () => ipcRenderer.invoke("get-theme") as Promise<Theme>,
  setTheme: (theme: Theme) => ipcRenderer.invoke("set-theme", theme) as Promise<boolean>,

  updateClipText: (id: string, text: string) =>
  ipcRenderer.invoke("update-clip-text", { id, text }) as Promise<boolean>,


  // Events
  onHistoryUpdated: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("history-updated", handler);
    return () => ipcRenderer.removeListener("history-updated", handler);
  },

  onPopupOpened: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on("popup-opened", handler);
    return () => ipcRenderer.removeListener("popup-opened", handler);
  }
});