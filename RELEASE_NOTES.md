# Slumpen 1.0.0

Första stabila utgåvan för skrivbord (Windows och Linux).

## Nytt i 1.0.0

- Första versionsnummer för distribution (ingen tidigare binär release).
- Samma funktioner som i utvecklingsgrenen: CSV-import, tombola-dragning med reproducerbart frö, PDF-protokoll, slumpmässighetstester och lokal SQLite.

## Vilken fil ska jag ladda ner?

**Tips:** På [Slumpen · Releases](https://github.com/vapehe/slumpen/releases) ser du exakt **vilka filer som ligger som bilagor** på varje version. Här är vad filnamnen betyder när de dyker upp där.

### Windows

De byggs endast på en Windows-maskin; de kan alltså **saknas** i releasen tills någon laddat upp dem.

När (eller om) de finns i releasen är detta förväntade filnamn:

- **`Slumpen_1.0.0_x64-setup.exe`** (NSIS) – rekommenderas för de flesta; dubbelklicka och följ guiden.
- **`Slumpen_1.0.0_x64_en-US.msi`** (WiX) – ofta bättre om IT ska rulla ut (t.ex. Intune/GPO).

**Saknas Windows-filerna?** Bygg från källkod enligt [`docs/release-windows-manual.md`](https://github.com/vapehe/slumpen/blob/v1.0.0/docs/release-windows-manual.md) i repot, eller använd Linux-paket om du bara kör Linux.

### Linux

Kontrollera att motsvarande fil finns under releasen innan du laddar ner.

- **`.AppImage`** (`Slumpen_1.0.0_amd64.AppImage`) – osäker på Debian vs Fedora: en fil, `chmod +x …`, starta. Fungerar på många x86_64-distributioner.
- **`.deb`** – Debian, Ubuntu, Mint m.fl.: `sudo apt install ./Slumpen_1.0.0_amd64.deb`
- **`.rpm`** – Fedora, openSUSE, RHEL m.fl.: `sudo dnf install ./Slumpen-1.0.0-1.x86_64.rpm` (eller motsvarande för din distribution)

## SmartScreen (Windows, osignerad build)

Gäller när du installerar **Windows-versionen** ovan. Installern är **inte kodsignerad** i denna release. Windows kan visa *”Windows skyddade din dator”* eller liknande.

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

**När** `.exe` och `.msi` finns i releasen kan du verifiera dem så här efter nedladdning:

```powershell
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64-setup.exe
Get-FileHash -Algorithm SHA256 .\Slumpen_1.0.0_x64_en-US.msi
```

Jämför med **SHA-256 som listas i release-inlägget** (läggs till när Windows-artefakterna publiceras). Om filerna saknas i releasen finns inget att jämföra mot här.

## Källkod

Tag: `v1.0.0` – [https://github.com/vapehe/slumpen](https://github.com/vapehe/slumpen)
