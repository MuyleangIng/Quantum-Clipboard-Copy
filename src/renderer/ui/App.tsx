// ============================
// FILE: src/renderer/App.tsx
// ============================

import React, { useEffect, useMemo, useRef, useState } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";

type ClipKind = "text" | "image";
type Lang = "en" | "km";
// put near the top of App.tsx (outside component)
function applyThemeToCssRoot(theme: any) {
  const r = document.documentElement; // :root
  r.style.setProperty("--bg", theme.bg);
  r.style.setProperty("--panel", theme.panel);
  r.style.setProperty("--border", theme.border);
  r.style.setProperty("--text", theme.text);
  r.style.setProperty("--muted", theme.muted);
  r.style.setProperty("--danger", theme.danger);
  r.style.setProperty("--accent", theme.accent);
}
type ClipItem = {
  id: string;
  kind: ClipKind;
  text?: string;
  imageDataUrl?: string;
  imageName?: string;
  borderColor?: string;
  bgColor?: string;
  createdAt: number;
  updatedAt?: number;
  pinned: 0 | 1;
  tags: string[];
};

type Theme = {
  bg: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  danger: string;
  accent: string;

  itemBorder: string;
  itemBg: string;

  controlBg: string;
  controlBorder: string;

  itemText: string;
  itemMuted: string;
  controlText: string;
};

type Settings = {
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

const I18N: Record<Lang, Record<string, string>> = {
  en: {
    title: "ClipVault",
    settings: "Settings",
    clearAll: "Clear All",
    searchPh: "Search text, tags, or image name… (type 'image' to filter images)",
    shortcut: "Shortcut",
    pressKeys: "Press keys now…",
    recording: "Recording…",
    record: "Record",
    saveShortcut: "Save Shortcut",
    language: "Language",
    theme: "Theme",
    pickColors: "Pick colors (saved)",
    accent: "Accent",
    danger: "Danger",
    background: "Background",
    resetTheme: "Reset Theme",
    noItems: "No clipboard items yet. Copy text or an image, then open the popup.",
    imageInvalid: "(Image item is invalid. Please copy the image again.)",
    created: "Created",
    pinned: "Pinned",
    copy: "Copy",
    pin: "Pin",
    unpin: "Unpin",
    tags: "Tags",
    edit: "Edit",
    rename: "Rename",
    delete: "Delete",
    editTagsTitle: "Edit tags",
    editTextTitle: "Edit text",
    renameImageTitle: "Rename image",
    tagsHelp: "Comma-separated, e.g. qaoa, notes, paper",
    save: "Save",
    cancel: "Cancel",
    copied: "Copied",
    deleted: "Deleted",
    cleared: "Cleared",
    captured: "Captured",
    themeSaved: "Theme saved",
    tagsSaved: "Tags saved",
    itemBorder: "Item Border",
    itemBg: "Item Background",
    controlBg: "Control Background",
    controlBorder: "Control Border",
    itemText: "Item Text",
    itemMuted: "Item Muted",
    controlText: "Control Text",
    behavior: "Behavior",
    closeOnCopy: "Close after copy",
    closeDelay: "Close delay (ms)",
    closeOnBlur: "Close on focus loss (blur)",
    system: "System",
    startAtLogin: "Launch at login",
    minimize: "Minimize",
    close: "Close",
  },
  km: {
    title: "ClipVault",
    settings: "ការកំណត់",
    clearAll: "លុបទាំងអស់",
    searchPh: "ស្វែងរកអត្ថបទ ស្លាក ឬឈ្មោះរូបភាព… (វាយ 'image' ដើម្បីមើលតែរូបភាព)",
    shortcut: "ផ្លូវកាត់",
    pressKeys: "សូមចុចគ្រាប់ចុចឥឡូវនេះ…",
    recording: "កំពុងថត…",
    record: "ថត",
    saveShortcut: "រក្សាទុកផ្លូវកាត់",
    language: "ភាសា",
    theme: "រចនាប័ទ្ម",
    pickColors: "ជ្រើសពណ៌ (បានរក្សាទុក)",
    accent: "Accent",
    danger: "Danger",
    background: "ផ្ទៃខាងក្រោយ",
    resetTheme: "កំណត់ឡើងវិញ",
    noItems: "មិនទាន់មានទិន្នន័យទេ។ សូមចម្លងអត្ថបទ ឬរូបភាព ហើយបើកផ្ទាំង។",
    imageInvalid: "(ទិន្នន័យរូបភាពមិនត្រឹមត្រូវ។ សូមចម្លងរូបភាពម្តងទៀត។)",
    created: "បានបង្កើត",
    pinned: "បានបិទភ្ជាប់",
    copy: "ចម្លង",
    pin: "បិទភ្ជាប់",
    unpin: "ដោះបិទភ្ជាប់",
    tags: "ស្លាក",
    edit: "កែ",
    rename: "ប្តូរឈ្មោះ",
    delete: "លុប",
    editTagsTitle: "កែស្លាក",
    editTextTitle: "កែអត្ថបទ",
    renameImageTitle: "ប្តូរឈ្មោះរូបភាព",
    tagsHelp: "បំបែកដោយក្បៀស ឧ. qaoa, notes, paper",
    save: "រក្សាទុក",
    cancel: "បោះបង់",
    copied: "បានចម្លង",
    deleted: "បានលុប",
    cleared: "បានលុបទាំងអស់",
    captured: "បានចាប់យក",
    themeSaved: "បានរក្សាទុករចនាប័ទ្ម",
    tagsSaved: "បានរក្សាទុកស្លាក",
    itemBorder: "ពណ៌ស៊ុម (Item)",
    itemBg: "ពណ៌ផ្ទៃ (Item)",
    controlBg: "ពណ៌ផ្ទៃ (Controls)",
    controlBorder: "ពណ៌ស៊ុម (Controls)",
    itemText: "ពណ៌អក្សរ (Item)",
    itemMuted: "ពណ៌អក្សរតូច (Item)",
    controlText: "ពណ៌អក្សរ (Controls)",
    behavior: "ការប្រើប្រាស់",
    closeOnCopy: "បិទបន្ទាប់ពីចម្លង",
    closeDelay: "ពន្យាពេលបិទ (ms)",
    closeOnBlur: "បិទពេលបាត់ focus",
    system: "ប្រព័ន្ធ",
    startAtLogin: "បើកពេលចូលប្រព័ន្ធ",
    minimize: "បង្រួម",
    close: "បិទ",
  },
};

function formatDateTime(ts: number) {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function keyEventToAccelerator(e: KeyboardEvent) {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.metaKey) parts.push("Command");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  const k = e.key;
  if (["Shift", "Control", "Alt", "Meta"].includes(k)) return "";

  const keyMap: Record<string, string> = {
    Escape: "Escape",
    Enter: "Enter",
    Backspace: "Backspace",
    Delete: "Delete",
    Tab: "Tab",
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };

  const mainKey = keyMap[k] || (k.length === 1 ? k.toUpperCase() : k);
  parts.push(mainKey);
  return parts.join("+");
}

type ModalKind = "none" | "tags" | "editText" | "renameImage";

function useOutsideClick<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void,
  enabled: boolean
) {
  useEffect(() => {
    if (!enabled) return;

    const onDown = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onOutside();
    };

    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [enabled, onOutside, ref]);
}

// Helper: don't hijack Cmd+C when user is typing/selecting text in an input/textarea
function isTextEditingTarget(el: Element | null) {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName?.toLowerCase();
  return tag === "input" || tag === "textarea" || (el as HTMLElement).isContentEditable;
}

function ColorRowHex({
  label,
  value,
  onChange,
  onPickerOpenChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  onPickerOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(
    popRef,
    () => {
      setOpen(false);
      onPickerOpenChange?.(false);
    },
    open
  );

  const color = (value || "#000000").startsWith("#") ? value : `#${value}`;

  return (
    <div className="cv-row cv-nodrag" style={{ position: "relative" }}>
      <div className="cv-label">{label}</div>

      <div className="cv-nodrag" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <button
          type="button"
          className="cv-nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => {
              const next = !v;
              onPickerOpenChange?.(next);
              return next;
            });
          }}
          style={{
            width: 42,
            height: 24,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: color,
            cursor: "pointer",
          }}
        />

        <HexColorInput
          className="cv-input cv-nodrag"
          color={color}
          onFocus={() => onPickerOpenChange?.(true)}
          onChange={(v) => onChange(v.startsWith("#") ? v : `#${v}`)}
          prefixed
        />
      </div>

      {open && (
        <div
          ref={popRef}
          className="cv-nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            zIndex: 9999,
            padding: 10,
            borderRadius: 14,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
          }}
        >
          <div
            className="cv-nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <HexColorPicker color={color} onChange={(v) => onChange(v)} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              className="cv-btn cv-nodrag"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onPickerOpenChange?.(false);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutDraft, setShortcutDraft] = useState("CommandOrControl+Shift+V");
  const [shortcutMsg, setShortcutMsg] = useState("");
  const [recording, setRecording] = useState(false);

  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [lang, setLang] = useState<Lang>("en");
  const t = (k: string) => I18N[lang][k] ?? k;

  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // behavior settings
  const [closeOnCopy, setCloseOnCopy] = useState(true);
  const [closeOnCopyDelayMs, setCloseOnCopyDelayMs] = useState(0);
  const [closeOnBlur, setCloseOnBlur] = useState(false);
  const [startAtLogin, setStartAtLogin] = useState(false);

  // interaction locks
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [isTypingSearch, setIsTypingSearch] = useState(false);

  const [modal, setModal] = useState<ModalKind>("none");
  const [modalItem, setModalItem] = useState<ClipItem | null>(null);
  const [tagsDraft, setTagsDraft] = useState("");
  const [editDraft, setEditDraft] = useState("");
  const [renameDraft, setRenameDraft] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1100);
  }
useEffect(() => {
  applyThemeToCssRoot(theme);
}, [theme]);
  async function refresh(q: string) {
    const h = await window.clipvault.getHistory(q);
    setItems(h as any);
    setSelectedIndex(0);
  }

  async function persistSettings(partial: Partial<Settings>) {
    await window.clipvault.setSettings(partial);
  }

  async function copyItem(item: ClipItem) {
    if (item.kind === "text") {
      await window.clipvault.setClipboard({ kind: "text", text: item.text ?? "" });
    } else {
      await window.clipvault.setClipboard({ kind: "image", imageDataUrl: item.imageDataUrl ?? "" });
    }

    showToast(t("copied"));

    if (closeOnCopy) {
      const d = Number(closeOnCopyDelayMs ?? 0);
      if (d > 0) window.setTimeout(() => window.clipvault.hidePopup(), d);
      else await window.clipvault.hidePopup();
    }
  }

  /* ------------------ lifecycle ------------------ */

  useEffect(() => {
    window.clipvault.rendererReady();

    window.clipvault.getSettings().then((s: Settings) => {
      const nextLang: Lang = s?.lang === "km" ? "km" : "en";
      setLang(nextLang);

      // IMPORTANT: theme must be merged with defaults (otherwise undefined fields crash rootStyle)
      const nextTheme: Theme = { ...DEFAULT_THEME, ...(s?.theme || {}) };
      setTheme(nextTheme);

      setShortcutDraft(s?.popupShortcut || "CommandOrControl+Shift+V");

      setCloseOnCopy(Boolean(s?.closeOnCopy));
      setCloseOnCopyDelayMs(Number(s?.closeOnCopyDelayMs || 0));
      setCloseOnBlur(Boolean(s?.closeOnBlur));
      setStartAtLogin(Boolean(s?.startAtLogin));
    });

    // If you expose this in preload, keep it:
    window.clipvault.getStartAtLogin?.().then((r: any) => {
      if (r?.ok) setStartAtLogin(Boolean(r.openAtLogin));
    });

    refresh("").catch(() => undefined);

    const offPopup = window.clipvault.onPopupOpened(() => {
      setQuery("");
      setSelectedIndex(0);
      setSettingsOpen(false);
      setShortcutMsg("");
      setModal("none");
      setModalItem(null);
      setRecording(false);
      setColorPickerOpen(false);
      setIsTypingSearch(false);

      setTimeout(() => inputRef.current?.focus(), 40);
    });

    const offSettings = window.clipvault.onSettingsUpdated((s: Settings) => {
      const nextLang: Lang = s?.lang === "km" ? "km" : "en";
      setLang(nextLang);

      const nextTheme: Theme = { ...DEFAULT_THEME, ...(s?.theme || {}) };
      setTheme(nextTheme);

      setShortcutDraft(s?.popupShortcut || "CommandOrControl+Shift+V");

      setCloseOnCopy(Boolean(s?.closeOnCopy));
      setCloseOnCopyDelayMs(Number(s?.closeOnCopyDelayMs || 0));
      setCloseOnBlur(Boolean(s?.closeOnBlur));
      setStartAtLogin(Boolean(s?.startAtLogin));
    });

    // ✅ FIX: use queryRef so it always refreshes with the latest query
    const offHistory = window.clipvault.onHistoryUpdated(() => {
      refresh(queryRef.current).catch(() => undefined);
    });

    return () => {
      offPopup();
      offSettings();
      offHistory();
    };
  }, []);

  useEffect(() => {
    const tt = window.setTimeout(() => refresh(query).catch(() => undefined), 120);
    return () => window.clearTimeout(tt);
  }, [query]);

  const visible = useMemo(() => items, [items]);

  // keep main informed of interaction state (optional but recommended)
  useEffect(() => {
    window.clipvault.setInteractionState?.({
      isSettingsOpen: settingsOpen,
      isModalOpen: modal !== "none",
      isPickingColor: colorPickerOpen,
      isRecordingShortcut: recording,
      isTypingSearch,
    });
  }, [settingsOpen, modal, colorPickerOpen, recording, isTypingSearch]);

  const rootStyle: React.CSSProperties = {
    ["--bg" as any]: theme.bg,
    ["--panel" as any]: theme.panel,
    ["--border" as any]: theme.border,
    ["--text" as any]: theme.text,
    ["--muted" as any]: theme.muted,
    ["--accent" as any]: theme.accent,
    ["--danger" as any]: theme.danger,
  };

  /* ------------------ actions ------------------ */

  async function onDelete(item: ClipItem) {
    await window.clipvault.deleteClip(item.id);
    showToast(t("deleted"));
    await refresh(query);
  }

  async function onClearAll() {
    await window.clipvault.clearAll();
    showToast(t("cleared"));
    await refresh(query);
  }

  async function onTogglePin(item: ClipItem) {
    await window.clipvault.togglePin(item.id);
    showToast(item.pinned ? t("unpin") : t("pin"));
    await refresh(query);
  }

  function openTagsModal(item: ClipItem) {
    setModalItem(item);
    setTagsDraft((item.tags ?? []).join(", "));
    setModal("tags");
  }

  function openEditTextModal(item: ClipItem) {
    setModalItem(item);
    setEditDraft(item.text ?? "");
    setModal("editText");
  }

  function openRenameImageModal(item: ClipItem) {
    setModalItem(item);
    setRenameDraft(item.imageName ?? "");
    setModal("renameImage");
  }

  function closeModal() {
    setModal("none");
    setModalItem(null);
    setTagsDraft("");
    setEditDraft("");
    setRenameDraft("");
  }

  async function saveTags() {
    if (!modalItem) return;
    const tags = tagsDraft
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    await window.clipvault.setTags(modalItem.id, tags);
    showToast(t("tagsSaved"));
    closeModal();
    await refresh(query);
  }

  async function saveEditText() {
    if (!modalItem) return;
    const text = editDraft ?? "";
    await window.clipvault.updateClipText(modalItem.id, text);
    showToast(t("save"));
    closeModal();
    await refresh(query);
  }

  async function saveRenameImage() {
    if (!modalItem) return;
    const name = (renameDraft ?? "").trim();
    await window.clipvault.renameClip(modalItem.id, name);
    showToast(t("save"));
    closeModal();
    await refresh(query);
  }

  async function saveShortcut() {
    setShortcutMsg("Saving…");
    const res = await window.clipvault.setPopupShortcut(shortcutDraft);
    if (res?.ok) {
      setShortcutMsg("Saved");
      showToast("Shortcut updated");
    } else {
      setShortcutMsg(res?.reason || "Failed");
    }
  }

  async function saveTheme(next: Theme) {
    setTheme(next);
    await persistSettings({ theme: next });
    showToast(t("themeSaved"));
  }

  async function onChangeLang(next: Lang) {
    setLang(next);
    await persistSettings({ lang: next });
    showToast("Saved");
  }

  /* ------------------ keyboard ------------------ */

  useEffect(() => {
    const onKeyDown = async (e: KeyboardEvent) => {
      // recording shortcut: do not close popup
      if (recording) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setRecording(false);
          setShortcutMsg("");
          return;
        }

        const accel = keyEventToAccelerator(e);
        if (!accel) return;

        setShortcutDraft(accel);
        setRecording(false);
        setShortcutMsg(`${t("captured")}: ${accel}`);
        return;
      }

      // modal: Esc closes modal only
      if (modal !== "none") {
        if (e.key === "Escape") {
          e.preventDefault();
          closeModal();
        }
        return;
      }

      // color picker open: Esc does nothing
      if (e.key === "Escape" && colorPickerOpen) {
        e.preventDefault();
        return;
      }

      // settings open: Esc closes settings only
      if (settingsOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setSettingsOpen(false);
        }
        return;
      }

      // normal: Esc hides popup
      if (e.key === "Escape") {
        e.preventDefault();
        await window.clipvault.hidePopup();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, visible.length - 1)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const it = visible[selectedIndex];
        if (it) await copyItem(it);
        return;
      }

      // Cmd/Ctrl+K focuses search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Cmd/Ctrl+C copies selected item (only if not typing in input/textarea)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c") {
        const ae = document.activeElement;
        if (isTextEditingTarget(ae)) return;

        e.preventDefault();
        const it = visible[selectedIndex];
        if (it) await copyItem(it);
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [recording, modal, settingsOpen, colorPickerOpen, selectedIndex, visible]);

  return (
    <div className="cv-shell">
<div className="cv-root" style={rootStyle}>

        <div className="cv-header">
        <div>
          <div className="cv-titlebar-top">
            <div className="cv-traffic-top cv-nodrag">
              <button className="cv-dot red" aria-label="Close" onClick={() => window.clipvault.hidePopup()}>
                ×
              </button>
              <button className="cv-dot yellow" aria-label="Minimize" onClick={() => window.clipvault.minimizePopup()}>
                –
              </button>
              {/* <button
                className="cv-dot green"
                aria-label="Report"
                onClick={() => {
                  // TODO: report/feedback action
                }}
              >
                +
              </button> */}
            </div>

            <div className="cv-title-center">
              <div className="cv-title">ClipVault</div>
              <div className="cv-subtitle">
                Search <span className="cv-kbd">⌘K</span>Open <span className="cv-kbd">{shortcutDraft}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cv-actions cv-nodrag">
          <button className="cv-btn cv-nodrag" onClick={() => setSettingsOpen((v) => !v)}>
            {t("settings")}
          </button>
          <button className="cv-btn danger cv-nodrag" onClick={onClearAll}>
            {t("clearAll")}
          </button>
        </div>
      </div>

      <div className="cv-search cv-nodrag">
        <input
          ref={inputRef}
          className="cv-input cv-nodrag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPh")}
          spellCheck={false}
          onFocus={() => setIsTypingSearch(true)}
          onBlur={() => setIsTypingSearch(false)}
        />
      </div>

      {settingsOpen && (
        <div className="cv-panel cv-nodrag">
          <div className="cv-panel-title">{t("settings")}</div>

          {/* Shortcut */}
          <div className="cv-section">
            <div className="cv-section-title">{t("shortcut")}</div>

            <div className="cv-row">
              <input className="cv-input cv-nodrag" value={shortcutDraft} readOnly />
              <button
                className="cv-btn cv-nodrag"
                onClick={() => {
                  setRecording(true);
                  setShortcutMsg(t("pressKeys"));
                }}
              >
                {recording ? t("recording") : t("record")}
              </button>
            </div>

            <div className="cv-row">
              <button className="cv-btn cv-nodrag" onClick={saveShortcut}>
                {t("saveShortcut")}
              </button>
              <div className="cv-muted">{shortcutMsg}</div>
            </div>
          </div>

          {/* Language */}
          <div className="cv-section">
            <div className="cv-section-title">{t("language")}</div>
            <div className="cv-row">
              <select className="cv-input cv-nodrag" value={lang} onChange={(e) => onChangeLang(e.target.value as Lang)}>
                <option value="en">English</option>
                <option value="km">Khmer (ខ្មែរ)</option>
              </select>
            </div>
          </div>

          {/* Behavior */}
          <div className="cv-section">
            <div className="cv-section-title">{t("behavior")}</div>

            <div className="cv-row">
              <div className="cv-label">{t("closeOnCopy")}</div>
              <input
                className="cv-nodrag"
                type="checkbox"
                checked={closeOnCopy}
                onChange={async (e) => {
                  const v = e.target.checked;
                  setCloseOnCopy(v);
                  await persistSettings({ closeOnCopy: v });
                }}
              />
            </div>

            <div className="cv-row">
              <div className="cv-label">{t("closeDelay")}</div>
              <input
                className="cv-input cv-nodrag"
                type="number"
                min={0}
                max={5000}
                value={closeOnCopyDelayMs}
                onChange={async (e) => {
                  const v = Math.max(0, Math.min(5000, Number(e.target.value || 0)));
                  setCloseOnCopyDelayMs(v);
                  await persistSettings({ closeOnCopyDelayMs: v });
                }}
              />
            </div>

            <div className="cv-row">
              <div className="cv-label">{t("closeOnBlur")}</div>
              <input
                className="cv-nodrag"
                type="checkbox"
                checked={closeOnBlur}
                onChange={async (e) => {
                  const v = e.target.checked;
                  setCloseOnBlur(v);
                  await persistSettings({ closeOnBlur: v });
                }}
              />
            </div>
          </div>

          {/* System */}
          <div className="cv-section">
            <div className="cv-section-title">{t("system")}</div>

            <div className="cv-row">
              <div className="cv-label">{t("startAtLogin")}</div>
              <input
                className="cv-nodrag"
                type="checkbox"
                checked={startAtLogin}
                onChange={async (e) => {
                  const v = e.target.checked;
                  setStartAtLogin(v);
                  await window.clipvault.setStartAtLogin(v);
                  await persistSettings({ startAtLogin: v });
                }}
              />
            </div>
          </div>

          {/* Theme */}
          <div className="cv-section">
            <div className="cv-section-title">{t("theme")}</div>
            <div className="cv-muted" style={{ marginBottom: 6 }}>
              {t("pickColors")}
            </div>

            <div className="cv-grid">
              {/* <ColorRowHex
                label={t("accent")}
                value={theme.accent}
                onChange={(v) => saveTheme({ ...theme, accent: v })}
                onPickerOpenChange={setColorPickerOpen}
              /> */}
              <ColorRowHex
                label={t("danger")}
                value={theme.danger}
                onChange={(v) => saveTheme({ ...theme, danger: v })}
                onPickerOpenChange={setColorPickerOpen}
              />
              <ColorRowHex
  label={t("background")}
  value={theme.bg}
  onChange={(v) => saveTheme({ ...theme, bg: v })}
  onPickerOpenChange={setColorPickerOpen}
/>
            </div>
          </div>

          {/* Item Cards */}
          <div className="cv-section">
            <div className="cv-section-title">Item Cards</div>

            <div className="cv-grid">
              <ColorRowHex
                label={t("itemBorder")}
                value={theme.itemBorder}
                onChange={(v) => saveTheme({ ...theme, itemBorder: v })}
                onPickerOpenChange={setColorPickerOpen}
              />
              <ColorRowHex
                label={t("itemBg")}
                value={theme.itemBg}
                onChange={(v) => saveTheme({ ...theme, itemBg: v })}
                onPickerOpenChange={setColorPickerOpen}
              />
              <ColorRowHex
                label={t("itemText")}
                value={theme.itemText}
                onChange={(v) => saveTheme({ ...theme, itemText: v })}
                onPickerOpenChange={setColorPickerOpen}
              />
              <ColorRowHex
                label={t("itemMuted")}
                value={theme.itemMuted}
                onChange={(v) => saveTheme({ ...theme, itemMuted: v })}
                onPickerOpenChange={setColorPickerOpen}
              />
            </div>
          </div>

          <div className="cv-row" style={{ marginTop: 10 }}>
            <button className="cv-btn cv-nodrag" onClick={() => saveTheme(DEFAULT_THEME)}>
              {t("resetTheme")}
            </button>
          </div>
        </div>
      )}

      <div className="cv-list cv-nodrag">
        {visible.length === 0 ? (
          <div className="cv-empty">{t("noItems")}</div>
        ) : (
          visible.map((item, idx) => {
            const borderColor = item.borderColor ?? theme.itemBorder;
            const bgColor = item.bgColor ?? theme.itemBg;

            return (
              <div
                key={item.id}
                className={"cv-item cv-nodrag " + (idx === selectedIndex ? "selected" : "")}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{ borderColor, background: bgColor }}
              >
                {item.kind === "image" ? (
                  item.imageDataUrl?.startsWith("data:image/") ? (
                    <div>
                      <img className="cv-img cv-nodrag" src={item.imageDataUrl} alt="clipboard" />
                      <div className="cv-item-text" style={{ marginTop: 8, color: theme.itemText }}>
                        {item.imageName ?? ""}
                      </div>
                    </div>
                  ) : (
                    <div className="cv-item-text" style={{ color: theme.itemText }}>
                      {t("imageInvalid")}
                    </div>
                  )
                ) : (
                  <div className="cv-item-text" style={{ color: theme.itemText }}>
                    {item.text ?? ""}
                  </div>
                )}

                <div className="cv-item-meta">
                  <div className="cv-meta-left">
                    <div className="cv-muted" style={{ marginBottom: 6, color: theme.itemMuted }}>
                      {t("created")}: {formatDateTime(item.createdAt)}
                    </div>

                    {item.pinned ? <span className="cv-badge">{t("pinned")}</span> : null}

                    {(item.tags ?? []).map((tg) => (
                      <span key={tg} className="cv-tag">
                        {tg}
                      </span>
                    ))}
                  </div>

                  <div className="cv-meta-right cv-nodrag">
                    <button
                      className="cv-icon cv-nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await copyItem(item);
                      }}
                    >
                      {t("copy")}
                    </button>

                    <button
                      className="cv-icon cv-nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(item);
                      }}
                    >
                      {item.pinned ? t("unpin") : t("pin")}
                    </button>

                    <button
                      className="cv-icon cv-nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        openTagsModal(item);
                      }}
                    >
                      {t("tags")}
                    </button>

                    {item.kind === "text" ? (
                      <button
                        className="cv-icon cv-nodrag"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditTextModal(item);
                        }}
                      >
                        {t("edit")}
                      </button>
                    ) : (
                      <button
                        className="cv-icon cv-nodrag"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameImageModal(item);
                        }}
                      >
                        {t("rename")}
                      </button>
                    )}

                    <button
                      className="cv-icon danger cv-nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item);
                      }}
                    >
                      {t("delete")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="cv-footer cv-nodrag">
        <span>↑/↓ navigate • Enter copy • Esc close</span>
        <span>Drag anywhere on glass to move</span>
      </div>

      {toast && <div className="cv-toast">{toast}</div>}

      {modal !== "none" && (
        <div className="cv-modal-backdrop cv-nodrag" onMouseDown={closeModal}>
          <div className="cv-modal cv-nodrag" onMouseDown={(e) => e.stopPropagation()}>
            <div className="cv-modal-title">
              {modal === "tags" ? t("editTagsTitle") : modal === "editText" ? t("editTextTitle") : t("renameImageTitle")}
            </div>

            {modal === "tags" && (
              <>
                <div className="cv-muted" style={{ marginBottom: 8 }}>
                  {t("tagsHelp")}
                </div>
                <input
                  className="cv-input cv-nodrag"
                  value={tagsDraft}
                  onChange={(e) => setTagsDraft(e.target.value)}
                  placeholder={t("tagsHelp")}
                  autoFocus
                />
                <div className="cv-modal-actions">
                  <button className="cv-btn cv-nodrag" onClick={saveTags}>
                    {t("save")}
                  </button>
                  <button className="cv-btn cv-nodrag" onClick={closeModal}>
                    {t("cancel")}
                  </button>
                </div>
              </>
            )}

            {modal === "editText" && (
              <>
                <textarea
                   className="cv-input cv-nodrag"
  style={{
    minHeight: 140,
    height: 140,         // initial height
    resize: "vertical",  // user can resize up/down
    overflow: "auto",
  }}
  value={editDraft}
  onChange={(e) => setEditDraft(e.target.value)}
  autoFocus
                />
                <div className="cv-modal-actions">
                  <button className="cv-btn cv-nodrag" onClick={saveEditText}>
                    {t("save")}
                  </button>
                  <button className="cv-btn cv-nodrag" onClick={closeModal}>
                    {t("cancel")}
                  </button>
                </div>
              </>
            )}

            {modal === "renameImage" && (
              <>
                <input
                  className="cv-input cv-nodrag"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  placeholder="Image name..."
                  autoFocus
                />
                <div className="cv-modal-actions">
                  <button className="cv-btn cv-nodrag" onClick={saveRenameImage}>
                    {t("save")}
                  </button>
                  <button className="cv-btn cv-nodrag" onClick={closeModal}>
                    {t("cancel")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
        
      </div>
    
    </div>
    
  );
}