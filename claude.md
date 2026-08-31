# Instructions for MCP Server to Operate WinCC OA

## Purpose

This instruction serves to provide an MCP server (Machine-Control-Process-Server) with the fundamentals and required interfaces for interacting with the SCADA system **WinCC OA** (Siemens SIMATIC WinCC Open Architecture).

---

## 1. What is WinCC OA?

WinCC OA is a **modular, object-oriented SCADA system** used for **visualization, control, and monitoring of industrial processes**. It is highly configurable, allows distributed systems, and supports extensive interfaces to third-party systems via protocols such as OPC UA, Modbus, BACnet, REST, SQL, and more.

---

## 2. Basic Principles of Operation

An MCP server that should operate WinCC OA must understand and implement the following principles:

### Project Structure

A WinCC OA project consists of:

- **Managers** (Processes)
- **Panels** (GUI elements)
- **Scripts** (Control Language = CTRL)
- **Data points** (structured variable objects)
- **Alarm systems**

### Data Points

Central objects for representing variables. Each data point has a type (e.g., pump, valve, temperature) and consists of multiple *elements* (e.g., actual value, setpoint, status).

### Manager Management

The individual functions of WinCC OA run in so-called **managers**. Relevant managers:

- `WCCOAui` – User Interface
- `WCCOAevent` – event manager
- `WCCOActrl` – script execution


---

## Documentation Guidelines

**IMPORTANT: Always write and document in English from now on. All documentation, comments, and user-facing content should be in English.**

---

## Critical Development Rules

### WinCC OA Manager Dependency

**CRITICAL**: The `winccoa-manager` package contains proprietary Siemens code that MUST NOT be bundled or distributed with this MCP server package.

**Rules**:
1. **NEVER** add `winccoa-manager` to `dependencies` in package.json - it will bundle the proprietary code

**Why**: Including winccoa-manager in dependencies would:
- Bundle proprietary Siemens code in the npm package
- Violate licensing agreements
- Make the package unpublishable to public npm registry

### WinCC OA JavaScript Manager Configuration

**IMPORTANT**: The WinCC OA JavaScript Manager automatically looks in the `javascript/` directory of the project. When configuring the manager:

- **Script Path**: Use relative paths from the `javascript/` directory (e.g., `mcpServer/index_http.js`)
- **File Location**: Scripts must be placed in `<OA_ProjPath>/javascript/` or subdirectories
- **Manager automatically prefixes**: The manager adds the `javascript/` path automatically

---

## Build Instructions

**Always build with `npm run build`.**

```bash
cd mcpWinCCOA
npm run build
```

This runs `build.mjs`, which is plain Node and works on Windows, Linux and macOS with no shell.
It compiles TypeScript **and** copies the runtime assets that `tsc` does not emit:

- `src/fields/*.md` -> `build/fields/`
- `src/systemprompt.md` -> `build/systemprompt.md`
- `config/demo-project-instructions.md` -> `build/config/`

**Do not build with a bare `npx tsc`.** It skips those copies, so the server starts but cannot find
its field definitions or system prompt. (An earlier version of this file recommended `npx tsc` as a
workaround for the old bash-only `build.sh`; `build.sh` has been removed and the workaround no longer
applies.)
