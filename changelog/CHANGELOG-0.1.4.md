# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-01-22

### Added
- macOS-style window controls (close, minimize, focus-safe buttons)
- Launch at startup option (start app when system boots)
- Configurable auto-close behavior after copy
  - Close immediately
  - Close after delay (1s, 2s, or custom milliseconds)
- Background theme control with live preview
- Persistent theme settings across restarts

### Fixed
- Background not filling entire window area
- Theme color not applying to empty space when no clipboard items exist
- Focus loss when copying clipboard content
- Popup closing unexpectedly during user interaction
- Drag region conflicts with inputs and buttons
- Clipboard copy interrupting UI refresh

### Improved
- Cleaner and more compact Settings panel layout
- Better visual hierarchy and spacing
- More consistent styling across header, list, and footer
- Improved keyboard navigation reliability
- Reduced visual noise and unused spacing
- More predictable popup focus behavior

### Behavior
- Popup can remain open even after copying (configurable)
- Focus is preserved while copying items
- Close-on-blur behavior is optional
- Delay-based auto-close fully configurable

---

## [0.1.3] - 2026-01-18

### Added
- Clipboard history (text & images)
- Tagging and pinning support
- Search by text, tag, or image name
- Keyboard navigation (↑ ↓ Enter Esc)
