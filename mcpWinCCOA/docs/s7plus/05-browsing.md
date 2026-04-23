# S7Plus SPS-Browsing

## Überblick

Die Browse-Funktionalität ermöglicht die Navigation durch die Variablenstruktur der SPS. Damit werden verfügbare Datenbausteine, Tags und deren Typen ermittelt. Dies ist essenziell für die Adresskonfiguration, da der exakte symbolische Pfad der SPS-Variable benötigt wird.

## Browse-Modi

### Online-Browse
Verbindet sich mit einer laufenden SPS und liest deren aktuelle Variablenstruktur in Echtzeit.

**Voraussetzungen:**
- Verbindung muss im Status `Connected` sein
- SPS muss über das Netzwerk erreichbar sein
- `Config.StationName` muss `"S7Plus$Online|Online"` enthalten

### Offline-Browse
Liest die Variablenstruktur aus einem TIA Portal Export im WinCC OA Projekt. Erfordert keine laufende SPS.

**Voraussetzungen:**
- TIA Portal Projekt muss aus TIA Portal exportiert und im Datenverzeichnis des WinCC OA Projekts abgelegt sein
- `Config.StationName` muss `"ExportName|Stationsname"` enthalten
- Die `.zip`-Endung wird automatisch entfernt

### Root-Browse
Listet verfügbare TIA Portal Exports auf der obersten Ebene. Verwende dies zuerst um herauszufinden, welche Exports vorhanden sind.

### AccessPoints-Browse
Listet verfügbare Zugangspunkte für die S7Plus-Kommunikation.

## Browse-Pfadkonstruktion

Intern konstruiert das Browse-System pipe-getrennte Pfade für den S7Plus-Treiber:

| Modus | Internes Pfadmuster |
|-------|-------------------|
| Online (ohne Kategorie) | `S7Plus$Online` |
| Online (Kategorie=All) | `S7Plus$Online\|Online` |
| Online (Kategorie=Blocks) | `S7Plus$Online\|Online\|Blocks` |
| Online (tief) | `S7Plus$Online\|Online\|Blocks\|MyDB\|SubStruct` |
| Offline (Root) | `MyExport\|PLC_1` |
| Offline (Kategorie) | `MyExport\|PLC_1\|Blocks` |
| Root | (leerer String) |
| AccessPoints | `S7Plus$AccessPoints` |

Die `.zip`-Endung wird automatisch von TIA-Exportnamen entfernt.

## Kategorie-Filter

| Kategorie | Beschreibung |
|-----------|-------------|
| All | Alles anzeigen (Standard) |
| Blocks | Datenbausteine, Funktionsbausteine, Organisationsbausteine |
| Tags | SPS-Tags (globale Variablen) |
| Types | Benutzerdefinierte Datentypen (UDTs) |
| Alarms | SPS-Alarmdefinitionen |

## Paginierung

Browse-Ergebnisse werden paginiert. Maximum pro Seite: **800 Knoten**.

Ergebnis-Struktur:
```
nodes:      [...]              Knoten der aktuellen Seite
totalNodes: 1500               Gesamtzahl verfügbarer Knoten
hasMore:    true               Weitere Seiten vorhanden
nextOffset: 800                Offset für nächste Seite (null wenn keine)
isPartial:  true               Ergebnis wurde abgeschnitten
warning:    "showing 1-800 of 1500"   Lesbare Meldung
```

## Navigation in die Tiefe

Um in die Kinder eines Knotens zu navigieren, wird der Pfad erweitert:

```
1. Datenbausteine auflisten:
   Pfad: S7Plus$Online|Online|Blocks
   → Ergebnis enthält: path="MyDB", hasChildren=true

2. In MyDB navigieren:
   Pfad: S7Plus$Online|Online|Blocks|MyDB
   → Ergebnis enthält: path="MyDB.SubStruct", hasChildren=true

3. Tiefer navigieren:
   Pfad: S7Plus$Online|Online|Blocks|MyDB|SubStruct
   → Ergebnis enthält: path="MyDB.SubStruct.Temperature", hasChildren=false
```

## Browse-Ergebnis-Format

Jeder Browse-Knoten enthält:

| Feld | Beschreibung |
|------|-------------|
| path | Symbolischer Pfad (als `_reference` in der Adresskonfiguration verwenden) |
| comment | Beschreibung aus dem TIA Portal Projekt |
| systemType | SPS-Systemtyp-Identifier |
| valueType | Datentyp (z.B. "Int", "Real", "Bool", "String") |
| itemLength | Stringlänge bei STRING/WSTRING (0 bei anderen Typen) |
| hasChildren | Wenn true, kann tiefer navigiert werden |

## TIA-Projekt-Erkennung

Zum automatisierten Erkennen verfügbarer TIA Portal Exports:

1. Temporäre Offline-Verbindung erstellen (IP 0.0.0.0, PLCType Automatic)
2. Root-Browse durchführen → listet alle TIA Exports
3. Für jeden Export: Stationsname setzen und nach enthaltenen Stationen browsen
4. Ergebnis: Exportnamen und deren Stationen
5. Temporäre Verbindung aufräumen

Ergebnis-Beispiel:
```
Exports:
  - Name: MyTIAProject_Export
    Stationen: [PLC_1, PLC_2]
  - Name: AnotherExport
    Stationen: [CPU_315]
```

## Timeout-Schutz

Browse-Operationen haben ein **60-Sekunden-Timeout**. Wenn die SPS nicht rechtzeitig antwortet:
- Browse wird abgebrochen
- Ressourcen werden aufgeräumt
- Fehler wird zurückgegeben

## Typischer Browse-Workflow

```
1. TIA Exports ermitteln (bei Offline-Modus):
   Root-Browse → Exportnamen und Stationen herausfinden

2. Oberste Struktur browsen:
   Online/Blocks oder Offline/Blocks → verfügbare Datenbausteine sehen

3. In Datenbausteine navigieren:
   Pfad erweitern um "MyDB" → Variablen im Baustein sehen

4. Variable finden:
   Ergebnis: path="MyDB.Temperature", valueType="Real"

5. Adresse konfigurieren:
   _reference="MyDB.Temperature" am gewünschten DPE setzen
```
