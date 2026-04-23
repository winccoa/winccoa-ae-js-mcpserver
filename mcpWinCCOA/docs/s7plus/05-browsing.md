# S7Plus PLC Browsing

## Overview

The browse functionality enables navigation through the variable structure of the PLC. It is used to determine available data blocks, tags, and their types. This is essential for address configuration, as the exact symbolic path of the PLC variable is required.

## Browse Modes

### Online Browse
Connects to a running PLC and reads its current variable structure in real time.

**Prerequisites:**
- Connection must be in `Connected` status
- PLC must be reachable over the network
- `Config.StationName` must contain `"S7Plus$Online|Online"`

### Offline Browse
Reads the variable structure from a TIA Portal export in the WinCC OA project. Does not require a running PLC.

**Prerequisites:**
- TIA Portal project must be exported from TIA Portal and placed in the data directory of the WinCC OA project
- `Config.StationName` must contain `"ExportName|StationName"`
- The `.zip` extension is automatically removed

### Root Browse
Lists available TIA Portal exports at the top level. Use this first to find out which exports are available.

### AccessPoints Browse
Lists available access points for S7Plus communication.

## Browse Path Construction

Internally, the browse system constructs pipe-separated paths for the S7Plus driver:

| Mode | Internal Path Pattern |
|------|-----------------------|
| Online (without category) | `S7Plus$Online` |
| Online (Category=All) | `S7Plus$Online\|Online` |
| Online (Category=Blocks) | `S7Plus$Online\|Online\|Blocks` |
| Online (deep) | `S7Plus$Online\|Online\|Blocks\|MyDB\|SubStruct` |
| Offline (Root) | `MyExport\|PLC_1` |
| Offline (Category) | `MyExport\|PLC_1\|Blocks` |
| Root | (empty string) |
| AccessPoints | `S7Plus$AccessPoints` |

The `.zip` extension is automatically removed from TIA export names.

## Category Filter

| Category | Description |
|----------|-------------|
| All | Show everything (default) |
| Blocks | Data blocks, function blocks, organization blocks |
| Tags | PLC tags (global variables) |
| Types | User-defined data types (UDTs) |
| Alarms | PLC alarm definitions |

## Pagination

Browse results are paginated. Maximum per page: **800 nodes**.

Result structure:
```
nodes:      [...]              Nodes of the current page
totalNodes: 1500               Total number of available nodes
hasMore:    true               More pages available
nextOffset: 800                Offset for next page (null if none)
isPartial:  true               Result was truncated
warning:    "showing 1-800 of 1500"   Human-readable message
```

## Navigating Deeper

To navigate into the children of a node, the path is extended:

```
1. List data blocks:
   Path: S7Plus$Online|Online|Blocks
   -> Result contains: path="MyDB", hasChildren=true

2. Navigate into MyDB:
   Path: S7Plus$Online|Online|Blocks|MyDB
   -> Result contains: path="MyDB.SubStruct", hasChildren=true

3. Navigate deeper:
   Path: S7Plus$Online|Online|Blocks|MyDB|SubStruct
   -> Result contains: path="MyDB.SubStruct.Temperature", hasChildren=false
```

## Browse Result Format

Each browse node contains:

| Field | Description |
|-------|-------------|
| path | Symbolic path (use as `_reference` in address configuration) |
| comment | Description from the TIA Portal project |
| systemType | PLC system type identifier |
| valueType | Data type (e.g., "Int", "Real", "Bool", "String") |
| itemLength | String length for STRING/WSTRING (0 for other types) |
| hasChildren | If true, deeper navigation is possible |

## TIA Project Detection

For automated detection of available TIA Portal exports:

1. Create a temporary offline connection (IP 0.0.0.0, PLCType Automatic)
2. Perform root browse — lists all TIA exports
3. For each export: set station name and browse for contained stations
4. Result: export names and their stations
5. Clean up temporary connection

Example result:
```
Exports:
  - Name: MyTIAProject_Export
    Stations: [PLC_1, PLC_2]
  - Name: AnotherExport
    Stations: [CPU_315]
```

## Timeout Protection

Browse operations have a **60-second timeout**. If the PLC does not respond in time:
- Browse is aborted
- Resources are cleaned up
- An error is returned

## Typical Browse Workflow

```
1. Determine TIA exports (for offline mode):
   Root browse -> find export names and stations

2. Browse top-level structure:
   Online/Blocks or Offline/Blocks -> see available data blocks

3. Navigate into data blocks:
   Extend path with "MyDB" -> see variables in the block

4. Find variable:
   Result: path="MyDB.Temperature", valueType="Real"

5. Configure address:
   Set _reference="MyDB.Temperature" on the desired DPE
```
