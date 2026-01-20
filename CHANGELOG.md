# Changelog

All notable changes to the **Quantum Clipboard** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Planned
- Cloud Sync Architecture (Self-hosted implementation)
- Integration with local AI models for content analysis

## [0.1.2] - 2026-01-20
### Added
- **Advanced Theming Engine:** Users can now customize the visual aspects of the clipboard manager.
    - Added global item card styling (border color, background color).
    - Added typography controls (primary text color, muted/secondary text color).
    - Added control block styling (background, border, and text colors).
- **Live Theme Updates:** Theme changes are applied instantly in the renderer without requiring an app restart.
- **Categorized Settings:** Redesigned Settings panel with distinct sections: *General*, *Shortcut*, *Language*, *Theme*, *Items*, and *Controls*.
- **Localization:** Improved Khmer (km) translations for new theme settings.

### Changed
- **UI/UX:** Improved layout density in the Settings panel for better readability.
- **Persistence:** Theme values are now saved via the backend settings engine and persist across sessions.
- **Homebrew:** Updated installation instructions to support the custom tap `muyleanging/quantum-clipboard`.

### Fixed
- Fixed flickering issues when switching between light and dark color values.
- Resolved minor layout alignment issues in the "Controls" settings tab.

## [0.1.0] - 2026-01-12
### Added
- Initial release of Quantum Clipboard.
- Basic clipboard history functionality.
- macOS native integration.
- Bilingual support (English / Khmer).
- Global hotkey support.

### Security
- Added `xattr` quarantine removal instructions for macOS Gatekeeper.

---
*Maintained by [Muyleang Ing](https://github.com/muyleanging).*