# S7Plus Connection Management

## Connection Lifecycle

```
[No Connection] 
    | Create _S7PlusConnection datapoint + set Config
    v
[Created - Inactive] 
    | EstablishmentMode = 1 (AutomaticActive) + Command.Enable = true
    v
[Connecting] 
    | Successful handshake with PLC
    v
[Connected] <---- normal operating state
    |
    |-- Change Config -> [Temporarily disabled] -> [Re-enabled]
    |
    +-- Delete datapoint -> [Deleted]
```

## Prerequisites

**The S7Plus driver must be registered in Pmon.** Registration is done in the WinCC OA Console:

1. Open WinCC OA Console
2. Add manager `WCCOAs7plusdrv`
3. Options: `-num 1` (driver number 1-99)
4. Start mode: `always`

If the driver is registered but stopped, it will be started automatically as soon as a connection is activated.

## Creating a Connection

### Create Datapoint

A datapoint of type `_S7PlusConnection` is required (e.g., `_S7PlusConnection1`).

### Set Configuration

**Required fields:**
```
Config.Address    = "192.168.1.100"       (IP address of the PLC)
Config.PLCType    = 16                     (PLC type, e.g., 16 = S7-1500)
Config.DrvNumber  = 1                      (driver number)
```

**Optional fields (with default values):**
```
Config.AccessPoint           = "S7ONLINE"
Config.ConnType              = 0           (Single)
Config.KeepAliveTimeout      = 20          (seconds)
Config.ReconnectTimeout      = 20          (seconds)
Config.UseUtc                = true
Config.Timezone              = 0
Config.SetInvalidBit         = false
Config.EnableStatistics      = true
Config.EnableDiagnostics     = false
Config.ReadOpState           = false
Config.AcquireValuesOnConnect = true
Config.TimeSyncMode          = 0           (Inactive)
Config.TimeSyncInterval      = 86400       (24 hours)
```

### Configure CheckConn

Each connection requires an internal CheckConn address. This is configured on the `CheckConn` sub-element of the connection datapoint — using the same three-step mechanism as regular addresses:

1. Set `_distrib` (driver assignment)
2. Set `_address` (without `_active`)
3. Set `_active = true` (separate `dpSetWait`)

### Activate Connection

```
Config.EstablishmentMode = 1               (AutomaticActive)
Command.Enable           = true
Command.GQ               = false
Command.IGQ              = false
```

### Browse Mode

The browse mode is controlled via `Config.StationName` and is **fixed after creation**:

- **Online:** `Config.StationName` contains `"S7Plus$Online|Online"` — browse a running PLC
- **Offline:** `Config.StationName` contains `"ExportName|StationName"` — browse a TIA Portal export

If both modes are needed, two separate connections must be created.

## Modifying a Connection

To modify an existing connection:

1. Disable the connection: `Config.EstablishmentMode = 0`, `Command.Enable = false`
2. Change Config fields
3. Re-activate the connection

**Note:** If `Config.EstablishmentMode` is set back to 1 after the change, the connection will always be activated — even if it was previously manually disabled.

All existing `_address` configurations on datapoints are preserved when changes are made.

## Deleting a Connection

**Warning:** Deleting the `_S7PlusConnection` datapoint destroys all `_address` configurations that reference this connection. This cannot be undone.

Recommended sequence:
1. Disable the connection
2. Delete the `_S7PlusConnection` datapoint

## Driver Number Management

### How It Works

- Each S7Plus driver instance has a unique number (1-99)
- The number is specified with the `-num` parameter in the manager command line
- Multiple connections can share the same driver instance
- Driver numbers must not conflict with other driver types in the project

### Driver Resolution Logic

1. Query Pmon for registered managers
2. Find S7Plus drivers (`WCCOAs7plusdrv`) and read the `-num` parameter
3. If a driver with the desired number exists, use it (start if stopped)
4. If no driver with this number exists but other S7Plus drivers are registered, use the first available one
5. If no S7Plus driver is registered — **error** — the driver must first be added to Pmon

## Datapoint Structure _S7PlusConnection

```
_S7PlusConnection1
+-- Config
|   +-- Address                (string: IP address)
|   +-- PLCType                (int: PLC type)
|   +-- AccessPoint            (string: e.g., "S7ONLINE")
|   +-- DrvNumber              (int: driver number)
|   +-- ConnType               (int: 0=Single, 1=ReduLan)
|   +-- KeepAliveTimeout       (int: seconds)
|   +-- ReconnectTimeout       (int: seconds)
|   +-- UseUtc                 (bool)
|   +-- Timezone               (int: offset)
|   +-- SetInvalidBit          (bool)
|   +-- EnableStatistics       (bool)
|   +-- EnableDiagnostics      (bool)
|   +-- ReadOpState            (bool)
|   +-- AcquireValuesOnConnect (bool)
|   +-- TimeSyncMode           (int: 0=Inactive, 1=SyncPLCtoOA)
|   +-- TimeSyncInterval       (int: seconds)
|   +-- Password               (string)
|   +-- StationName            (string: browse path)
|   +-- Codepage               (int)
|   +-- UseTls                 (bool)
|   +-- Certificate            (string: certificate file)
|   +-- EstablishmentMode      (int: 0=Inactive, 1=AutomaticActive)
|   +-- LegitimationLevel      (int: access level)
|   +-- ReduAddress            (string: secondary IP)
|   +-- ReduAccessPoint        (string)
|   +-- SwitchCondition        (int: redundancy switchover)
|   +-- SwitchTag              (string: PLC variable for switchover)
+-- Command
|   +-- Enable                 (bool: start/stop connection)
|   +-- GQ                     (bool: General Query)
|   +-- IGQ                    (bool: Initial General Query)
+-- State
|   +-- ConnState              (int: current connection status)
+-- CheckConn                  (internal: connection monitoring)
    +-- _address                (peripheral address configuration)
    +-- _distrib                (driver assignment)
```
