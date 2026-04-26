# Publish GitHub Release (after local builds)

Run these on a machine with `git` and `gh` authenticated to [vapehe/slumpen](https://github.com/vapehe/slumpen).

## 0. Install and log in to GitHub CLI (`gh`)

If `gh release create` fails with **command not found**, install `gh` first.

**Ubuntu / Debian (APT):**

```bash
sudo apt update
sudo apt install -y gh
gh --version
```

Other distros and newer packages: [Installing gh on Linux](https://github.com/cli/cli/blob/trunk/docs/install_linux.md).

Then authenticate once (browser or token flow):

```bash
gh auth login
```

Confirm you can reach the repo:

```bash
gh repo view vapehe/slumpen
```

## 1. Push commit and tag

From the repo root (after `chore: bump version to 1.0.0` is committed and tag `v1.0.0` exists):

```bash
git push origin main
git push origin v1.0.0
```

If the tag was only local: `git tag -a v1.0.0 -m "Slumpen 1.0.0"` (skip if tag already exists).

## 2. Create release with Linux artifacts

Paths assume `pnpm tauri build` wrote bundles under `src-tauri/target/release/bundle/` (default when `CARGO_TARGET_DIR` is unset).

```bash
gh release create v1.0.0 \
  --title "Slumpen 1.0.0" \
  --notes-file RELEASE_NOTES.md \
  src-tauri/target/release/bundle/deb/Slumpen_1.0.0_amd64.deb \
  src-tauri/target/release/bundle/rpm/Slumpen-1.0.0-1.x86_64.rpm \
  src-tauri/target/release/bundle/appimage/Slumpen_1.0.0_amd64.AppImage
```

## 3. Windows host: upload installers

See [release-windows-manual.md](release-windows-manual.md). After building:

```powershell
gh release upload v1.0.0 `
  src-tauri\target\release\bundle\msi\Slumpen_1.0.0_x64_en-US.msi `
  src-tauri\target\release\bundle\nsis\Slumpen_1.0.0_x64-setup.exe
```

Update `RELEASE_NOTES.md` and/or the GitHub release body with Windows SHA-256 hashes from `Get-FileHash`.
