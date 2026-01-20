// src/renderer/App.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatTime(ts: number) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}:${pad2(d.getSeconds())}`;
}

function normalizeTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function App() {
  const [items, setItems] = useState<ClipItem[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutDraft, setShortcutDraft] = useState("CommandOrControl+Shift+V");
  const [shortcutMsg, setShortcutMsg] = useState("");

  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);

  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // latest query & visible list for event handlers
  const queryRef = useRef("");
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const visibleRef = useRef<ClipItem[]>([]);

  // Tags modal
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [tagTarget, setTagTarget] = useState<ClipItem | null>(null);

  // Edit Text modal
  const [editOpen, setEditOpen] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editTarget, setEditTarget] = useState<ClipItem | null>(null);

  // Rename Image modal
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [renameTarget, setRenameTarget] = useState<ClipItem | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 1100);
  }

  async function refresh(q: string) {
    const h = await window.clipvault.getHistory(q);
    const arr = (h as unknown as ClipItem[]) ?? [];
    setItems(arr);
    setSelectedIndex(0);
  }

  // Local filtering for correctness (even if backend already filters)
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((it) => {
      if (q === "image") return it.kind === "image";
      const text = (it.text ?? "").toLowerCase();
      const tags = (it.tags ?? []).join(",").toLowerCase();
      const name = (it.imageName ?? "").toLowerCase();
      return text.includes(q) || tags.includes(q) || name.includes(q);
    });
  }, [items, query]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  const rootStyle: React.CSSProperties = {
    ["--bg" as any]: theme.bg,
    ["--panel" as any]: theme.panel,
    ["--border" as any]: theme.border,
    ["--text" as any]: theme.text,
    ["--muted" as any]: theme.muted,
    ["--accent" as any]: theme.accent,
    ["--danger" as any]: theme.danger
  };

  async function copyItem(item: ClipItem) {
    if (item.kind === "text") {
      await window.clipvault.setClipboard({ kind: "text", text: item.text ?? "" });
    } else {
      await window.clipvault.setClipboard({ kind: "image", imageDataUrl: item.imageDataUrl ?? "" });
    }
    showToast("Copied");
    await window.clipvault.hidePopup();
  }

  async function onDelete(item: ClipItem) {
    await window.clipvault.deleteClip(item.id);
    showToast("Deleted");
    refresh(queryRef.current).catch(() => undefined);
  }

  async function onClearAll() {
    await window.clipvault.clearAll();
    showToast("Cleared");
    refresh(queryRef.current).catch(() => undefined);
  }

  async function onTogglePin(item: ClipItem) {
    await window.clipvault.togglePin(item.id);
    showToast(item.pinned ? "Unpinned" : "Pinned");
    refresh(queryRef.current).catch(() => undefined);
  }

  // --- Tags modal ---
  function openTagModal(item: ClipItem) {
    setTagTarget(item);
    setTagDraft((item.tags ?? []).join(", "));
    setTagModalOpen(true);
    setTimeout(() => {
      const el = document.getElementById("cv-tags-input") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 30);
  }

  async function saveTags() {
    if (!tagTarget) return;
    const tags = normalizeTags(tagDraft);
    await window.clipvault.setTags(tagTarget.id, tags);
    showToast("Tags saved");
    setTagModalOpen(false);
    setTagTarget(null);
    setTagDraft("");
    refresh(queryRef.current).catch(() => undefined);
  }

  // --- Edit text modal ---
  function openEditText(item: ClipItem) {
    setEditTarget(item);
    setEditDraft(item.text ?? "");
    setEditOpen(true);
    setTimeout(() => {
      const el = document.getElementById("cv-edit-textarea") as HTMLTextAreaElement | null;
      el?.focus();
      el?.select();
    }, 30);
  }

  async function saveEditText() {
    if (!editTarget) return;
    await window.clipvault.updateClipText(editTarget.id, editDraft);
    showToast("Updated");
    setEditOpen(false);
    setEditTarget(null);
    setEditDraft("");
    refresh(queryRef.current).catch(() => undefined);
  }

  // --- Rename image modal ---
  function openRenameImage(item: ClipItem) {
    setRenameTarget(item);
    setRenameDraft(item.imageName ?? "");
    setRenameOpen(true);
    setTimeout(() => {
      const el = document.getElementById("cv-rename-input") as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 30);
  }

  async function saveRenameImage() {
    if (!renameTarget) return;
    await window.clipvault.renameClip(renameTarget.id, renameDraft);
    showToast("Renamed");
    setRenameOpen(false);
    setRenameTarget(null);
    setRenameDraft("");
    refresh(queryRef.current).catch(() => undefined);
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
    showToast("Theme saved");
  }

  // Install IPC + keyboard once
  useEffect(() => {
    window.clipvault.getSettings().then((s) => setShortcutDraft(s.popupShortcut));
    window.clipvault.getTheme().then((t) => setTheme({ ...DEFAULT_THEME, ...t }));
    refresh("").catch(() => undefined);

    const offUpdated = window.clipvault.onHistoryUpdated(() => {
      refresh(queryRef.current).catch(() => undefined);
    });

    const offPopup = window.clipvault.onPopupOpened(() => {
      setQuery("");
      setSelectedIndex(0);
      setSettingsOpen(false);
      setShortcutMsg("");

      setTagModalOpen(false);
      setTagTarget(null);
      setTagDraft("");

      setEditOpen(false);
      setEditTarget(null);
      setEditDraft("");

      setRenameOpen(false);
      setRenameTarget(null);
      setRenameDraft("");

      refresh("").catch(() => undefined);
      setTimeout(() => inputRef.current?.focus(), 40);
    });

    const onKeyDown = async (e: KeyboardEvent) => {
      // Tag modal
      if (tagModalOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setTagModalOpen(false);
          setTagTarget(null);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          await saveTags();
          return;
        }
        return;
      }

      // Edit modal
      if (editOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setEditOpen(false);
          setEditTarget(null);
          return;
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
          e.preventDefault();
          await saveEditText();
          return;
        }
        return;
      }

      // Rename modal
      if (renameOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setRenameOpen(false);
          setRenameTarget(null);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          await saveRenameImage();
          return;
        }
        return;
      }

      // Settings open
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
        setSelectedIndex((i) => Math.min(i + 1, Math.max(0, visibleRef.current.length - 1)));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const it = visibleRef.current[selectedIndex];
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
  }, [settingsOpen, tagModalOpen, editOpen, renameOpen]);

  // Debounced refresh on query typing (keeps backend filter in sync)
  useEffect(() => {
    const t = window.setTimeout(() => refresh(query).catch(() => undefined), 140);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="cv-root" style={rootStyle}>
      <div className="cv-header">
        <div>
          <div className="cv-title">ClipVault</div>
          <div className="cv-subtitle">
            Search <span className="cv-kbd">⌘K</span> • Open <span className="cv-kbd">{shortcutDraft}</span>
          </div>
        </div>

        <div className="cv-actions cv-nodrag">
          <button className="cv-btn cv-nodrag" onClick={() => setSettingsOpen((v) => !v)}>
            Settings
          </button>
          <button className="cv-btn danger cv-nodrag" onClick={onClearAll}>
            Clear All
          </button>
        </div>
      </div>

      <div className="cv-search cv-nodrag">
        <input
          ref={inputRef}
          className="cv-input cv-nodrag"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search text, tags, or image name… (type 'image' to filter images)"
          spellCheck={false}
        />
      </div>

      {settingsOpen && (
        <div className="cv-panel cv-nodrag">
          <div className="cv-panel-title">Settings</div>

          <div className="cv-row">
            <div className="cv-label">Shortcut</div>
            <input
              className="cv-input cv-nodrag"
              value={shortcutDraft}
              onChange={(e) => setShortcutDraft(e.target.value)}
              placeholder="CommandOrControl+Shift+V"
            />
          </div>

          <div className="cv-row">
            <button className="cv-btn cv-nodrag" onClick={saveShortcut}>
              Save Shortcut
            </button>
            <div className="cv-muted">{shortcutMsg}</div>
          </div>

          <div className="cv-row" style={{ marginTop: 12 }}>
            <div className="cv-label">Theme</div>
            <div className="cv-muted">Pick colors (saved)</div>
          </div>

          <div className="cv-row">
            <div className="cv-label">Accent</div>
            <input
              className="cv-nodrag"
              type="color"
              value={theme.accent}
              onChange={(e) => saveTheme({ ...theme, accent: e.target.value })}
            />
          </div>

          <div className="cv-row">
            <div className="cv-label">Danger</div>
            <input
              className="cv-nodrag"
              type="color"
              value={theme.danger}
              onChange={(e) => saveTheme({ ...theme, danger: e.target.value })}
            />
          </div>

          <div className="cv-row">
            <div className="cv-label">Background</div>
            <input
              className="cv-nodrag"
              type="color"
              value={theme.bg}
              onChange={(e) => saveTheme({ ...theme, bg: e.target.value })}
            />
          </div>

          <div className="cv-row">
            <button className="cv-btn cv-nodrag" onClick={() => saveTheme(DEFAULT_THEME)}>
              Reset Theme
            </button>
          </div>
        </div>
      )}

      {/* TAGS MODAL */}
      {tagModalOpen && (
        <div className="cv-modal-backdrop cv-nodrag" onClick={() => setTagModalOpen(false)}>
          <div className="cv-modal cv-nodrag" onClick={(e) => e.stopPropagation()}>
            <div className="cv-panel-title">Edit Tags</div>
            <div className="cv-muted" style={{ marginBottom: 8 }}>
              Comma-separated (example: research, qaoa, notes)
            </div>

            <input
              id="cv-tags-input"
              className="cv-input cv-nodrag"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              placeholder="tag1, tag2, tag3"
            />

            <div className="cv-row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button className="cv-btn cv-nodrag" onClick={() => setTagModalOpen(false)}>
                Cancel
              </button>
              <button className="cv-btn cv-nodrag" onClick={saveTags}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT TEXT MODAL */}
      {editOpen && (
        <div className="cv-modal-backdrop cv-nodrag" onClick={() => setEditOpen(false)}>
          <div className="cv-modal cv-nodrag" onClick={(e) => e.stopPropagation()}>
            <div className="cv-panel-title">Edit Text</div>
            <div className="cv-muted" style={{ marginBottom: 8 }}>
              Tip: Cmd/Ctrl+S to save, Esc to close.
            </div>

            <textarea
              id="cv-edit-textarea"
              className="cv-textarea cv-nodrag"
              value={editDraft}
              onChange={(e) => setEditDraft(e.target.value)}
              rows={8}
            />

            <div className="cv-row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button className="cv-btn cv-nodrag" onClick={() => setEditOpen(false)}>
                Cancel
              </button>
              <button className="cv-btn cv-nodrag" onClick={saveEditText}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RENAME IMAGE MODAL */}
      {renameOpen && (
        <div className="cv-modal-backdrop cv-nodrag" onClick={() => setRenameOpen(false)}>
          <div className="cv-modal cv-nodrag" onClick={(e) => e.stopPropagation()}>
            <div className="cv-panel-title">Rename Image</div>
            <div className="cv-muted" style={{ marginBottom: 8 }}>
              Example: diagram-qaoa.png
            </div>

            <input
              id="cv-rename-input"
              className="cv-input cv-nodrag"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              placeholder="image name"
            />

            <div className="cv-row" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button className="cv-btn cv-nodrag" onClick={() => setRenameOpen(false)}>
                Cancel
              </button>
              <button className="cv-btn cv-nodrag" onClick={saveRenameImage}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="cv-list cv-nodrag">
        {visible.length === 0 ? (
          <div className="cv-empty">No clipboard items yet. Copy text or an image, then open the popup.</div>
        ) : (
          visible.map((item, idx) => (
            <div
              key={item.id}
              className={"cv-item cv-nodrag " + (idx === selectedIndex ? "selected" : "")}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              {item.kind === "image" ? (
                item.imageDataUrl?.startsWith("data:image/") ? (
                  <>
                    <img className="cv-img cv-nodrag" src={item.imageDataUrl} alt={item.imageName ?? "clipboard"} />
                    {item.imageName ? (
                      <div className="cv-item-text" style={{ marginTop: 8 }}>
                        {item.imageName}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="cv-item-text">(Image item is invalid. Please copy the image again.)</div>
                )
              ) : (
                <div className="cv-item-text">{item.text ?? ""}</div>
              )}

              <div className="cv-item-meta">
                <div className="cv-meta-left">
                  <span className="cv-time">Created: {formatTime(item.createdAt)}</span>
                  {item.pinned ? <span className="cv-badge">Pinned</span> : null}
                  {(item.tags ?? []).map((t) => (
                    <span key={t} className="cv-tag">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="cv-meta-right cv-nodrag">
                  <button className="cv-icon cv-nodrag" onClick={() => copyItem(item)}>
                    Copy
                  </button>
                  <button className="cv-icon cv-nodrag" onClick={() => onTogglePin(item)}>
                    {item.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button className="cv-icon cv-nodrag" onClick={() => openTagModal(item)}>
                    Tags
                  </button>

                  {item.kind === "text" ? (
                    <button className="cv-icon cv-nodrag" onClick={() => openEditText(item)}>
                      Edit
                    </button>
                  ) : (
                    <button className="cv-icon cv-nodrag" onClick={() => openRenameImage(item)}>
                      Rename
                    </button>
                  )}

                  <button className="cv-icon danger cv-nodrag" onClick={() => onDelete(item)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="cv-footer cv-nodrag">
        <span>↑/↓ navigate • Enter copy • Esc close</span>
        <span>Drag anywhere on glass to move</span>
      </div>

      {toast && <div className="cv-toast">{toast}</div>}
    </div>
  );
}