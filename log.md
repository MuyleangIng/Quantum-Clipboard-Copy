### Cleaned Terminal Workflow (for macOS arm64 release)

```bash
# 1. Clean previous build artifacts (safe to run)
rm -rf dist "Quantum Clipboard.app" Quantum-Clipboard.app.zip

# 2. Re-build the app (creates dist/ with the .dmg)
npm run dist

# 3. Attach (mount) the generated DMG
#    (adjust version if needed — use tab completion or ls dist/ to check exact name)
hdiutil attach dist/Quantum\ Clipboard-*-arm64.dmg

# 4. Copy the .app bundle to current directory
cp -R "/Volumes/Quantum Clipboard 0.1.0-arm64/Quantum Clipboard.app" .

# 5. Unmount the DMG
hdiutil detach "/Volumes/Quantum Clipboard 0.1.0-arm64" 2>/dev/null

# 6. Remove quarantine flag so the app can run without Gatekeeper warning
xattr -dr com.apple.quarantine "Quantum Clipboard.app"

# 7. (Optional) Test launch
open "Quantum Clipboard.app"

# 8. Create ZIP for Homebrew / GitHub release
zip -r Quantum-Clipboard.app.zip "Quantum Clipboard.app"

# 9. Generate SHA256 checksum (copy this value!)
shasum -a 256 Quantum-Clipboard.app.zip

# ────────────────────────────────────────────────
# Next steps (do these outside terminal):
# ────────────────────────────────────────────────
# 1. Upload Quantum-Clipboard.app.zip to GitHub Releases (tag v0.1.1)
# 2. Create/edit Casks/quantum-clipboard.rb in your tap repo:
#      - version "0.1.1"
#      - sha256 "paste-the-hash-here"
#      - url "https://github.com/MuyleangIng/clipvault/releases/download/v0.1.1/Quantum-Clipboard.app.zip"
# 3. Commit & push the Cask file
```

### One-liner version (if you want to chain most steps)

```bash
rm -rf dist "Quantum Clipboard.app" Quantum-Clipboard.app.zip && \
npm run dist && \
hdiutil attach dist/Quantum\ Clipboard-*-arm64.dmg && \
cp -R "/Volumes/Quantum Clipboard 0.1.0-arm64/Quantum Clipboard.app" . && \
hdiutil detach "/Volumes/Quantum Clipboard 0.1.0-arm64" 2>/dev/null && \
xattr -dr com.apple.quarantine "Quantum Clipboard.app" && \
zip -r Quantum-Clipboard.app.zip "Quantum Clipboard.app" && \
shasum -a 256 Quantum-Clipboard.app.zip
```

### Quick checklist after this

- You have `Quantum-Clipboard.app.zip` ready
- You have the SHA256 hash
- App launches without errors (after xattr)
- Ready to create GitHub release + update Homebrew cask

If you want a shell script version (e.g. `release-macos-arm64.sh`) that does all this automatically (with version as argument), just tell me — I can write it for you.

Let me know what’s next (e.g. the Cask file content, release notes, universal build, etc.)! 🚀