# S7Plus Configuration Values and Data Types

## PLC Type (Config.PLCType)

Determines the target PLC hardware. Must match the actual PLC.

| Name | Value | Description |
|------|-------|-------------|
| Automatic | 1 | Auto-detection from TIA project (requires offline browse) |
| RH | 2 | Redundant High Availability — two PLCs |
| RH_Single | 3 | Single PLC in a redundant system |
| S7_1500 | 16 | Standard S7-1500 |
| S7_1200 | 272 | S7-1200 |
| S7_1500_SoftCtrl | 528 | Software-based S7-1500 controller |
| PLCSim | 768 | PLCSIM simulation environment |

## Connection Type (Config.ConnType)

| Name | Value | Description |
|------|-------|-------------|
| Single | 0 | Single network connection (default) |
| ReduLan | 1 | Redundant LAN — two independent network paths |

ReduLan requires a secondary IP address (`Config.ReduAddress`) and optionally a separate access point (`Config.ReduAccessPoint`).

## Connection Status (State.ConnState)

| Name | Value | Description |
|------|-------|-------------|
| Inactive | 0 | Connection not initialized |
| Disconnected | 1 | Configured but not active |
| Connecting | 2 | Connection establishment in progress |
| Connected | 3 | Successfully connected |
| Disconnecting | 4 | Controlled disconnection in progress |
| Failure | 5 | Connection failed (check WinCC OA log) |

## Establishment Mode (Config.EstablishmentMode)

| Name | Value | Description |
|------|-------|-------------|
| Inactive | 0 | Connection must be activated manually |
| AutomaticActive | 1 | Connection is automatically activated on server start |

With `EstablishmentMode = 1` and `Command.Enable = true`, the connection is established automatically.

## Time Synchronization (Config.TimeSyncMode)

| Name | Value | Description |
|------|-------|-------------|
| Inactive | 0 | No time synchronization |
| SyncPLCtoOA | 1 | Synchronize PLC clock to WinCC OA clock |

Synchronization interval is configurable (default: 86400 seconds = 24 hours).

## PLC Operating State (State.Connections.OpState)

Only available when `Config.ReadOpState = true`.

| Name | Value | Description |
|------|-------|-------------|
| Stop | 4 | PLC in stop mode |
| Startup | 6 | PLC is starting up |
| Run | 8 | PLC is running normally |
| RunRedundant | 9 | PLC is running in redundant mode |
| RunODIS | 18 | PLC is running with online diagnostics (ODIS) |

## PLC Login Status (State.Connections.State)

| Name | Value | Description |
|------|-------|-------------|
| LoggedOut | 0 | Not authenticated |
| LoggingIn | 1 | Authentication in progress |
| LoggedIn | 2 | Successfully authenticated |
| LoggingOut | 3 | Logout in progress |

## Legitimation Level (Config.LegitimationLevel)

Controls the access level to the PLC. This is **not** simply a TLS on/off switch — it defines the authorization level.

| Name | Value | Description |
|------|-------|-------------|
| Invalid | -1 | Invalid/failed authentication (also for "no TLS") |
| Failsafe | 0 | Failsafe access, minimal permissions (also with `useTls: true`) |
| Full | 1 | Full access to all PLC resources |
| ReadWrite | 2 | Read and write access |
| ReadOnly | 3 | Read-only access |
| InactiveAccess | 4 | Inactive (no access) |

With TLS: LegitimationLevel = 0 (Failsafe). Without TLS: LegitimationLevel = -1 (Invalid).

## Redundancy Switch Condition (Config.SwitchCondition)

| Name | Value | Description |
|------|-------|-------------|
| Disabled | 0 | No automatic redundancy switchover |
| OpState | 1 | Switch on PLC operating state change |
| ConnState | 2 | Switch on connection loss |
| Both | 3 | Switch on OpState OR ConnState |
| SwitchTag | 4 | Switch based on a boolean PLC variable |

SwitchTag (4) requires `Config.SwitchTag` with the name of the PLC variable.

## Address Direction (_address._direction)

| Name | Value | Usage |
|------|-------|-------|
| Output | 1 | Write only to PLC |
| InputSpont | 2 | **NOT SUPPORTED** with S7Plus |
| InputSQuery | 3 | Single read request |
| InputPoll | 4 | Cyclic reading |
| OutputSingle | 5 | Single write |
| IOSpont | 6 | **NOT SUPPORTED** with S7Plus |
| IOPoll | 7 | Bidirectional polling — **also used for subscriptions** |
| IOSQuery | 8 | Bidirectional single request |

**Critical:** Direction 7 (IOPoll) serves a dual purpose. Both polling and subscription use this value. The difference lies in the registration in `_S7PlusConfig.Subscriptions`. See address configuration for details.

Spontaneous modes (2, 6) do not work with S7Plus — the protocol requires polling or explicit subscription.

## Data Type Transformation (_address._datatype)

Maps PLC data types to WinCC OA data types. Value range: 1001-1027.

| Name | Value | PLC Type | WinCC OA Type |
|------|-------|----------|---------------|
| DEFAULT | 1001 | Auto-detection (recommended) | automatic |
| BOOL | 1002 | Boolean | bool |
| BYTE | 1003 | 8-bit unsigned | int |
| WORD | 1004 | 16-bit unsigned | int |
| DWORD | 1005 | 32-bit unsigned | int |
| LWORD | 1006 | 64-bit unsigned | int |
| USINT | 1007 | Unsigned 8-bit integer | int |
| UINT | 1008 | Unsigned 16-bit integer | int |
| UDINT | 1009 | Unsigned 32-bit integer | int |
| ULINT | 1010 | Unsigned 64-bit integer | int |
| SINT | 1011 | Signed 8-bit integer | int |
| INT | 1012 | Signed 16-bit integer | int |
| DINT | 1013 | Signed 32-bit integer | int |
| LINT | 1014 | Signed 64-bit integer | int |
| REAL | 1015 | 32-bit float | float |
| LREAL | 1016 | 64-bit double | float |
| DATE | 1017 | Date (days since 1970-01-01) | time |
| DATETIME | 1018 | Date and time | time |
| TIME | 1019 | Time in milliseconds (32-bit) | time |
| TIME_OF_DAY | 1020 | Time of day in ms since midnight | time |
| LDATETIME | 1021 | Long date and time | time |
| LTIME | 1022 | Long time in nanoseconds (64-bit) | time |
| LTOD | 1023 | Long time of day (64-bit) | time |
| DTL | 1024 | Date and Time Long (12-byte struct) | time |
| S5TIME | 1025 | S5-compatible time (16-bit) | time |
| STRING | 1026 | ASCII string | string |
| WSTRING | 1027 | Wide (Unicode) string | string |

For STRING and WSTRING: set `_address._offset` or `itemLength` to the maximum string length.

## Connection Parameters

### Required Parameters

| Parameter | Datapoint Field | Description |
|-----------|----------------|-------------|
| IP Address | Config.Address | IPv4 address of the PLC |
| PLC Type | Config.PLCType | PLC hardware type (see table above) |
| Driver Number | Config.DrvNumber | S7Plus driver number (1-99) |

### Optional Parameters

| Parameter | Datapoint Field | Default | Description |
|-----------|----------------|---------|-------------|
| Access Point | Config.AccessPoint | "S7ONLINE" | Network access point |
| Connection Type | Config.ConnType | 0 (Single) | Connection type |
| Enable Connection | Config.EstablishmentMode | 0 | 0=Inactive, 1=AutomaticActive |
| Keep-Alive | Config.KeepAliveTimeout | 20 | Keep-alive in seconds |
| Reconnect | Config.ReconnectTimeout | 20 | Reconnect interval in seconds |
| Use UTC | Config.UseUtc | true | UTC timestamps |
| Timezone | Config.Timezone | 0 | Timezone offset |
| Invalid Bit | Config.SetInvalidBit | false | Invalid bit on communication errors |
| Statistics | Config.EnableStatistics | true | Driver statistics |
| Diagnostics | Config.EnableDiagnostics | false | Enable diagnostics |
| Read OpState | Config.ReadOpState | false | Read PLC operating state |
| Values on Connect | Config.AcquireValuesOnConnect | true | Read all values on connection |
| Time Sync Mode | Config.TimeSyncMode | 0 (Inactive) | Time synchronization |
| Time Sync Interval | Config.TimeSyncInterval | 86400 | Sync interval in seconds |
| Password | Config.Password | — | PLC access password |
| TLS | Config.UseTls | false | TLS encryption |
| Certificate | Config.Certificate | — | Server certificate file |
| Station Name | Config.StationName | — | TIA station name for browse |
| Codepage | Config.Codepage | — | Character encoding |
| Redu Address | Config.ReduAddress | — | Secondary PLC IP |
| Redu AccessPoint | Config.ReduAccessPoint | — | Secondary access point |
| Switch Condition | Config.SwitchCondition | 0 (Disabled) | Redundancy switchover |
| Switch Tag | Config.SwitchTag | — | PLC variable for SwitchTag |

## Browse Result Fields

Each browse node contains:

| Field | Description |
|-------|-------------|
| path | Symbolic path (use as `_reference` in address configuration) |
| comment | Description from the TIA Portal project |
| systemType | PLC system type identifier |
| valueType | Data type (e.g., "Int", "Real", "Bool", "String") |
| itemLength | String length for STRING/WSTRING (0 for other types) |
| hasChildren | If true, deeper navigation is possible |
