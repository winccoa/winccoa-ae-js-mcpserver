# S7Plus Driver — Overview

## What is S7Plus?

S7Plus is the communication protocol for Siemens S7-1200 and S7-1500 PLCs (Programmable Logic Controllers). In WinCC OA, the S7Plus driver (`WCCOAs7plusdrv`) provides native connectivity to these PLCs.

S7Plus does **not** support legacy devices such as S7-300/400 — those require the classic S7 driver.

## Supported PLC Types

| PLC Type | Value | Description |
|----------|-------|-------------|
| Automatic | 1 | Auto-detection from TIA Portal project |
| RH | 2 | Redundant High Availability (two PLCs). Use the System-IP. |
| RH_Single | 3 | Single PLC in an R/H system. Use the individual CPU IP. |
| S7_1500 | 16 | Siemens S7-1500 |
| S7_1200 | 272 | Siemens S7-1200 |
| S7_1500_SoftCtrl | 528 | S7-1500 Software Controller (virtual PLC) |
| PLCSim | 768 | PLCSIM simulation environment |

**Common mistake:** PLCSim (768) and S7_1500 (16) are often confused. If the connection shows `Failure`, check the PLC type first.

## Key Concepts

### Symbolic Addressing
S7Plus uses **symbolic addresses** (e.g., `"MyDB.MyVar"`, `"DataBlock1.Temperature"`) instead of numeric byte/bit addresses. These correspond to the variable names defined in the TIA Portal project.

### Connection Datapoints
Each S7Plus connection is represented as a WinCC OA datapoint of type `_S7PlusConnection`. The datapoint contains sub-elements for configuration (`Config.*`), commands (`Command.*`), and state (`State.*`).

### Driver Management
The S7Plus driver runs as a WinCC OA manager process (`WCCOAs7plusdrv`). Each driver instance is identified by a **driver number** (1-99). Multiple connections can share the same driver instance.

**Important:** The S7Plus driver must be registered in Pmon before connections can be created.

### Driver Numbers
Driver numbers (1-99) identify the driver instance. They are shared project-wide across all driver types — a number used by another driver (e.g., simulation) cannot also be used by S7Plus.

### CheckConn
Every connection requires an internal `CheckConn` address configuration. This is a control mechanism that WinCC OA uses to monitor connection health. CheckConn is configured automatically when creating a connection.

### _S7PlusConfig — Global Configuration Datapoint
`_S7PlusConfig` is a system datapoint that exists **once per WinCC OA project** (not per connection). It stores:

- `CaCertificates` — TLS CA certificate trust list (for all S7Plus connections)
- `Subscriptions.Names` — registered subscription poll group names
- `Subscriptions.Pollgroups` — poll group datapoint references
- `Subscriptions.Options` — subscription options (e.g., onlyChanges flags)

## S7Plus Features

- **Symbolic addressing** — variable names instead of byte/bit addresses
- **Subscription mode** via `_S7PlusConfig.Subscriptions` — event-driven updates from the PLC
- **TIA Portal browsing** — online (live PLC) and offline (TIA export)
- **TIA project discovery** — automated listing of exports and stations
- **Time synchronization** between PLC and WinCC OA
- **Redundancy switching** with multiple conditions (OpState, ConnState, SwitchTag)
- **TLS certificate management** at driver level
- **Three-step address configuration** (`_distrib` → `_address` → `_active`)
