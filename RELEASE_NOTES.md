# Slumpen 1.0.0

Första stabila utgåvan för skrivbord (Windows och Linux).

## Nytt i 1.0.0

- Första versionsnummer för distribution (ingen tidigare binär release).
- Samma funktioner som i utvecklingsgrenen: CSV-import, tombola-dragning med reproducerbart frö, PDF-protokoll, slumpmässighetstester och lokal SQLite.

## Vilken fil ska jag ladda ner?

### Windows

- **`Slumpen_1.0.0_x64-setup.exe`** (NSIS) – rekommenderas för de flesta användare; dubbelklicka och följ guiden.
- **`Slumpen_1.0.0_x64_en-US.msi`** (WiX) – lämpligare om IT/admin ska rulla ut paketet (t.ex. Intune/GPO).

Windows-artefakter läggs upp på samma GitHub Release när de byggts på en Windows-maskin (se `docs/release-windows-manual.md` i repot).

### Linux

- **`.AppImage`** – om du inte vet om du kör Debian eller Fedora: en fil, gör den körbar (`chmod +x …`) och starta. Fungerar på många x86_64-distributioner.
- **`.deb`** – Debian, Ubuntu, Mint m.fl.: `sudo apt install ./Slumpen_1.0.0_amd64.deb`
- **`.rpm`** – Fedora, openSUSE, RHEL m.fl.: `sudo dnf install ./Slumpen-1.0.0-1.x86_64.rpm` (eller motsvarande kommando för din distro)

## SmartScreen (Windows, osignerad build)

Installern är **inte kodsignerad** i denna release. Windows kan visa *”Windows skyddade din dator”* eller liknande.

1. Klicka på **Mer information** / **More info**.
2. Välj **Kör ändå** / **Run anyway**.

Appen är **öppen källkod** (MIT). Vill du inte lita på den nedladdade binären kan du bygga själv från taggen `v1.0.0` i repot [vapehe/slumpen](https://github.com/vapehe/slumpen).

## Filer och dialogrutor

- **Importera CSV** och **spara PDF** använder systemets vanliga filväljare. Välj var filen ligger respektive vart du vill spara – samma som i andra skrivbordsprogram.
- På **Linux** beror exakt beteende på skrivbordsmiljö (GNOME, KDE, …). Om något känns konstigt, prova AppImage från en terminal så ser du ev. felmeddelanden i terminalen.

## Kontrollsummor (SHA-256)

Verifiera nedladdade filer mot listan nedan (minskar risken för korrupt nedladdning).

### Linux (byggda för denna release)

```
bb969985bc74feb99b59f0a733c9cb897d9cf479e1dc756821ee3b82e33195a6  Slumpen_1.0.0_amd64.deb
1819e38c6bf6ee0a1c514cb46678659ea643673ef05ec66aa26cc55536a6531a  Slumpen-1.0.0-1.x86_64.rpm
7961fbdc845247cd8ba79ecdb8e01354e2951b3c6fe31c55ab26da831ed182d7  Slumpen_1.0.0_amd64.AppImage
```

På Linux: `sha256sum -c` mot en fil med ovanstående rader (filnamn i samma katalog som artefakterna).

### Windows

Kör efter att du laddat ner `.exe` och `.msi` från GitHub Release:

```powershell
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64-setup.exe
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64_en-US.msi
```

Jämför med värden som publiceras i release-inlägget när Windows-filerna är uppladdade.

## Källkod

Tag: `v1.0.0` – [https://github.com/vapehe/slumpen](https://github.com/vapehe/slumpen)
