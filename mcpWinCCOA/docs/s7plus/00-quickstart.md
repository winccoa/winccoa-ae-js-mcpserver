# S7Plus Quickstart — End-to-End Workflow

Schritt-für-Schritt-Anleitung: von einem leeren WinCC OA Projekt bis zum Empfang von SPS-Werten über den S7Plus-Treiber.

## Voraussetzungen

1. **WinCC OA Projekt läuft** mit Event Manager und Data Manager
2. **S7Plus-Treiber ist in Pmon registriert** (WinCC OA Console)
3. **SPS ist im Netzwerk erreichbar** (Ping-Test)
4. **TIA Portal Export** ist im Projektverzeichnis vorhanden (nur für Offline-Browse)
5. **Datenpunkte existieren** in WinCC OA, um SPS-Werte zu empfangen

## Schritt 1: S7Plus-Treiber registrieren

Der S7Plus-Treiber (`WCCOAs7plusdrv`) muss in Pmon registriert sein, bevor Verbindungen erstellt werden können.

1. WinCC OA Console öffnen
2. Neuen Manager vom Typ `WCCOAs7plusdrv` hinzufügen
3. Kommandozeilenoptionen setzen: `-num 1` (Treibernummer)
4. Startmodus: `always` (automatischer Neustart bei Absturz)

Der Treiber muss nicht manuell gestartet werden — er wird automatisch gestartet, wenn eine Verbindung erstellt wird.

## Schritt 2: Verbindung erstellen

### Online-Verbindung (zu einer laufenden SPS)

Einen `_S7PlusConnection` Datenpunkt erstellen und konfigurieren:

```
Config.Address          = "192.168.1.100"
Config.PLCType          = 16               (S7-1500)
Config.DrvNumber        = 1
Config.AccessPoint      = "S7ONLINE"
Config.EstablishmentMode = 1               (AutomaticActive)
Command.Enable          = true
```

### Offline-Verbindung (zu einem TIA Portal Export)

```
Config.Address          = "0.0.0.0"
Config.PLCType          = 1                (Automatic)
Config.DrvNumber        = 1
Config.StationName      = "MyExport|PLC_1"
Config.EstablishmentMode = 0               (Inactive)
```

## Schritt 3: Verbindungsstatus prüfen

Den Wert von `_S7PlusConnection1.State.ConnState` prüfen:

| Wert | Bedeutung |
|------|-----------|
| 0 | Inaktiv |
| 1 | Getrennt |
| 2 | Verbindungsaufbau |
| **3** | **Verbunden** (Zielzustand) |
| 4 | Verbindungsabbau |
| 5 | Fehler |

Bei `Failure` (5) prüfen:
- Stimmt die IP-Adresse?
- Passt der SPS-Typ? (PLCSim=768, S7-1500=16)
- Blockiert eine Firewall TCP Port 102?

## Schritt 4: SPS-Struktur browsen

Über den Browse-Mechanismus des S7Plus-Treibers die verfügbaren Variablen der SPS ermitteln. Der Browse liefert für jede Variable:

- `path` — der symbolische Pfad (wird als `_reference` in der Adresskonfiguration verwendet)
- `valueType` — der SPS-Datentyp (hilft bei der Wahl der Transformation)
- `hasChildren` — ob tiefer navigiert werden kann

Beispiel-Ergebnis:
```
path:        "DataBlock1.Temperature"
valueType:   "Real"
hasChildren: false
```

## Schritt 5: Datenpunkte in WinCC OA anlegen

Die Ziel-Datenpunkte müssen in WinCC OA existieren, bevor Adressen konfiguriert werden. Anlegen über das PARA-Modul oder per CTRL-Script. Der WinCC OA Datentyp sollte zum SPS-Typ passen:

| SPS-Typ | WinCC OA Typ |
|---------|--------------|
| Bool | bool |
| Int, DInt, USInt, UInt, etc. | int |
| Real | float |
| LReal | float |
| String, WString | string |
| Date, DateTime, Time | time |

## Schritt 6: Adresse konfigurieren

Die Adresskonfiguration verknüpft ein Datenpunktelement (DPE) mit einer SPS-Variable. Die Konfiguration erfolgt über `_address` und `_distrib` am DPE.

### Polling (zyklisches Lesen/Schreiben)

```
_distrib:
  _type   = DPCONFIG_DISTRIBUTION_INFO
  _driver = 1

_address:
  _type       = DPCONFIG_PERIPH_ADDR_MAIN
  _drv_ident  = "S7PLUS"
  _connection = "_S7PlusConnection1"
  _reference  = "DataBlock1.Temperature"
  _direction  = 7                          (IOPoll)
  _datatype   = 1001                       (DEFAULT = Auto-Erkennung)
  _poll_group = "_S7Plus_Poll_1s"
  _active     = true                       (MUSS separat gesetzt werden!)
```

### Subscription (ereignisgesteuert, nur bei Änderung)

Gleich wie Polling (Direction 7), aber zusätzlich Registrierung in `_S7PlusConfig.Subscriptions`. Der Unterschied liegt nicht in der Direction, sondern in der Subscription-Registrierung.

### Nur Schreiben (Sollwerte an die SPS senden)

```
_address:
  _direction = 1                           (Output)
```

## Schritt 7: Datenfluss verifizieren

Nach der Adresskonfiguration sollte WinCC OA SPS-Werte empfangen. Prüfung über:
- **PARA-Modul** (Datenpunktwert kontrollieren)
- **CTRL-Script** mit `dpGet()` oder `dpConnect()`
- **GEDI-Modul** (Panel mit dem Datenpunkt erstellen)

## Häufige Fehler

| Fehler | Symptom | Lösung |
|--------|---------|--------|
| Falscher SPS-Typ | Verbindung zeigt `Failure` | Korrekten Typ verwenden (16=S7-1500, 768=PLCSim) |
| Kein S7Plus-Treiber in Pmon | Verbindung kann nicht aufgebaut werden | `WCCOAs7plusdrv` in WinCC OA Console hinzufügen |
| DPE existiert nicht | Adresskonfiguration schlägt fehl | Datenpunkt zuerst in PARA anlegen |
| Falscher symbolischer Pfad | Keine Daten kommen an | Browse verwenden um korrekten Pfad zu finden |
| Subscription ohne Registrierung | Verhält sich wie Polling | In `_S7PlusConfig.Subscriptions` registrieren |
| `_active` zusammen mit `_address` gesetzt | Race Condition, fehlerhafte Daten | `_active` immer in separatem `dpSetWait` setzen |

## Komplettbeispiel: Temperaturüberwachung

```
1. Treiber registrieren:
   WCCOAs7plusdrv in Pmon mit -num 1 hinzufügen

2. Datenpunkt anlegen:
   "Furnace.Temperature.actual" in WinCC OA (Typ: float)

3. Verbindung erstellen:
   _S7PlusConnection1 mit IP 192.168.1.100, PLCType 16, DrvNumber 1

4. Verbindung prüfen:
   State.ConnState = 3 (Connected)

5. Variable finden:
   Browse → path="FurnaceDB.Temperature", valueType="Real"

6. Adresse konfigurieren:
   Am DPE "Furnace.Temperature.actual":
   _distrib: _driver=1
   _address: _drv_ident="S7PLUS", _connection="_S7PlusConnection1",
             _reference="FurnaceDB.Temperature", _direction=7,
             _datatype=1015 (REAL), _poll_group="_S7Plus_Subscr"
   _active: true (separater dpSetWait)
   In _S7PlusConfig.Subscriptions registrieren für Subscription-Modus

7. WinCC OA empfängt jetzt Temperatur-Updates von der SPS bei jeder Wertänderung.
```
