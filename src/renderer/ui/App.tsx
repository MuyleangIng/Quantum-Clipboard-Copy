import React, { useEffect, useMemo, useRef, useState } from "react";

type ClipKind = "text" | "image";
type Lang = "en" | "km";

type ClipItem = {
  id: string;
  kind: ClipKind;
  text?: string;
  imageDataUrl?: string;
  imageName?: string;

  // Per-item colors (HEX recommended)
  borderColor?: string;
  bgColor?: string;

  createdAt: number;
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

  // ✅ NEW (HEX-only, editable)
  itemText: string;
  itemMuted: string;
  controlText: string;
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

  // ✅ NEW
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

    color: "Color",
    itemText: "Item Text",
itemMuted: "Item Muted",
controlText: "Control Text",
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

    color: "ពណ៌",
    itemText: "ពណ៌អក្សរ (Item)",
itemMuted: "ពណ៌អក្សរតូច (Item)",
controlText: "ពណ៌អក្សរ (Controls)",
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

export default function App() {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState("");
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

  async function refresh(q: string) {
    const h = await window.clipvault.getHistory(q);
    setItems(h as any);
    setSelectedIndex(0);
  }
function ColorRow({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="cv-color-row">
      <div className="cv-label">{label}</div>
      <input
        className="cv-nodrag"
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
  useEffect(() => {
    window.clipvault.getSettings().then((s) => setShortcutDraft(s.popupShortcut));
    window.clipvault.getTheme().then((th) => setTheme({ ...DEFAULT_THEME, ...th }));
    window.clipvault.getLang().then((l) => setLang(l)).catch(() => undefined);

    refresh("").catch(() => undefined);

    const offUpdated = window.clipvault.onHistoryUpdated(() => {
      refresh(query).catch(() => undefined);
    });

    const offPopup = window.clipvault.onPopupOpened(() => {
      setQuery("");
      setSelectedIndex(0);
      setSettingsOpen(false);
      setShortcutMsg("");
      setModal("none");
      setModalItem(null);
      setTimeout(() => inputRef.current?.focus(), 40);
    });

    const onKeyDown = async (e: KeyboardEvent) => {
      if (recording) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === "Escape") {
          setRecording(false);
          setShortcutMsg(t("cancel"));
          return;
        }

        const accel = keyEventToAccelerator(e);
        if (!accel) return;

        setShortcutDraft(accel);
        setRecording(false);
        setShortcutMsg(`${t("captured")}: ${accel}`);
        return;
      }

      if (modal !== "none") {
        if (e.key === "Escape") {
          e.preventDefault();
          closeModal();
        }
        return;
      }

      if (settingsOpen) {
        if (e.key === "Escape") setSettingsOpen(false);
        return;
      }

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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      offUpdated();
      offPopup();
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen, selectedIndex, query, recording, modal, lang]);

  useEffect(() => {
    const tt = window.setTimeout(() => refresh(query).catch(() => undefined), 120);
    return () => window.clearTimeout(tt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const visible = useMemo(() => items, [items]);

  const rootStyle: React.CSSProperties = {
    ["--bg" as any]: theme.bg,
    ["--panel" as any]: theme.panel,
    ["--border" as any]: theme.border,
    ["--text" as any]: theme.text,
    ["--muted" as any]: theme.muted,
    ["--accent" as any]: theme.accent,
    ["--danger" as any]: theme.danger,

    // NEW: usable in CSS if you want
    ["--itemBorder" as any]: theme.itemBorder,
    ["--itemBg" as any]: theme.itemBg,
    ["--controlBg" as any]: theme.controlBg,
    ["--controlBorder" as any]: theme.controlBorder,
  };

  async function copyItem(item: ClipItem) {
    if (item.kind === "text") {
      await window.clipvault.setClipboard({ kind: "text", text: item.text ?? "" });
    } else {
      await window.clipvault.setClipboard({ kind: "image", imageDataUrl: item.imageDataUrl ?? "" });
    }
    showToast(t("copied"));
    await window.clipvault.hidePopup();
  }

  async function onDelete(item: ClipItem) {
    await window.clipvault.deleteClip(item.id);
    showToast(t("deleted"));
  }

  async function onClearAll() {
    await window.clipvault.clearAll();
    showToast(t("cleared"));
  }

  async function onTogglePin(item: ClipItem) {
    await window.clipvault.togglePin(item.id);
    showToast(item.pinned ? t("unpin") : t("pin"));
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
    showToast(t("tagsSaved") || "Tags saved");
    closeModal();
  }

  async function saveEditText() {
    if (!modalItem) return;
    const text = editDraft ?? "";
    await window.clipvault.updateClipText(modalItem.id, text);
    showToast(t("save"));
    closeModal();
  }

  async function saveRenameImage() {
    if (!modalItem) return;
    const name = (renameDraft ?? "").trim();
    await window.clipvault.renameClip(modalItem.id, name);
    showToast(t("save"));
    closeModal();
  }

  async function saveShortcut() {
    setShortcutMsg("Saving…");
    const res = await window.clipvault.setPopupShortcut(shortcutDraft);
    if (res.ok) {
      setShortcutMsg("Saved");
      showToast("Shortcut updated");
    } else {
      setShortcutMsg(res.reason || "Failed");
    }
  }

  async function saveTheme(next: Theme) {
    setTheme(next);
    await window.clipvault.setTheme(next);
    showToast(t("themeSaved"));
  }

  async function onChangeLang(next: Lang) {
    setLang(next);
    await window.clipvault.setLang(next);
    showToast("Saved");
  }

  return (
    <div className="cv-root" style={rootStyle}>
      <div className="cv-header">
        <div>
          <div className="cv-title">{t("title")}</div>
          <div className="cv-subtitle">
            Search <span className="cv-kbd">⌘K</span> • Open{" "}
            <span className="cv-kbd">{shortcutDraft}</span>
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
        />
      </div>

      {settingsOpen && (
        <div className="cv-panel cv-nodrag">
  <div className="cv-panel-title">{t("settings")}</div>

  {/* ===== Shortcut ===== */}
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

  {/* ===== Language ===== */}
  <div className="cv-section">
    <div className="cv-section-title">{t("language")}</div>

    <div className="cv-row">
      <select
        className="cv-input cv-nodrag"
        value={lang}
        onChange={(e) => onChangeLang(e.target.value as Lang)}
      >
        <option value="en">English</option>
        <option value="km">Khmer (ខ្មែរ)</option>
      </select>
    </div>
  </div>

  {/* ===== Theme ===== */}
  <div className="cv-section">
    <div className="cv-section-title">{t("theme")}</div>
    <div className="cv-muted" style={{ marginBottom: 6 }}>
      {t("pickColors")}
    </div>

    <div className="cv-grid">
      <ColorRow
        label={t("accent")}
        value={theme.accent}
        onChange={(v) => saveTheme({ ...theme, accent: v })}
      />
      <ColorRow
        label={t("danger")}
        value={theme.danger}
        onChange={(v) => saveTheme({ ...theme, danger: v })}
      />
      <ColorRow
        label={t("background")}
        value={theme.bg}
        onChange={(v) => saveTheme({ ...theme, bg: v })}
      />
    </div>
  </div>

  {/* ===== Item Cards ===== */}
  <div className="cv-section">
    <div className="cv-section-title">{t("itemCards") ?? "Item Cards"}</div>

    <div className="cv-grid">
      <ColorRow
        label={t("itemBorder")}
        value={theme.itemBorder}
        onChange={(v) => saveTheme({ ...theme, itemBorder: v })}
      />
      <ColorRow
        label={t("itemBg")}
        value={theme.itemBg}
        onChange={(v) => saveTheme({ ...theme, itemBg: v })}
      />
      <ColorRow
        label={t("itemText")}
        value={theme.itemText}
        onChange={(v) => saveTheme({ ...theme, itemText: v })}
      />
      <ColorRow
        label={t("itemMuted")}
        value={theme.itemMuted}
        onChange={(v) => saveTheme({ ...theme, itemMuted: v })}
      />
    </div>
  </div>

  {/* ===== Controls ===== */}
  <div className="cv-section">
    <div className="cv-section-title">{t("controls") ?? "Controls"}</div>

    <div className="cv-grid">
      <ColorRow
        label={t("controlBg")}
        value={theme.controlBg}
        onChange={(v) => saveTheme({ ...theme, controlBg: v })}
      />
      <ColorRow
        label={t("controlBorder")}
        value={theme.controlBorder}
        onChange={(v) => saveTheme({ ...theme, controlBorder: v })}
      />
      <ColorRow
        label={t("controlText")}
        value={theme.controlText}
        onChange={(v) => saveTheme({ ...theme, controlText: v })}
      />
    </div>
  </div>

  {/* ===== Reset ===== */}
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
            // Use per-item if present, else fall back to theme defaults
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
                      <div className="cv-item-text" style={{ marginTop: 8 }}>
                        {item.imageName ?? ""}
                      </div>
                    </div>
                  ) : (
                    <div className="cv-item-text">{t("imageInvalid")}</div>
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
                    <button className="cv-icon cv-nodrag" onClick={() => copyItem(item)}>
                      {t("copy")}
                    </button>

                    <button className="cv-icon cv-nodrag" onClick={() => onTogglePin(item)}>
                      {item.pinned ? t("unpin") : t("pin")}
                    </button>

                    <button className="cv-icon cv-nodrag" onClick={() => openTagsModal(item)}>
                      {t("tags")}
                    </button>

                    {item.kind === "text" ? (
                      <button className="cv-icon cv-nodrag" onClick={() => openEditTextModal(item)}>
                        {t("edit")}
                      </button>
                    ) : (
                      <button className="cv-icon cv-nodrag" onClick={() => openRenameImageModal(item)}>
                        {t("rename")}
                      </button>
                    )}

                    

                    <button className="cv-icon danger cv-nodrag" onClick={() => onDelete(item)}>
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
                  style={{ height: 140, resize: "none" }}
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
  );
}