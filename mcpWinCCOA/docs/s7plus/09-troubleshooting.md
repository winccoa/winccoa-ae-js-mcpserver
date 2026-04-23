# S7Plus Fehlerbehebung

## Einrichtungsprobleme

### Kein S7Plus-Treiber im Projekt

**Ursache:** Kein S7Plus-Treiber in Pmon registriert.

**Lösung:** Treiber registrieren:
1. WinCC OA Console öffnen
2. Manager `WCCOAs7plusdrv` hinzufügen
3. Optionen: `-num 1` (Treibernummer)
4. Startmodus: `always`

### Treibernummer X wird von Simulationstreiber verwendet

**Ursache:** Die gewünschte Treibernummer kollidiert mit einem Simulationstreiber (`WCCOAsimudrv`).

**Lösung:** Andere Treibernummer verwenden. Nächste verfügbare Nummer über Pmon ermitteln.

## Verbindungsprobleme

### Verbindung bleibt im Status "Connecting"

**Mögliche Ursachen:**
- SPS nicht erreichbar (falsche IP-Adresse oder Netzwerkproblem)
- Falscher SPS-Typ konfiguriert (z.B. S7_1500 statt PLCSim)
- Access Point nicht verfügbar ("S7ONLINE" nicht in Windows konfiguriert)
- Firewall blockiert S7Plus-Kommunikation (TCP Port 102)

**Lösungsschritte:**
1. SPS-Erreichbarkeit prüfen: IP-Adresse pingen
2. SPS-Typ prüfen: stimmt `Config.PLCType` mit der tatsächlichen Hardware überein?
3. Access Point in den PG/PC-Schnittstelleneinstellungen prüfen
4. Firewall-Regeln für TCP Port 102 kontrollieren

### Verbindung zeigt "Failure"

**Mögliche Ursachen:**
- SPS-Typ-Mismatch (häufigster Fehler bei PLCSim)
- TLS-Zertifikatsprobleme
- SPS-Passwort falsch
- Treiber läuft nicht

**Lösungsschritte:**
1. WinCC OA Log auf detaillierte Fehlermeldungen prüfen
2. Bei PLCSim: SPS-Typ muss `768` sein, nicht `16` (S7_1500)
3. Bei TLS: CA-Zertifikate in der Vertrauensliste prüfen
4. Treiber-Status in Pmon prüfen

### Verbindung hat funktioniert, jetzt nicht mehr

**Mögliche Ursachen:**
- SPS wurde neu gestartet oder IP geändert
- TLS-Zertifikat abgelaufen
- Netzwerkinfrastruktur geändert
- Treiber abgestürzt

**Lösungsschritte:**
1. `State.ConnState` prüfen
2. SPS-Erreichbarkeit verifizieren
3. WinCC OA Log auf Treiber-Absturzmeldungen prüfen
4. Verbindung deaktivieren und wieder aktivieren (Reconnect)

## Adresskonfigurationsprobleme

### Keine Daten nach Adresskonfiguration

**Mögliche Ursachen:**
- Falscher symbolischer Pfad (Tippfehler im SPS-Variablennamen)
- Falsche Direction (Output statt IOPoll)
- Falsche Treibernummer (Adresse zeigt auf anderen Treiber)
- Verbindung nicht im Status "Connected"
- Pollgruppe nicht aktiv

**Lösungsschritte:**
1. Symbolischen Pfad per Browse verifizieren
2. Direction prüfen (IOPoll/7 für die meisten Anwendungsfälle)
3. Treibernummer muss mit `Config.DrvNumber` der Verbindung übereinstimmen
4. `State.ConnState = 3` bestätigen
5. `_PollGroup.Active = true` prüfen

### Subscription löst keine Updates aus

**Mögliche Ursachen:**
- Adresse nicht in `_S7PlusConfig.Subscriptions` registriert
- SPS-Wert ändert sich tatsächlich nicht

**Lösungsschritte:**
1. `_S7PlusConfig.Subscriptions.Names` auf Pollgruppen-Eintrag prüfen
2. SPS-Wert manuell ändern zum Testen

### Falsche Datentypen / verfälschte Werte

**Mögliche Ursachen:**
- Transformationstyp passt nicht zum SPS-Variablentyp
- Stringlänge (`itemLength`) zu kurz für STRING/WSTRING

**Lösungsschritte:**
1. Browse verwenden um `valueType` der Variable zu prüfen
2. Transformation 1001 (DEFAULT) für Auto-Erkennung verwenden
3. Bei Strings: `itemLength` auf die Stringlänge der SPS-Definition setzen

## Browse-Probleme

### Browse liefert keine Ergebnisse

**Mögliche Ursachen:**
- Verbindung nicht aufgebaut (bei Online-Browse)
- Falscher TIA-Exportname oder Stationsname (bei Offline-Browse)
- `Config.StationName` passt nicht zum Browse-Modus
- Kategorie-Filter zu restriktiv

**Lösungsschritte:**
1. Online: `State.ConnState = 3` sicherstellen
2. Offline: Root-Browse zur Ermittlung korrekter Namen verwenden
3. `Config.StationName` prüfen (Online: `S7Plus$Online|Online`, Offline: `Export|Station`)
4. Browse mit Kategorie "All" versuchen

### Browse-Timeout (60 Sekunden)

**Mögliche Ursachen:**
- SPS antwortet langsam (hohe Last)
- Netzwerk-Latenz
- Sehr großes SPS-Programm mit vielen Variablen

**Lösungsschritte:**
1. Browse mit spezifischer Kategorie einschränken
2. Paginierung mit kleinerem Limit verwenden
3. Netzwerk-Latenz zur SPS prüfen
4. Offline-Browse für große Projekte erwägen

### Online-Verbindung kann nicht offline browsen (oder umgekehrt)

**Ursache:** Der Browse-Modus ist durch `Config.StationName` bei der Verbindungserstellung fixiert.

**Lösung:** Separate Verbindung mit dem gewünschten Browse-Modus erstellen. Es können beide gleichzeitig existieren.

## TLS-Probleme

### Keine CA-Zertifikate bei Verbindungserstellung

**Lösung:** CA-Zertifikate vor der Verbindungserstellung zur Vertrauensliste hinzufügen:
```
_S7PlusConfig.CaCertificates = ["root_ca.pem"]
```

### TLS-Handshake schlägt fehl

**Mögliche Ursachen:**
- CA-Zertifikat passt nicht zur Zertifikatskette der SPS
- Zertifikat abgelaufen
- Zertifikatsdatei nicht im Projektverzeichnis (`data/s7plus/cert`)

**Lösungsschritte:**
1. Zertifikatskette prüfen (Root-CA + Intermediate)
2. Ablaufdaten der Zertifikate prüfen
3. Zertifikatsdateien in `data/s7plus/cert` verifizieren

## Treiberprobleme

### Treibernummern-Konflikt

**Symptom:** Fehlermeldung über bereits belegte Treibernummer.

**Lösung:** Andere Treibernummer wählen. Belegte Nummern über Pmon ermitteln.

### Treiber startet nicht

**Mögliche Ursachen:**
- WinCC OA Lizenz enthält keinen S7Plus-Treiber
- Maximale Anzahl Manager erreicht
- Konfliktierende Treiberkonfiguration

**Lösungsschritte:**
1. WinCC OA Lizenz auf S7Plus-Treiber-Support prüfen
2. Pmon auf maximale Manager-Anzahl prüfen
3. WinCC OA Log auf Treiber-Startfehler prüfen

## Tipps

### Empfohlene Einrichtungsreihenfolge
1. S7Plus-Treiber in Pmon registrieren
2. CA-Zertifikate hinzufügen (bei TLS)
3. Verbindung erstellen
4. Auf "Connected" warten
5. SPS-Struktur browsen
6. Adressen konfigurieren

### Testen mit PLCSim
- Immer SPS-Typ `768` (PLCSim) verwenden
- PLCSim kann andere Timing-Eigenschaften als reale Hardware haben
- Manche Features (z.B. TLS) sind in der Simulation nicht verfügbar

### Performance
- Subscription für Werte verwenden, die sich selten ändern
- Polling mit angemessenem Intervall für sich schnell ändernde Werte
- Zusammengehörige Variablen auf die gleiche Pollgruppe für konsistentes Timing
- 800-Knoten-Paginierungslimit bei großen SPS-Programmen beachten
