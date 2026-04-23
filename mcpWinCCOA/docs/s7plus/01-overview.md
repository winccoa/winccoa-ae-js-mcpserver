# S7Plus-Treiber — Überblick

## Was ist S7Plus?

S7Plus ist das Kommunikationsprotokoll für Siemens S7-1200 und S7-1500 SPSen (Speicherprogrammierbare Steuerungen). In WinCC OA stellt der S7Plus-Treiber (`WCCOAs7plusdrv`) die native Verbindung zu diesen SPSen her.

S7Plus unterstützt **keine** Legacy-Geräte wie S7-300/400 — diese benötigen den klassischen S7-Treiber.

## Unterstützte SPS-Typen

| SPS-Typ | Wert | Beschreibung |
|---------|------|-------------|
| Automatic | 1 | Auto-Erkennung aus TIA Portal Projekt |
| RH | 2 | Redundant High Availability (zwei SPSen). System-IP verwenden. |
| RH_Single | 3 | Einzelne SPS in einem R/H-System. Individuelle CPU-IP verwenden. |
| S7_1500 | 16 | Siemens S7-1500 |
| S7_1200 | 272 | Siemens S7-1200 |
| S7_1500_SoftCtrl | 528 | S7-1500 Software Controller (virtuelle SPS) |
| PLCSim | 768 | PLCSIM Simulationsumgebung |

**Häufiger Fehler:** PLCSim (768) und S7_1500 (16) werden oft verwechselt. Wenn die Verbindung `Failure` zeigt, als erstes den SPS-Typ prüfen.

## Grundkonzepte

### Symbolische Adressierung
S7Plus verwendet **symbolische Adressen** (z.B. `"MyDB.MyVar"`, `"DataBlock1.Temperature"`) statt numerischer Byte/Bit-Adressen. Diese entsprechen den Variablennamen im TIA Portal Projekt.

### Verbindungsdatenpunkte
Jede S7Plus-Verbindung wird als WinCC OA Datenpunkt vom Typ `_S7PlusConnection` abgebildet. Der Datenpunkt enthält Unterelemente für Konfiguration (`Config.*`), Kommandos (`Command.*`) und Status (`State.*`).

### Treiberverwaltung
Der S7Plus-Treiber läuft als WinCC OA Manager-Prozess (`WCCOAs7plusdrv`). Jede Treiberinstanz wird durch eine **Treibernummer** (1-99) identifiziert. Mehrere Verbindungen können sich eine Treiberinstanz teilen.

**Wichtig:** Der S7Plus-Treiber muss in Pmon registriert sein, bevor Verbindungen erstellt werden können.

### Treibernummern
Treibernummern (1-99) identifizieren die Treiberinstanz. Sie werden projekt-weit über alle Treibertypen geteilt — eine Nummer, die von einem anderen Treiber (z.B. Simulation) verwendet wird, kann nicht gleichzeitig für S7Plus genutzt werden.

### CheckConn
Jede Verbindung benötigt eine interne `CheckConn`-Adresskonfiguration. Dies ist ein Kontrollmechanismus, den WinCC OA zur Überwachung der Verbindungsgesundheit nutzt. CheckConn wird automatisch bei der Verbindungserstellung konfiguriert.

### _S7PlusConfig — Globaler Konfigurationsdatenpunkt
`_S7PlusConfig` ist ein Systemdatenpunkt, der **einmal pro WinCC OA Projekt** existiert (nicht pro Verbindung). Er speichert:

- `CaCertificates` — TLS CA-Zertifikats-Vertrauensliste (für alle S7Plus-Verbindungen)
- `Subscriptions.Names` — registrierte Subscription-Pollgruppen-Namen
- `Subscriptions.Pollgroups` — Pollgruppen-Datenpunkt-Referenzen
- `Subscriptions.Options` — Subscription-Optionen (z.B. onlyChanges-Flags)

## S7Plus Features

- **Symbolische Adressierung** — Variablennamen statt Byte/Bit-Adressen
- **Subscription-Modus** über `_S7PlusConfig.Subscriptions` — ereignisgesteuerte Updates von der SPS
- **TIA Portal Browsing** — online (laufende SPS) und offline (TIA Export)
- **TIA-Projekt-Erkennung** — automatische Auflistung von Exports und Stationen
- **Zeitsynchronisation** zwischen SPS und WinCC OA
- **Redundanzumschaltung** mit verschiedenen Bedingungen (OpState, ConnState, SwitchTag)
- **TLS-Zertifikatsverwaltung** auf Treiberebene
- **Drei-Schritt-Adresskonfiguration** (`_distrib` → `_address` → `_active`)
