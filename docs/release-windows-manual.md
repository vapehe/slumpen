# Windows release build (manual, v1.0.0+)

Developer-facing steps to produce `.msi` and NSIS `-setup.exe` on a Windows 10/11 x64 host. End-user UI stays Swedish in the app; this doc is English for maintainers.

## One-time prerequisites

1. **Rust** – install from [https://www.rust-lang.org/tools/install](https://www.rust-lang.org/tools/install) (`rustup`, stable toolchain).
2. **Microsoft C++ Build Tools** – Visual Studio Installer → workload **Desktop development with C++**.
3. **WebView2** – Windows 11 includes the Evergreen runtime; on Windows 10 install the [Evergreen WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if needed.
4. **Node.js** ≥ 20 and **pnpm** – e.g. `npm install -g pnpm`.

## Build from the release tag

```powershell
git clone https://github.com/vapehe/slumpen.git
cd slumpen
git fetch origin tag v1.0.0
git checkout v1.0.0

pnpm install
pnpm test:run
pnpm check
pnpm tauri build
```

## Output paths (adjust version if needed)

- NSIS: `src-tauri\target\release\bundle\nsis\Slumpen_1.0.0_x64-setup.exe`
- WiX MSI: `src-tauri\target\release\bundle\msi\Slumpen_1.0.0_x64_en-US.msi`

## Smoke test (unsigned)

1. Copy both installers to a normal user account (or VM).
2. Run the `.exe` installer first; complete install and launch **Slumpen**.
3. If SmartScreen blocks: **More info** → **Run anyway** (expected for unsigned builds).
4. Repeat a minimal smoke path: open app, import a small CSV, verify UI loads.
5. Optionally test the `.msi` on a clean machine or after uninstalling the NSIS install.

## Attach to GitHub Release

After Linux artifacts are on release `v1.0.0`:

```powershell
gh release upload v1.0.0 `
  src-tauri\target\release\bundle\msi\Slumpen_1.0.0_x64_en-US.msi `
  src-tauri\target\release\bundle\nsis\Slumpen_1.0.0_x64-setup.exe
```

Then compute SHA-256 and add them to `RELEASE_NOTES.md` / the GitHub release description:

```powershell
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64-setup.exe
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64_en-US.msi
```
