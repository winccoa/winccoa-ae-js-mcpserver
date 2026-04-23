# S7Plus Architektur in WinCC OA

## Systemarchitektur

```
┌─────────────────────────────────────────┐
│  WinCC OA Runtime                       │
│  ├── Event Manager                      │
│  ├── Data Manager                       │
│  ├── S7Plus-Treiber (WCCOAs7plusdrv)   │
│  └── Pmon (Process Monitor)            │
└─────────────────────────────────────────┘
         │                    │
         │ dpSetWait/dpGet    │ S7Plus-Protokoll (TCP 102)
         ▼                    ▼
   WinCC OA Datenpunkte    Siemens SPS (S7-1200/1500)
```

## Ablauf: Verbindung erstellen

```
1. S7Plus-Treiber in Pmon prüfen
   - Ist ein Treiber mit der gewünschten Nummer registriert?
   - Wenn ja: verwenden (starten falls gestoppt)
   - Wenn nein: Fehler — Treiber muss erst registriert werden

2. _S7PlusConnection Datenpunkt erstellen

3. Config-Werte setzen
   - Config.Address, Config.PLCType, Config.DrvNumber, ...
   - Config.EstablishmentMode, Timeouts, TLS, Redundanz

4. CheckConn konfigurieren (Drei-Schritt)
   - _distrib → _address → _active

5. Verbindung aktivieren
   - Config.EstablishmentMode = 1 (AutomaticActive)
   - Command.Enable = true

6. S7Plus-Treiber verbindet sich zur SPS
   - State.ConnState wechselt auf 3 (Connected)
```

## Ablauf: Adresse konfigurieren

```
1. DPE-Existenz in WinCC OA prüfen

2. Modus bestimmen (Polling vs. Subscription)

3. Pollgruppe erstellen falls nötig
   - _PollGroup Datenpunkt mit PollInterval

4. Bei Subscription: in _S7PlusConfig registrieren
   - Subscriptions.Names, Pollgroups, Options (synchron halten)

5. Adresse konfigurieren (Drei-Schritt)
   - Schritt 1: dpSetWait → _distrib
   - Schritt 2: dpSetWait → _address (ohne _active)
   - Schritt 3: dpSetWait → _active = true

6. S7Plus-Treiber beginnt SPS-Variable zu lesen
   - DPE-Wert im Data Manager wird aktualisiert
```

## Drei-Schritt-Adressmuster

Dieses fundamentale Muster gilt für alle Adresskonfigurationen in WinCC OA:

```
Schritt 1: _distrib     → Weist das DPE einem bestimmten Treiber zu
Schritt 2: _address     → Konfiguriert wie die SPS-Variable gelesen/geschrieben wird
Schritt 3: _active=true → Aktiviert die Adresse (MUSS separater dpSetWait sein)
```

**Warum ist _active separat?**
WinCC OA verarbeitet _address-Änderungen wenn _active auf true wechselt. Werden beide gleichzeitig gesetzt, kann der Treiber eine unvollständig konfigurierte Adresse verwenden — Fehler oder Datenverfälschung sind die Folge.

## Pmon (Process Monitor)

Pmon ist der Prozessmanager von WinCC OA. Der S7Plus-Treiber interagiert mit Pmon für:

- **Manager auflisten**: Welche S7Plus-Treiber sind registriert und laufen
- **Treibernummern auslesen**: `-num` Parameter aus der Manager-Kommandozeile
- **Gestoppte Treiber starten**: Registrierte aber gestoppte Treiber starten
- **Konflikte erkennen**: Sicherstellen, dass Treibernummern nicht mit anderen Treibern kollidieren

### Treiber registrieren

Der S7Plus-Treiber wird in Pmon wie folgt registriert:

```
Manager:     WCCOAs7plusdrv
Position:    (Position in der Startreihenfolge)
Startmodus:  always (automatischer Neustart bei Absturz)
Optionen:    -num 1 (Treibernummer)
SecKill:     30 (Sekunden bis SIGKILL)
RestartCount: 3 (Neustartversuche)
ResetMin:    5 (Minuten zum Zurücksetzen des Neustartzählers)
```

## Wichtige WinCC OA Datenpunkte für S7Plus

| Datenpunkt | Typ | Geltungsbereich | Zweck |
|-----------|-----|----------------|-------|
| `_S7PlusConnection<n>` | _S7PlusConnection | Pro Verbindung | Verbindungskonfiguration, Status, Kommandos |
| `_S7PlusConnection<n>_2` | _S7PlusConnection | Pro redundante Verbindung | Automatisch erstellte Backup-Verbindung |
| `_S7PlusConfig` | _S7PlusConfig | Global (einmal pro Projekt) | CA-Zertifikate und Subscription-Registrierung |
| `_S7Plus_Poll_1s` | _PollGroup | Global | Standard-Pollgruppe für Polling (1000ms) |
| `_S7Plus_Subscr` | _PollGroup | Global | Standard-Pollgruppe für Subscriptions |

## S7Plus-Verhalten im Überblick

| Aspekt | Verhalten |
|--------|----------|
| Treiber-Auto-Erstellung | Nein — muss vorher in Pmon registriert sein |
| Treiber-Auto-Start | Ja — startet einen gestoppten Treiber automatisch |
| Subscription-Mechanismus | Über `_S7PlusConfig.Subscriptions`-Registrierung |
| Browse-Fähigkeit | Ja — online (laufende SPS) und offline (TIA Export) |
| TIA Portal Integration | Ja — Browse und Erkennung von TIA Exports |
| Redundanz-Unterstützung | Ja — ReduLan + verschiedene Umschaltbedingungen |
| Protokoll | S7Plus über TCP Port 102 |
| Adressierung | Ausschließlich symbolisch (keine Byte/Bit-Adressen) |
