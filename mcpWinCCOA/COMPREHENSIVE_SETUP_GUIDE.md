# WinCC OA MCP Server - Comprehensive Setup and Implementation Guide

**Version:** 1.2.0
**Author:** ETM Control GesmbH
**Repository:** https://github.com/winccoa/winccoa-ae-js-mcpserver
**Purpose:** Detailed documentation for manual reproduction and understanding of the WinCC OA MCP Server

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture and Core Components](#2-architecture-and-core-components)
3. [Prerequisites and Dependencies](#3-prerequisites-and-dependencies)
4. [Project Structure](#4-project-structure)
5. [Type System](#5-type-system)
6. [Helper Classes](#6-helper-classes)
7. [MCP Tools Implementation](#7-mcp-tools-implementation)
8. [Server Configuration](#8-server-configuration)
9. [Security Implementation](#9-security-implementation)
10. [Build and Deployment](#10-build-and-deployment)
11. [Step-by-Step Manual Setup](#11-step-by-step-manual-setup)
12. [Testing and Validation](#12-testing-and-validation)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Project Overview

### 1.1 What is This Project?

The WinCC OA MCP Server is a **Model Context Protocol (MCP)** compliant server that provides AI models and automated systems with the ability to interact with **WinCC OA (Siemens SIMATIC WinCC Open Architecture)** SCADA systems. It enables:

- Reading and writing datapoint values
- Managing datapoint types and structures
- Configuring OPC UA connections and browsing address spaces
- Managing WinCC OA managers (processes)
- Setting up alarms and archives
- Creating dashboards and widgets
- Querying historical data

### 1.2 Key Features

- **Dual Transport Support:** HTTP and StdIO transports for flexible deployment
- **Field-Specific Configuration:** Multi-level instruction hierarchy (system, field, project)
- **26 MCP Tools:** Organized into 11 categories covering all WinCC OA operations
- **OPC UA Integration:** Smart browsing with auto-depth selection and pagination
- **Security-First Design:** Authentication, rate limiting, IP filtering, SSL/TLS support
- **Dashboard Management:** Create and configure visualization dashboards
- **Process Monitor (Pmon) Integration:** Control and monitor WinCC OA managers

### 1.3 Critical Design Principles

#### Proprietary Code Isolation

**CRITICAL:** The `winccoa-manager` package contains proprietary Siemens code that **MUST NOT** be bundled with the MCP server distribution.

**Rules:**
- `winccoa-manager` is a **peer dependency** (optional)
- NEVER add it to `dependencies` in package.json
- It exists only in `devDependencies` for development
- Users must have WinCC OA installed locally

**Why:** Including `winccoa-manager` in dependencies would bundle proprietary Siemens code in the npm package, violating licensing agreements.

---

## 2. Architecture and Core Components

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Client (AI Model)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ MCP Protocol (HTTP or StdIO)
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                   MCP Server (Node.js)                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Server Initialization (src/server.ts)                │  │
│  │  - Load configuration from .env                       │  │
│  │  - Initialize WinCC OA manager                        │  │
│  │  - Load field/project instructions                    │  │
│  │  - Register MCP resources and tools                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Transport Layer                                       │  │
│  │  - HTTP Server (src/index_http.ts)                    │  │
│  │    • Express middleware (auth, CORS, rate limit)      │  │
│  │    • SSL/TLS termination                              │  │
│  │  - StdIO Server (src/index_stdio.ts)                  │  │
│  │    • Direct process communication                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Tool Loader (src/tool_loader.ts)                     │  │
│  │  - Dynamic tool loading based on TOOLS env var        │  │
│  │  - Category-based organization                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MCP Tools (src/tools/)                               │  │
│  │  - 26 tools in 11 categories                          │  │
│  │  - Each exports registerTools(server, context)        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Helper Classes (src/helpers/)                        │  │
│  │  - BaseConnection (driver abstraction)                │  │
│  │  - OpcUaConnection (OPC UA operations)                │  │
│  │  - PmonClient (manager control)                       │  │
│  │  - Dashboard/Widget/Icon managers                     │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      │ winccoa-manager API
                      │
┌─────────────────────▼───────────────────────────────────────┐
│              WinCC OA (Siemens SCADA System)                 │
│  - Datapoints (variables)                                    │
│  - Managers (processes)                                      │
│  - OPC UA connections                                        │
│  - Alarms, archives, dashboards                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Entry Points

#### A. HTTP Server (`src/index_http.ts`)

**Purpose:** Runs MCP server over HTTP/HTTPS for remote access

**Key Implementation Details:**

```typescript
// File: src/index_http.ts
import express from 'express';
import { StreamableHTTPServerTransport } from 'mcp-remote/transport/http/server.js';
import { initializeServer } from './server.js';
import { serverConfig, validateConfig, loadSSLConfig } from './config/server.config.js';

// Middleware stack
const app = express();

// 1. Security middleware
if (serverConfig.security.ipFilter.enabled) {
  app.use(ipFilterMiddleware);
}

// 2. CORS middleware
if (serverConfig.http.cors.enabled) {
  app.use(cors(corsOptions));
}

// 3. Authentication middleware
app.use(authenticationMiddleware);

// 4. Rate limiting
if (serverConfig.security.rateLimit.enabled) {
  app.use('/mcp', rateLimit({
    windowMs: serverConfig.security.rateLimit.windowMs,
    max: serverConfig.security.rateLimit.max
  }));
}

// 5. MCP transport
const transport = new StreamableHTTPServerTransport('/mcp', app);
const server = await initializeServer();
await server.connect(transport);

// 6. Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// 7. Start server (HTTP or HTTPS)
const serverInstance = serverConfig.http.ssl.enabled
  ? https.createServer(loadSSLConfig(), app)
  : http.createServer(app);

serverInstance.listen(port, host);
```

**Features:**
- Configurable port and host
- Bearer token or API key authentication
- CORS support for browser clients
- Rate limiting (default: 100 req/min)
- IP whitelist/blacklist
- SSL/TLS support
- Health check endpoint at `/health`

#### B. StdIO Server (`src/index_stdio.ts`)

**Purpose:** Runs MCP server over standard input/output for local AI tools

**Key Implementation Details:**

```typescript
// File: src/index_stdio.ts
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { initializeServer } from './server.js';

const server = await initializeServer();
const transport = new StdioServerTransport();
await server.connect(transport);
```

**Features:**
- Minimal overhead
- Direct process communication
- No authentication (assumes local trust)
- Ideal for Claude Desktop or local CLI tools

### 2.3 Server Initialization (`src/server.ts`)

**Purpose:** Central initialization logic shared by both transports

**Key Implementation:**

```typescript
// File: src/server.ts
export async function initializeServer() {
  // 1. Initialize WinCC OA manager
  const winccoa = new WinccoaManager();

  // 2. Load field configuration
  const activeFieldName = process.env.WINCCOA_FIELD || 'default';
  const fieldPath = path.join(__dirname, 'fields', `${activeFieldName}.md`);
  const fieldContent = fs.readFileSync(fieldPath, 'utf-8');

  // 3. Load project instructions (optional)
  let projectContent: string | null = null;
  if (process.env.WINCCOA_PROJECT_INSTRUCTIONS) {
    projectContent = fs.readFileSync(process.env.WINCCOA_PROJECT_INSTRUCTIONS, 'utf-8');
  }

  // 4. Load system prompt
  const systemPromptPath = path.join(__dirname, '../systemprompt.md');
  const systemPrompt = fs.readFileSync(systemPromptPath, 'utf-8');

  // 5. Create server context
  const context: ServerContext = {
    winccoa,
    fieldContent,
    activeFieldName,
    projectContent,
    systemPrompt
  };

  // 6. Create MCP server
  const server = new Server({
    name: "winccoa-mcp-server",
    version: "1.2.0"
  }, {
    capabilities: {
      resources: {},
      tools: {}
    }
  });

  // 7. Register resources (instructions)
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "instructions://system",
        name: "System Instructions",
        mimeType: "text/markdown"
      },
      {
        uri: "instructions://field",
        name: `Field Instructions (${activeFieldName})`,
        mimeType: "text/markdown"
      },
      {
        uri: "instructions://project",
        name: "Project Instructions",
        mimeType: "text/markdown"
      },
      {
        uri: "instructions://combined",
        name: "Combined Instructions",
        mimeType: "text/markdown"
      }
    ]
  }));

  // 8. Load and register tools dynamically
  await loadTools(server, context);

  return server;
}
```

**Server Context Object:**

```typescript
export interface ServerContext {
  winccoa: WinccoaManager;           // WinCC OA manager instance
  fieldContent: string;              // Field-specific instructions
  activeFieldName: string;           // Active field name (from env)
  projectContent: string | null;     // Project instructions (optional)
  systemPrompt: string | null;       // System-level prompt
}
```

### 2.4 Tool Loader (`src/tool_loader.ts`)

**Purpose:** Dynamically loads MCP tools based on configuration

**Key Implementation:**

```typescript
// File: src/tool_loader.ts
export async function loadTools(server: Server, context: ServerContext): Promise<void> {
  const toolsConfig = process.env.TOOLS || '';
  const toolPaths = toolsConfig.split(',').map(t => t.trim()).filter(Boolean);

  for (const toolPath of toolPaths) {
    try {
      const modulePath = path.join(__dirname, 'tools', `${toolPath}.js`);
      const module = await import(modulePath) as ToolModule;

      if (typeof module.registerTools === 'function') {
        const count = await module.registerTools(server, context);
        console.log(`✓ Loaded ${count} tools from ${toolPath}`);
      }
    } catch (error) {
      console.error(`✗ Failed to load tool ${toolPath}:`, error);
    }
  }
}
```

**Tool Module Interface:**

```typescript
export interface ToolModule {
  registerTools: (server: Server, context: ServerContext) => Promise<number> | number;
}
```

---

## 3. Prerequisites and Dependencies

### 3.1 System Requirements

- **Node.js:** >= 18.0.0
- **Operating System:** Windows (for WinCC OA integration)
- **WinCC OA:** Version 3.21 or compatible
- **TypeScript:** ^5.8.3 (dev dependency)

### 3.2 Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@modelcontextprotocol/sdk` | ^1.12.1 | MCP protocol implementation |
| `express` | ^5.1.0 | HTTP server framework |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `express-rate-limit` | ^7.1.5 | Rate limiting middleware |
| `dotenv` | ^16.4.5 | Environment variable management |
| `zod` | ^3.25.51 | Runtime type validation |
| `mcp-remote` | ^0.1.13 | Remote MCP transport |

### 3.3 Peer Dependencies

| Package | Purpose | Critical Note |
|---------|---------|---------------|
| `winccoa-manager` | WinCC OA API bindings | **MUST be peer dependency only** - contains proprietary Siemens code |

**Configuration in package.json:**

```json
{
  "peerDependencies": {
    "winccoa-manager": "file:C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
  },
  "peerDependenciesMeta": {
    "winccoa-manager": {
      "optional": true
    }
  },
  "devDependencies": {
    "winccoa-manager": "file:C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
  }
}
```

### 3.4 Dev Dependencies

- `@types/express` ^5.0.3
- `@types/node` ^18.19.129
- `typescript` ^5.8.3

---

## 4. Project Structure

```
mcpWinCCOA/
├── src/                                    # Source TypeScript files
│   ├── index_http.ts                       # HTTP server entry point (372 lines)
│   ├── index_stdio.ts                      # StdIO server entry point (31 lines)
│   ├── server.ts                           # Server initialization (259 lines)
│   ├── tool_loader.ts                      # Dynamic tool loader (113 lines)
│   │
│   ├── config/
│   │   └── server.config.ts                # Server configuration loader
│   │
│   ├── tools/                              # MCP tools (26 files)
│   │   ├── datapoints/
│   │   │   ├── dp_basic.ts                 # Get types/datapoints/values
│   │   │   ├── dp_create.ts                # Create datapoints
│   │   │   ├── dp_set.ts                   # Set values
│   │   │   ├── dp_types.ts                 # List types
│   │   │   └── dp_type_create.ts           # Create types
│   │   │
│   │   ├── opcua/
│   │   │   ├── opcua_connection.ts         # Add/browse/delete connections
│   │   │   └── opcua_address.ts            # Configure OPC UA addressing
│   │   │
│   │   ├── manager/
│   │   │   ├── manager_list.ts             # List managers
│   │   │   ├── manager_add.ts              # Add manager
│   │   │   ├── manager_remove.ts           # Remove manager
│   │   │   ├── manager_control.ts          # Start/stop/restart
│   │   │   └── manager_properties.ts       # Get/set properties
│   │   │
│   │   ├── common/
│   │   │   ├── common_query.ts             # Query descriptions/units
│   │   │   ├── common_set.ts               # Set common attributes
│   │   │   └── common_delete.ts            # Delete attributes
│   │   │
│   │   ├── alarms/
│   │   │   ├── alarm_set.ts                # Set alarm configuration
│   │   │   └── alarm_delete.ts             # Delete alarms
│   │   │
│   │   ├── archive/
│   │   │   ├── archive_query.ts            # Query historical data
│   │   │   ├── archive_set.ts              # Configure archiving
│   │   │   └── archive_delete.ts           # Delete archive config
│   │   │
│   │   ├── dashboards/
│   │   │   ├── dashboard.ts                # Dashboard management
│   │   │   └── widget.ts                   # Widget creation
│   │   │
│   │   ├── pv_range/
│   │   │   ├── pv_range_query.ts           # Query PV ranges
│   │   │   ├── pv_range_set.ts             # Set PV ranges
│   │   │   └── pv_range_delete.ts          # Delete PV ranges
│   │   │
│   │   └── icons/
│   │       └── icon.ts                     # Create SVG icons
│   │
│   ├── helpers/                            # Helper classes
│   │   ├── drivers/
│   │   │   ├── BaseConnection.ts           # Abstract driver base
│   │   │   └── OpcUaConnection.ts          # OPC UA implementation
│   │   │
│   │   ├── pmon/
│   │   │   └── PmonClient.ts               # Pmon TCP client
│   │   │
│   │   ├── dashboards/
│   │   │   ├── DashboardManager.ts         # Dashboard CRUD
│   │   │   ├── LayoutHelper.ts             # Grid layout
│   │   │   └── WidgetFactory.ts            # Widget creation
│   │   │
│   │   └── icons/
│   │       ├── IconGenerator.ts            # SVG generation
│   │       └── IconList.ts                 # Icon catalog
│   │
│   ├── types/                              # TypeScript type definitions
│   │   ├── index.ts                        # Type exports
│   │   │
│   │   ├── winccoa/
│   │   │   ├── manager.ts                  # WinccoaManager types
│   │   │   ├── datapoint.ts                # Datapoint types
│   │   │   ├── constants.ts                # System constants
│   │   │   └── winccoa-manager.d.ts        # Type declarations
│   │   │
│   │   ├── drivers/
│   │   │   ├── connection.ts               # Connection configs
│   │   │   └── browse.ts                   # OPC UA browse types
│   │   │
│   │   ├── server/
│   │   │   ├── config.ts                   # Server config types
│   │   │   └── context.ts                  # ServerContext interface
│   │   │
│   │   ├── mcp/
│   │   │   └── responses.ts                # MCP response types
│   │   │
│   │   ├── pmon/
│   │   │   └── protocol.ts                 # Pmon protocol types
│   │   │
│   │   ├── dashboards/
│   │   │   ├── dashboard.ts                # Dashboard types
│   │   │   ├── schema.ts                   # Widget schema
│   │   │   ├── widgets.ts                  # Widget types
│   │   │   └── layout.ts                   # Layout types
│   │   │
│   │   └── tools/
│   │       └── index.ts                    # Tool module types
│   │
│   ├── utils/                              # Utility functions
│   │   ├── helpers.ts                      # Response helpers
│   │   └── managerInfo.ts                  # Manager utilities
│   │
│   └── fields/                             # Field-specific configurations
│       ├── default.md                      # Default field instructions
│       └── [other-fields].md               # Custom field configs
│
├── build/                                  # Compiled JavaScript (generated)
│   └── [mirrors src structure]
│
├── .env                                    # Environment configuration (not in git)
├── .env.example                            # Environment template
├── package.json                            # Node.js package config
├── tsconfig.json                           # TypeScript configuration
├── build.sh                                # Build script
├── postinstall.cjs                         # Post-install script
├── systemprompt.md                         # System-level AI instructions
├── CLAUDE.md                               # Project instructions for Claude
└── README.md                               # Project documentation
```

---

## 5. Type System

### 5.1 WinCC OA Core Types

#### Datapoint Types (`src/types/winccoa/datapoint.ts`)

```typescript
/**
 * Possible datapoint value types
 */
export type DatapointValue =
  | string
  | number
  | boolean
  | Buffer
  | any[]
  | null
  | undefined;

/**
 * Datapoint element with hierarchical structure
 */
export interface DatapointElement {
  name: string;                        // Element name (e.g., "value", "state")
  type: string;                        // WinCC OA type (e.g., "float", "bool")
  children?: DatapointElement[];       // Child elements (for structured types)
  description?: string;                // Element description
  unit?: string;                       // Physical unit
}

/**
 * Datapoint type definition
 */
export interface DatapointType {
  name: string;                        // Type name (e.g., "ExampleDPT")
  elements: DatapointElement[];        // Type structure
}

/**
 * Datapoint instance
 */
export interface DatapointInstance {
  name: string;                        // Datapoint name
  type: string;                        // Type name
  value?: DatapointValue;              // Current value
  timestamp?: Date;                    // Last update time
}

/**
 * Query result with pagination
 */
export interface DatapointQueryResult {
  datapoints: DatapointInstance[];
  total: number;                       // Total matches
  hasMore: boolean;                    // More results available
  limit: number;                       // Query limit
}
```

#### Manager Types (`src/types/winccoa/manager.ts`)

```typescript
/**
 * WinCC OA Manager instance (from winccoa-manager package)
 */
export interface WinccoaManager {
  // Datapoint operations
  dpQuery(pattern: string, type?: string): Promise<string[]>;
  dpGet(dpName: string): Promise<DatapointValue>;
  dpSet(dpName: string, value: DatapointValue): Promise<void>;
  dpCreate(dpName: string, type: string): Promise<void>;
  dpDelete(dpName: string): Promise<void>;

  // Type operations
  dpTypeGet(typeName: string): Promise<DatapointType>;
  dpTypeCreate(type: DatapointType): Promise<void>;

  // Configuration
  dpSetConfig(dpName: string, config: DpAddressConfig | DpDistribConfig): Promise<void>;
  dpGetConfig(dpName: string, configType: string): Promise<any>;
}

/**
 * Peripheral address configuration
 */
export interface DpAddressConfig {
  _address: {
    _reference: string;                // OPC UA node path
    _direction: number;                // INPUT_POLL (4), OUTPUT (16), etc.
    _datatype: number;                 // OPC UA type (750-768)
    _drv_ident: string;                // Manager identifier (e.g., "OPCUA_1")
    _poll_group?: string;              // Poll group name
    _mode?: number;                    // Address mode
  };
}

/**
 * Distribution configuration (manager assignment)
 */
export interface DpDistribConfig {
  _distrib: {
    _driver: number;                   // Manager number
  };
}

/**
 * Datapoint element types
 */
export enum DpElementType {
  Bool = 1,
  Char = 19,
  Int = 20,
  UInt = 22,
  Float = 21,
  Text = 23,
  Blob = 24,
  Time = 25,
  Bit32 = 26,
  Bit64 = 27,
  DpId = 30
}
```

#### Constants (`src/types/winccoa/constants.ts`)

```typescript
/**
 * System datapoint type prefixes
 */
export const SYSTEM_DP_PREFIXES = [
  '_',
  'System',
  'Dist',
  'Pmon'
] as const;

/**
 * Common WinCC OA manager names
 */
export const MANAGER_NAMES = {
  UI: 'WCCOAui',
  EVENT: 'WCCOAevent',
  CTRL: 'WCCOActrl',
  DATA: 'WCCOAdata',
  DRIVER: 'WCCOAdriver',
  API: 'WCCOAapi'
} as const;
```

### 5.2 Driver Types

#### Connection Configuration (`src/types/drivers/connection.ts`)

```typescript
/**
 * Base connection configuration
 */
export interface ConnectionConfig {
  name: string;                        // Connection name
  enabled?: boolean;                   // Enable connection
}

/**
 * OPC UA connection configuration
 */
export interface OpcUaConnectionConfig extends ConnectionConfig {
  ipAddress: string;                   // OPC UA server IP
  port: number;                        // Server port (default: 4840)
  managerNumber: number;               // WinCC OA manager number (1-255)
  reconnectTimer?: number;             // Reconnect interval in seconds
  securityPolicy?: SecurityPolicy;     // Security policy
  messageSecurityMode?: MessageSecurityMode;
  username?: string;                   // Authentication username
  password?: string;                   // Authentication password
  clientCertificate?: string;          // Client certificate path
  separator?: string;                  // Hierarchy separator (default: ".")
}

/**
 * OPC UA security policies
 */
export enum SecurityPolicy {
  None = 'None',
  Basic128Rsa15 = 'Basic128Rsa15',
  Basic256 = 'Basic256',
  Basic256Sha256 = 'Basic256Sha256',
  Aes128_Sha256_RsaOaep = 'Aes128_Sha256_RsaOaep',
  Aes256_Sha256_RsaPss = 'Aes256_Sha256_RsaPss'
}

/**
 * OPC UA message security modes
 */
export enum MessageSecurityMode {
  None = 'None',
  Sign = 'Sign',
  SignAndEncrypt = 'SignAndEncrypt'
}
```

#### Browse Types (`src/types/drivers/browse.ts`)

```typescript
/**
 * OPC UA browse node
 */
export interface BrowseNode {
  nodeId: string;                      // OPC UA node ID
  browseName: string;                  // Display name
  nodeClass: string;                   // Object, Variable, Method
  hasChildren: boolean;                // Has child nodes
  children?: BrowseNode[];             // Child nodes (if browsed)
  dataType?: string;                   // Variable data type
  description?: string;                // Node description
}

/**
 * Browse event source types
 */
export enum BrowseEventSource {
  Value = 0,                           // Value node
  Event = 1,                           // Event node
  AlarmCondition = 2                   // Alarm condition node
}

/**
 * Browse request parameters
 */
export interface BrowseRequest {
  connectionName: string;              // Connection to browse
  startNode?: string;                  // Starting node (default: RootFolder)
  maxDepth?: number;                   // Max recursion depth
  maxNodes?: number;                   // Max nodes to return (default: 800)
  includeReferences?: boolean;         // Include references
}

/**
 * Browse response with metadata
 */
export interface BrowseResponse {
  nodes: BrowseNode[];                 // Browse results
  totalNodes: number;                  // Total nodes found
  limitReached: boolean;               // Node limit hit
  depth: number;                       // Actual depth reached
  largeBranches: BranchInfo[];         // Branches with >100 children
  executionTime: number;               // Browse time (ms)
}

/**
 * Information about large branches
 */
export interface BranchInfo {
  path: string;                        // Node path
  childCount: number;                  // Number of children
  recommendation: string;              // Browse recommendation
}

/**
 * Internal browse result
 */
export interface BrowseResult {
  nodes: BrowseNode[];
  totalNodes: number;
  limitReached: boolean;
  largeBranches: BranchInfo[];
}

/**
 * Recursion statistics
 */
export interface RecursionStats {
  currentDepth: number;
  maxDepthReached: number;
  nodesProcessed: number;
}
```

### 5.3 Server Configuration Types

#### Server Config (`src/types/server/config.ts`)

```typescript
/**
 * Server configuration
 */
export interface ServerConfig {
  mode: 'http' | 'stdio';              // Transport mode
  http: HttpConfig;                    // HTTP-specific config
  security: SecurityConfig;            // Security settings
}

/**
 * HTTP server configuration
 */
export interface HttpConfig {
  port: number;                        // Listen port
  host: string;                        // Listen address
  auth: AuthConfig;                    // Authentication
  cors: CorsConfig;                    // CORS settings
  ssl: SslConfig;                      // SSL/TLS
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  enabled: boolean;                    // Enable auth
  type: 'bearer' | 'api-key';          // Auth method
  token?: string;                      // API token
  jwt: JwtConfig;                      // JWT settings
}

/**
 * JWT configuration
 */
export interface JwtConfig {
  enabled: boolean;                    // Enable JWT
  secret?: string;                     // JWT secret
  expiresIn: string;                   // Token lifetime
}

/**
 * CORS configuration
 */
export interface CorsConfig {
  enabled: boolean;                    // Enable CORS
  origins: string[];                   // Allowed origins
  credentials: boolean;                // Allow credentials
}

/**
 * SSL/TLS configuration
 */
export interface SslConfig {
  enabled: boolean;                    // Enable SSL
  cert?: string;                       // Certificate path
  key?: string;                        // Key path
  ca?: string;                         // CA certificate path
}

/**
 * SSL certificates (loaded from files)
 */
export interface SslCertificates {
  cert: Buffer;                        // Certificate data
  key: Buffer;                         // Key data
  ca?: Buffer;                         // CA data
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  rateLimit: RateLimitConfig;          // Rate limiting
  ipFilter: IpFilterConfig;            // IP filtering
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;                    // Enable rate limit
  windowMs: number;                    // Time window (ms)
  max: number;                         // Max requests per window
}

/**
 * IP filtering configuration
 */
export interface IpFilterConfig {
  enabled: boolean;                    // Enable IP filter
  whitelist: string[];                 // Allowed IPs
  blacklist: string[];                 // Blocked IPs
}
```

#### Server Context (`src/types/server/context.ts`)

```typescript
/**
 * Server context passed to all tools
 */
export interface ServerContext {
  winccoa: WinccoaManager;             // WinCC OA manager instance
  fieldContent: string;                // Field instructions
  activeFieldName: string;             // Active field name
  projectContent: string | null;       // Project instructions (optional)
  systemPrompt: string | null;         // System prompt
}
```

### 5.4 Pmon Protocol Types

#### Pmon Types (`src/types/pmon/protocol.ts`)

```typescript
/**
 * Manager state
 */
export enum ManagerState {
  Stopped = 0,
  Init = 1,
  Running = 2,
  Blocked = 3
}

/**
 * Manager start mode
 */
export enum ManagerStartMode {
  Manual = 0,                          // Start manually
  Once = 1,                            // Start once
  Always = 2                           // Restart on crash
}

/**
 * Pmon operation mode
 */
export enum PmonMode {
  Start = 'start',
  Monitor = 'monitor',
  Wait = 'wait',
  Restart = 'restart',
  Shutdown = 'shutdown'
}

/**
 * Manager information from Pmon
 */
export interface PmonManager {
  num: number;                         // Manager number
  name: string;                        // Manager name
  state: ManagerState;                 // Current state
  startMode: ManagerStartMode;         // Start mode
  pid?: number;                        // Process ID
  startTime?: Date;                    // Start timestamp
  commandLine?: string;                // Command line
}

/**
 * Pmon system status
 */
export interface PmonStatus {
  managers: PmonManager[];             // All managers
  timestamp: Date;                     // Query time
}

/**
 * Manager properties
 */
export interface ManagerProperties {
  num: number;
  name: string;
  commandLine: string;
  startMode: ManagerStartMode;
  restartCount: number;
  options: Record<string, any>;
}
```

### 5.5 MCP Response Types

#### Response Types (`src/types/mcp/responses.ts`)

```typescript
/**
 * MCP content block
 */
export interface McpContent {
  type: "text";
  text: string;
}

/**
 * Success response
 */
export interface McpSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Error response
 */
export interface McpErrorResponse {
  error: true;
  message: string;
  code?: string;
  details?: any;
}

/**
 * MCP tool response
 */
export interface McpToolResponse {
  content: McpContent[];
}
```

### 5.6 Tool Module Types

#### Tool Types (`src/types/tools/index.ts`)

```typescript
/**
 * Tool module interface
 */
export interface ToolModule {
  registerTools: (
    server: Server,
    context: ServerContext
  ) => Promise<number> | number;
}

/**
 * Tool registration result
 */
export interface ToolRegistrationResult {
  name: string;
  success: boolean;
  count: number;
  error?: string;
}
```

---

## 6. Helper Classes

### 6.1 Base Connection (`src/helpers/drivers/BaseConnection.ts`)

**Purpose:** Abstract base class for driver connections (OPC UA, Modbus, etc.)

**Key Methods:**

```typescript
export abstract class BaseConnection {
  protected winccoa: WinccoaManager;

  constructor(winccoa: WinccoaManager) {
    this.winccoa = winccoa;
  }

  /**
   * Add peripheral address configuration to a datapoint element
   */
  protected async addAddressConfig(
    dpElement: string,
    reference: string,
    direction: number,
    datatype: number,
    drvIdent: string,
    pollGroup?: string,
    mode?: number
  ): Promise<void> {
    const config: DpAddressConfig = {
      _address: {
        _reference: reference,
        _direction: direction,
        _datatype: datatype,
        _drv_ident: drvIdent,
        _poll_group: pollGroup,
        _mode: mode
      }
    };

    await this.winccoa.dpSetConfig(dpElement, config);
  }

  /**
   * Set datapoint distribution (assign to manager)
   */
  protected async setDistribution(
    dpName: string,
    managerNumber: number
  ): Promise<void> {
    const config: DpDistribConfig = {
      _distrib: {
        _driver: managerNumber
      }
    };

    await this.winccoa.dpSetConfig(dpName, config);
  }

  /**
   * Validate datapoint element exists
   */
  protected async validateDpElement(dpElement: string): Promise<boolean> {
    try {
      await this.winccoa.dpGet(dpElement);
      return true;
    } catch {
      return false;
    }
  }

  // Abstract methods to be implemented by subclasses
  abstract addConnection(config: ConnectionConfig): Promise<void>;
  abstract deleteConnection(name: string): Promise<void>;
}
```

### 6.2 OPC UA Connection (`src/helpers/drivers/OpcUaConnection.ts`)

**Purpose:** OPC UA-specific connection implementation with smart browsing

**Key Features:**
- Intelligent auto-depth selection
- Node limit enforcement (max 800)
- Timeout protection (120 seconds)
- Cache management (5-min TTL, 50MB limit)
- Large branch detection

**Key Implementation:**

```typescript
export class OpcUaConnection extends BaseConnection {
  private browseCache: Map<string, CachedBrowseResult>;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes
  private readonly MAX_CACHE_SIZE_MB = 50;
  private readonly MAX_NODES = 800;
  private readonly BROWSE_TIMEOUT_MS = 120000;    // 120 seconds

  /**
   * Add OPC UA connection
   */
  async addConnection(config: OpcUaConnectionConfig): Promise<void> {
    // 1. Validate manager number
    if (config.managerNumber < 1 || config.managerNumber > 255) {
      throw new Error('Manager number must be between 1 and 255');
    }

    // 2. Create connection datapoint
    const dpName = `_OpcUa_${config.managerNumber}`;
    await this.winccoa.dpCreate(dpName, '_OpcUaConnection');

    // 3. Configure connection parameters
    await this.winccoa.dpSet(`${dpName}.Config.IpAddress`, config.ipAddress);
    await this.winccoa.dpSet(`${dpName}.Config.Port`, config.port);
    await this.winccoa.dpSet(`${dpName}.Config.ReconnectTimer`, config.reconnectTimer || 10);

    // 4. Set security
    if (config.securityPolicy) {
      await this.winccoa.dpSet(`${dpName}.Config.SecurityPolicy`, config.securityPolicy);
    }

    // 5. Set authentication
    if (config.username && config.password) {
      await this.winccoa.dpSet(`${dpName}.Config.Username`, config.username);
      await this.winccoa.dpSet(`${dpName}.Config.Password`, config.password);
    }

    // 6. Enable connection
    await this.winccoa.dpSet(`${dpName}.Config.Enabled`, true);
  }

  /**
   * Browse OPC UA address space with smart auto-depth
   */
  async browse(request: BrowseRequest): Promise<BrowseResponse> {
    const startTime = Date.now();
    const startNode = request.startNode || 'RootFolder';

    // Check cache
    const cacheKey = `${request.connectionName}:${startNode}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    // Smart auto-depth selection
    const maxDepth = this.determineOptimalDepth(request);

    // Browse with limits
    const result = await this.recursiveBrowse(
      request.connectionName,
      startNode,
      maxDepth,
      this.MAX_NODES,
      request.includeReferences || false
    );

    const executionTime = Date.now() - startTime;

    // Build response
    const response: BrowseResponse = {
      nodes: result.nodes,
      totalNodes: result.totalNodes,
      limitReached: result.limitReached,
      depth: maxDepth,
      largeBranches: result.largeBranches,
      executionTime
    };

    // Cache result
    this.setCached(cacheKey, response);

    return response;
  }

  /**
   * Determine optimal browse depth based on heuristics
   */
  private determineOptimalDepth(request: BrowseRequest): number {
    // If user specified depth, use it
    if (request.maxDepth !== undefined) {
      return request.maxDepth;
    }

    // Auto-depth heuristics:
    // - Start with depth 2 for initial exploration
    // - Adjust based on node limit and previous results
    const maxNodes = request.maxNodes || this.MAX_NODES;

    if (maxNodes <= 100) return 1;
    if (maxNodes <= 500) return 2;
    return 3;  // Conservative default
  }

  /**
   * Recursive browse implementation with limits
   */
  private async recursiveBrowse(
    connectionName: string,
    nodeId: string,
    maxDepth: number,
    maxNodes: number,
    includeReferences: boolean,
    currentDepth: number = 0,
    stats: RecursionStats = {
      currentDepth: 0,
      maxDepthReached: 0,
      nodesProcessed: 0
    }
  ): Promise<BrowseResult> {
    // Timeout protection
    if (Date.now() - this.browseStartTime > this.BROWSE_TIMEOUT_MS) {
      throw new Error('Browse operation timed out');
    }

    // Depth limit
    if (currentDepth >= maxDepth) {
      return { nodes: [], totalNodes: 0, limitReached: false, largeBranches: [] };
    }

    // Node limit
    if (stats.nodesProcessed >= maxNodes) {
      return { nodes: [], totalNodes: 0, limitReached: true, largeBranches: [] };
    }

    // Browse current level
    const children = await this.browseNode(connectionName, nodeId, includeReferences);
    stats.nodesProcessed += children.length;

    // Detect large branches
    const largeBranches: BranchInfo[] = [];
    if (children.length > 100) {
      largeBranches.push({
        path: nodeId,
        childCount: children.length,
        recommendation: `Consider browsing "${nodeId}" separately with specific depth`
      });
    }

    // Recurse into children
    const result: BrowseNode[] = [];
    for (const child of children) {
      if (stats.nodesProcessed >= maxNodes) break;

      result.push(child);

      if (child.hasChildren && currentDepth + 1 < maxDepth) {
        const childResult = await this.recursiveBrowse(
          connectionName,
          child.nodeId,
          maxDepth,
          maxNodes,
          includeReferences,
          currentDepth + 1,
          stats
        );

        child.children = childResult.nodes;
        largeBranches.push(...childResult.largeBranches);
      }
    }

    stats.maxDepthReached = Math.max(stats.maxDepthReached, currentDepth);

    return {
      nodes: result,
      totalNodes: stats.nodesProcessed,
      limitReached: stats.nodesProcessed >= maxNodes,
      largeBranches
    };
  }

  /**
   * Delete OPC UA connection
   */
  async deleteConnection(name: string): Promise<void> {
    const dpName = `_OpcUa_${name}`;
    await this.winccoa.dpDelete(dpName);

    // Clear cache
    this.browseCache.clear();
  }
}
```

### 6.3 Pmon Client (`src/helpers/pmon/PmonClient.ts`)

**Purpose:** TCP client for WinCC OA Process Monitor (Pmon) communication

**Key Implementation:**

```typescript
export class PmonClient {
  private host: string;
  private port: number;
  private username?: string;
  private password?: string;
  private timeout: number;

  constructor(config: PmonClientConfig) {
    this.host = config.host || process.env.WINCCOA_PMON_HOST || 'localhost';
    this.port = config.port || parseInt(process.env.WINCCOA_PMON_PORT || '4999');
    this.username = config.username || process.env.WINCCOA_PMON_USER;
    this.password = config.password || process.env.WINCCOA_PMON_PASSWORD;
    this.timeout = config.timeout || 5000;
  }

  /**
   * Get all managers
   */
  async getManagers(): Promise<PmonManager[]> {
    const response = await this.sendCommand('MANAGER LIST');
    return this.parseManagerList(response);
  }

  /**
   * Start manager
   */
  async startManager(managerNum: number): Promise<void> {
    await this.sendCommand(`MANAGER START ${managerNum}`);
  }

  /**
   * Stop manager
   */
  async stopManager(managerNum: number): Promise<void> {
    await this.sendCommand(`MANAGER STOP ${managerNum}`);
  }

  /**
   * Restart manager
   */
  async restartManager(managerNum: number): Promise<void> {
    await this.stopManager(managerNum);
    await this.delay(1000);  // Wait 1 second
    await this.startManager(managerNum);
  }

  /**
   * Get manager properties
   */
  async getManagerProperties(managerNum: number): Promise<ManagerProperties> {
    const response = await this.sendCommand(`MANAGER INFO ${managerNum}`);
    return this.parseManagerProperties(response);
  }

  /**
   * Send command to Pmon
   */
  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port,
        timeout: this.timeout
      });

      let responseData = '';

      socket.on('connect', () => {
        // Authenticate if credentials provided
        if (this.username && this.password) {
          socket.write(`AUTH ${this.username} ${this.password}\n`);
        }

        // Send command
        socket.write(`${command}\n`);
      });

      socket.on('data', (data) => {
        responseData += data.toString();

        // Check for end-of-response marker
        if (responseData.includes('\nOK\n') || responseData.includes('\nERROR\n')) {
          socket.end();
        }
      });

      socket.on('end', () => {
        resolve(responseData);
      });

      socket.on('error', (error) => {
        reject(error);
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Pmon connection timeout'));
      });
    });
  }

  /**
   * Parse manager list response
   */
  private parseManagerList(response: string): PmonManager[] {
    const managers: PmonManager[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      if (!line.trim() || line.startsWith('OK') || line.startsWith('ERROR')) continue;

      // Parse manager line: NUM NAME STATE STARTMODE PID STARTTIME
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4) continue;

      managers.push({
        num: parseInt(parts[0]),
        name: parts[1],
        state: parseInt(parts[2]) as ManagerState,
        startMode: parseInt(parts[3]) as ManagerStartMode,
        pid: parts[4] ? parseInt(parts[4]) : undefined,
        startTime: parts[5] ? new Date(parseInt(parts[5]) * 1000) : undefined
      });
    }

    return managers;
  }

  /**
   * Parse manager properties response
   */
  private parseManagerProperties(response: string): ManagerProperties {
    const properties: any = {};
    const lines = response.split('\n');

    for (const line of lines) {
      if (!line.includes(':')) continue;

      const [key, ...valueParts] = line.split(':');
      properties[key.trim()] = valueParts.join(':').trim();
    }

    return {
      num: parseInt(properties.NUM || '0'),
      name: properties.NAME || '',
      commandLine: properties.CMDLINE || '',
      startMode: parseInt(properties.STARTMODE || '0'),
      restartCount: parseInt(properties.RESTARTS || '0'),
      options: properties
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.4 Dashboard Manager (`src/helpers/dashboards/DashboardManager.ts`)

**Purpose:** Dashboard creation and management

```typescript
export class DashboardManager {
  private winccoa: WinccoaManager;

  constructor(winccoa: WinccoaManager) {
    this.winccoa = winccoa;
  }

  /**
   * Create dashboard
   */
  async createDashboard(config: DashboardConfig): Promise<string> {
    // Create dashboard datapoint
    const dpName = `Dashboard_${this.generateId()}`;
    await this.winccoa.dpCreate(dpName, '_Dashboard');

    // Set properties
    await this.winccoa.dpSet(`${dpName}.Name`, config.name);
    await this.winccoa.dpSet(`${dpName}.Description`, config.description);
    await this.winccoa.dpSet(`${dpName}.CreatedBy`, config.createdBy);
    await this.winccoa.dpSet(`${dpName}.CreatedAt`, new Date());

    return dpName;
  }

  /**
   * Add widget to dashboard
   */
  async addWidget(dashboardName: string, widget: WidgetInstance): Promise<void> {
    const widgetArray = await this.winccoa.dpGet(`${dashboardName}.Widgets`);
    widgetArray.push(widget);
    await this.winccoa.dpSet(`${dashboardName}.Widgets`, widgetArray);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## 7. MCP Tools Implementation

### 7.1 Tool Registration Pattern

All tools follow this pattern:

```typescript
// Example: src/tools/datapoints/dp_basic.ts
import { z } from 'zod';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerContext } from '../../types/index.js';

export function registerTools(server: Server, context: ServerContext): number {
  let toolCount = 0;

  // Tool 1: Get datapoint types
  server.tool(
    "get-dpTypes",
    "List all datapoint types, optionally filtered by pattern",
    {
      pattern: z.string().optional().describe("Wildcard pattern (e.g., 'Pump*')")
    },
    async ({ pattern }) => {
      try {
        const types = await context.winccoa.dpTypeQuery(pattern || '*');

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, types })
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: true, message: error.message })
          }]
        };
      }
    }
  );
  toolCount++;

  // Tool 2: Get datapoints
  server.tool(
    "get-datapoints",
    "Search for datapoints with pattern matching",
    {
      pattern: z.string().describe("Search pattern (e.g., 'System1.Pump*')"),
      type: z.string().optional().describe("Filter by datapoint type"),
      limit: z.number().optional().describe("Max results (default: 200)")
    },
    async ({ pattern, type, limit }) => {
      try {
        const maxLimit = Math.min(limit || 200, 200);
        const datapoints = await context.winccoa.dpQuery(pattern, type);

        const result = {
          datapoints: datapoints.slice(0, maxLimit),
          total: datapoints.length,
          hasMore: datapoints.length > maxLimit,
          limit: maxLimit
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, ...result })
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: true, message: error.message })
          }]
        };
      }
    }
  );
  toolCount++;

  // Tool 3: Get value
  server.tool(
    "get-value",
    "Read the current value of a datapoint element",
    {
      dpElement: z.string().describe("Datapoint element path (e.g., 'System1.Pump1.value')")
    },
    async ({ dpElement }) => {
      try {
        const value = await context.winccoa.dpGet(dpElement);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ success: true, dpElement, value })
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ error: true, message: error.message })
          }]
        };
      }
    }
  );
  toolCount++;

  return toolCount;
}
```

### 7.2 Tool Categories

#### 7.2.1 Datapoint Tools (5 files)

**`datapoints/dp_basic.ts`** - 3 tools
- `get-dpTypes` - List datapoint types with pattern matching
- `get-datapoints` - Search datapoints (max 200 results)
- `get-value` - Read datapoint element value

**`datapoints/dp_create.ts`** - 1 tool
- `create-datapoint` - Create new datapoint instance
  - Parameters: `name` (string), `type` (string)
  - Validates type exists before creation

**`datapoints/dp_set.ts`** - 2 tools
- `set-value` - Set single datapoint element value
  - Parameters: `dpElement` (string), `value` (any)
  - Type validation and conversion
- `set-multiple` - Batch set multiple values
  - Parameters: `values` (array of {dpElement, value})
  - Atomic operation (all or nothing)

**`datapoints/dp_types.ts`** - 2 tools
- `list-datapoint-types` - Enumerate all types
  - Returns hierarchical structure with elements
- `get-type-structure` - Get detailed type information
  - Parameters: `typeName` (string)
  - Returns full element hierarchy

**`datapoints/dp_type_create.ts`** - 1 tool
- `create-datapoint-type` - Define new datapoint type
  - Parameters: `typeName` (string), `elements` (array)
  - Validates element types

#### 7.2.2 OPC UA Tools (2 files)

**`opcua/opcua_connection.ts`** - 3 tools
- `opcua-add-connection` - Establish OPC UA connection
  - Parameters: `ipAddress`, `port`, `managerNumber`, security config
  - Auto-creates connection datapoint
- `opcua-browse` - Navigate OPC UA address space
  - Parameters: `connectionName`, `startNode`, `maxDepth`, `maxNodes`
  - Smart auto-depth selection
  - Pagination (max 800 nodes)
  - Cache management (5-min TTL)
  - Large branch detection
- `opcua-delete-connection` - Remove OPC UA connection
  - Parameters: `connectionName` (string)
  - Cleans up connection datapoint

**`opcua/opcua_address.ts`** - 1 tool
- `opcua-add-address-config` - Configure OPC UA addressing
  - Parameters: `dpElement`, `opcuaNodePath`, `direction`, `datatype`
  - Manager auto-detection
  - Poll group creation
  - OPC UA datatype mapping (750-768)

#### 7.2.3 Manager Tools (5 files)

**`manager/manager_list.ts`** - 1 tool
- `list-managers` - Get all WinCC OA managers
  - Returns: number, name, state, PID, start mode, start time
  - Pmon integration for real-time status

**`manager/manager_control.ts`** - 3 tools
- `start-manager` - Start manager by number
- `stop-manager` - Stop manager by number
- `restart-manager` - Restart manager (stop + wait + start)

**`manager/manager_add.ts`** - 1 tool
- `add-manager` - Create new manager entry
  - Parameters: `managerNum`, `name`, `commandLine`, `startMode`

**`manager/manager_remove.ts`** - 1 tool
- `remove-manager` - Delete manager entry
  - Parameters: `managerNum` (number)

**`manager/manager_properties.ts`** - 2 tools
- `get-manager-properties` - Get manager configuration
- `set-manager-properties` - Update manager configuration

#### 7.2.4 Common Config Tools (3 files)

**`common/common_query.ts`** - 1 tool
- `common-query` - Read common attributes
  - Attributes: description, alias, format, unit
  - Multi-language support (UTF-8)

**`common/common_set.ts`** - 1 tool
- `common-set` - Write common attributes
  - Parameters: `dpElement`, `attribute`, `value`, `language`

**`common/common_delete.ts`** - 1 tool
- `common-delete` - Clear common attributes
  - Parameters: `dpElement`, `attribute`

#### 7.2.5 Alarm Tools (2 files)

**`alarms/alarm_set.ts`** - 1 tool
- `set-alarm` - Configure alarm threshold
  - Parameters: `dpElement`, `threshold`, `severity`, `hysteresis`, `delay`
  - Severity levels: Info, Warning, Error, Fatal

**`alarms/alarm_delete.ts`** - 1 tool
- `delete-alarm` - Remove alarm configuration
  - Parameters: `dpElement` (string)

#### 7.2.6 Archive Tools (3 files)

**`archive/archive_query.ts`** - 1 tool
- `query-archive` - Retrieve historical data
  - Parameters: `dpElement`, `startTime`, `endTime`, `limit`
  - Time range filtering

**`archive/archive_set.ts`** - 1 tool
- `set-archive-config` - Configure archival
  - Parameters: `dpElement`, `archiveType`, `deadband`, `timeInterval`
  - Archive types: Value, Time, Event

**`archive/archive_delete.ts`** - 1 tool
- `delete-archive` - Remove archive configuration
  - Parameters: `dpElement` (string)

#### 7.2.7 Dashboard Tools (2 files)

**`dashboards/dashboard.ts`** - 3 tools
- `create-dashboard` - Create dashboard
  - Parameters: `name`, `description`, `createdBy`
- `get-dashboard` - Retrieve dashboard
  - Parameters: `dashboardName` (string)
- `update-dashboard` - Modify dashboard
  - Parameters: `dashboardName`, updates

**`dashboards/widget.ts`** - 2 tools
- `create-widget` - Create widget
  - Parameters: `dashboardName`, `widgetType`, `position`, `properties`
  - Widget types: Chart, Gauge, Table, Button, Label
- `update-widget` - Modify widget
  - Parameters: `dashboardName`, `widgetId`, updates

#### 7.2.8 PV Range Tools (3 files)

**`pv_range/pv_range_query.ts`** - 1 tool
- `get-pv-range` - Get physical value range
  - Parameters: `dpElement` (string)
  - Returns: min, max, unit

**`pv_range/pv_range_set.ts`** - 1 tool
- `set-pv-range` - Set physical value range
  - Parameters: `dpElement`, `min`, `max`, `unit`

**`pv_range/pv_range_delete.ts`** - 1 tool
- `delete-pv-range` - Remove PV range
  - Parameters: `dpElement` (string)

#### 7.2.9 Icon Tools (1 file)

**`icons/icon.ts`** - 1 tool
- `create-svg-icon` - Generate custom SVG icon
  - Parameters: `name`, `svgContent`, `width`, `height`
  - For widget headers/footers

---

## 8. Server Configuration

### 8.1 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# ====================
# REQUIRED SETTINGS
# ====================

# API Token (REQUIRED)
# Generate: openssl rand -hex 32
MCP_API_TOKEN=your-secure-token-here

# ====================
# SERVER CONFIGURATION
# ====================

# Server Mode: 'http' or 'stdio'
MCP_MODE=http

# HTTP Server Settings
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0

# Authentication Type: 'bearer' or 'api-key'
MCP_AUTH_TYPE=bearer

# ====================
# SECURITY SETTINGS
# ====================

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100

# IP Filtering (comma-separated)
IP_FILTER_ENABLED=false
IP_WHITELIST=192.168.1.100,192.168.1.101
IP_BLACKLIST=

# CORS Configuration
MCP_CORS_ENABLED=false
MCP_CORS_ORIGINS=*
MCP_CORS_CREDENTIALS=false

# SSL/TLS Configuration
MCP_SSL_ENABLED=false
MCP_SSL_CERT_PATH=/path/to/cert.pem
MCP_SSL_KEY_PATH=/path/to/key.pem
MCP_SSL_CA_PATH=/path/to/ca.pem

# ====================
# WINCC OA SETTINGS
# ====================

# Field Configuration
WINCCOA_FIELD=default

# Project Instructions (optional)
# Path relative to WinCC OA project directory
# WINCCOA_PROJECT_INSTRUCTIONS=./javascript/mcpServer/project-instructions.md

# ====================
# PMON CONFIGURATION
# ====================

# Pmon TCP Connection Settings
WINCCOA_PMON_HOST=localhost
WINCCOA_PMON_PORT=4999

# Pmon Authentication (optional)
# WINCCOA_PMON_USER=admin
# WINCCOA_PMON_PASSWORD=password

# ====================
# TOOLS CONFIGURATION
# ====================

# Tools to load (comma-separated, no .js extension)
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,datapoints/dp_type_create,icons/icon,opcua/opcua_connection,opcua/opcua_address,common/common_query,common/common_set,common/common_delete,alarms/alarm_set,alarms/alarm_delete,archive/archive_set,archive/archive_delete,archive/archive_query,dashboards/dashboard,dashboards/widget,pv_range/pv_range_query,pv_range/pv_range_set,pv_range/pv_range_delete
```

### 8.2 Configuration Validation

Configuration is validated on startup (`src/config/server.config.ts:validateConfig()`):

```typescript
export function validateConfig(): string[] {
  const errors: string[] = [];

  // Require API token
  if (!serverConfig.http.auth.token) {
    errors.push('MCP_API_TOKEN must be set');
  }

  // Validate port range
  if (serverConfig.http.port < 1 || serverConfig.http.port > 65535) {
    errors.push('MCP_HTTP_PORT must be between 1 and 65535');
  }

  // Validate SSL config
  if (serverConfig.http.ssl.enabled) {
    if (!serverConfig.http.ssl.cert || !serverConfig.http.ssl.key) {
      errors.push('SSL enabled but cert or key not specified');
    }
  }

  // Validate rate limit
  if (serverConfig.security.rateLimit.enabled) {
    if (serverConfig.security.rateLimit.max < 1) {
      errors.push('RATE_LIMIT_MAX must be at least 1');
    }
  }

  return errors;
}
```

### 8.3 Field Configuration

Field-specific instructions in `src/fields/`:

```
src/fields/
├── default.md                 # Default field configuration
├── production.md              # Production environment
├── development.md             # Development environment
└── testing.md                 # Testing environment
```

Each field configuration contains:
- Process-specific instructions
- Safety guidelines
- Naming conventions
- Operational procedures

---

## 9. Security Implementation

### 9.1 Authentication Middleware

```typescript
// src/index_http.ts
function authenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Skip health check endpoint
  if (req.path === '/health') {
    return next();
  }

  const authType = serverConfig.http.auth.type;
  const expectedToken = serverConfig.http.auth.token;

  if (!expectedToken) {
    res.status(500).json({ error: 'Server misconfigured: No API token set' });
    return;
  }

  let providedToken: string | undefined;

  if (authType === 'bearer') {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedToken = authHeader.substring(7);
    }
  } else if (authType === 'api-key') {
    // Extract API key from header or query parameter
    providedToken =
      req.headers['x-api-key'] as string ||
      req.query.api_key as string;
  }

  if (!providedToken || providedToken !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
```

### 9.2 Rate Limiting

```typescript
// src/index_http.ts
import rateLimit from 'express-rate-limit';

if (serverConfig.security.rateLimit.enabled) {
  const limiter = rateLimit({
    windowMs: serverConfig.security.rateLimit.windowMs,
    max: serverConfig.security.rateLimit.max,
    message: 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use('/mcp', limiter);
}
```

### 9.3 IP Filtering

```typescript
// src/index_http.ts
function ipFilterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const clientIp = req.ip || req.connection.remoteAddress;
  const { whitelist, blacklist } = serverConfig.security.ipFilter;

  // Check blacklist first
  if (blacklist.length > 0 && blacklist.includes(clientIp)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  // Check whitelist
  if (whitelist.length > 0 && !whitelist.includes(clientIp)) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  next();
}
```

### 9.4 CORS Configuration

```typescript
// src/index_http.ts
import cors from 'cors';

if (serverConfig.http.cors.enabled) {
  const corsOptions = {
    origin: serverConfig.http.cors.origins,
    credentials: serverConfig.http.cors.credentials,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  };

  app.use(cors(corsOptions));
}
```

### 9.5 SSL/TLS Support

```typescript
// src/index_http.ts
import https from 'https';
import { loadSSLConfig } from './config/server.config.js';

let serverInstance: http.Server | https.Server;

if (serverConfig.http.ssl.enabled) {
  const sslCerts = loadSSLConfig();
  if (sslCerts) {
    serverInstance = https.createServer(sslCerts, app);
    console.log('✓ SSL/TLS enabled');
  } else {
    console.error('✗ SSL enabled but certificate loading failed');
    process.exit(1);
  }
} else {
  serverInstance = http.createServer(app);
}

serverInstance.listen(port, host, () => {
  console.log(`Server listening on ${host}:${port}`);
});
```

---

## 10. Build and Deployment

### 10.1 TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "**/*.test.ts"]
}
```

### 10.2 Build Commands

```bash
# Clean build
rm -rf build/
npx tsc

# Development build with run
npm run dev

# Production build
npm run build
```

**Important:** Use `npx tsc` instead of `npm run build` for development.

### 10.3 Package.json Scripts

```json
{
  "scripts": {
    "build": "./build.sh",
    "postinstall": "node postinstall.cjs",
    "inspect": "npx @modelcontextprotocol/inspector",
    "start": "node build/index_stdio.js",
    "start:http": "node build/index_http.js",
    "dev": "tsc && npm start"
  },
  "bin": {
    "winccoa-mcp-stdio": "./build/index_stdio.js",
    "winccoa-mcp-http": "./build/index_http.js"
  }
}
```

### 10.4 Deployment Scenarios

#### A. Local Development (StdIO)

```bash
# 1. Build
npx tsc

# 2. Run
MCP_MODE=stdio npm start
```

#### B. HTTP Server (Local Network)

```bash
# 1. Create .env
cp .env.example .env
# Edit .env with configuration

# 2. Build
npx tsc

# 3. Run
MCP_MODE=http npm start:http
```

#### C. Production Server (HTTPS)

```bash
# 1. Generate SSL certificates
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes

# 2. Configure .env
MCP_MODE=http
MCP_HTTP_HOST=0.0.0.0
MCP_HTTP_PORT=443
MCP_SSL_ENABLED=true
MCP_SSL_CERT_PATH=/path/to/cert.pem
MCP_SSL_KEY_PATH=/path/to/key.pem
MCP_API_TOKEN=<secure-random-token>
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100

# 3. Build and run
npx tsc
sudo npm start:http  # Requires sudo for port 443
```

#### D. Windows Service

Use `node-windows` or `nssm` to run as Windows service:

```bash
# Install nssm
# Download from https://nssm.cc/

# Install service
nssm install WinccoaMcpServer "C:\Program Files\nodejs\node.exe" "C:\path\to\build\index_http.js"
nssm set WinccoaMcpServer AppDirectory "C:\path\to\project"
nssm set WinccoaMcpServer AppEnvironmentExtra "MCP_MODE=http"

# Start service
nssm start WinccoaMcpServer
```

---

## 11. Step-by-Step Manual Setup

### 11.1 Prerequisites

1. **Install Node.js:**
   - Download from https://nodejs.org/
   - Version: >= 18.0.0
   - Verify: `node --version`

2. **Install WinCC OA:**
   - Version 3.21 or compatible
   - Ensure `winccoa-manager` package is available at:
     `C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager`

3. **Install Git:**
   - Download from https://git-scm.com/
   - Verify: `git --version`

### 11.2 Project Setup

```bash
# 1. Create project directory
mkdir winccoa-mcp-server
cd winccoa-mcp-server

# 2. Initialize Node.js project
npm init -y

# 3. Configure package.json
```

Edit `package.json`:

```json
{
  "name": "@etm-professional-control/winccoa-mcp-server",
  "version": "1.2.0",
  "description": "MCP Server for WinCC OA with field-specific configurations",
  "type": "module",
  "bin": {
    "winccoa-mcp-stdio": "./build/index_stdio.js",
    "winccoa-mcp-http": "./build/index_http.js"
  },
  "scripts": {
    "build": "./build.sh",
    "start": "node build/index_stdio.js",
    "start:http": "node build/index_http.js",
    "dev": "tsc && npm start"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^5.1.0",
    "express-rate-limit": "^7.1.5",
    "mcp-remote": "^0.1.13",
    "zod": "^3.25.51"
  },
  "peerDependencies": {
    "winccoa-manager": "file:C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
  },
  "peerDependenciesMeta": {
    "winccoa-manager": {
      "optional": true
    }
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^18.19.129",
    "typescript": "^5.8.3",
    "winccoa-manager": "file:C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
  }
}
```

```bash
# 4. Install dependencies
npm install
```

### 11.3 Create Project Structure

```bash
# Create directory structure
mkdir -p src/{config,tools/{datapoints,opcua,manager,common,alarms,archive,dashboards,pv_range,icons},helpers/{drivers,pmon,dashboards,icons},types/{winccoa,drivers,server,mcp,pmon,dashboards,tools},utils,fields}

mkdir -p build
```

### 11.4 Create TypeScript Configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "./build",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build", "**/*.test.ts"]
}
```

### 11.5 Create Core Files

Follow the implementations in sections 5, 6, and 7 to create all TypeScript files.

**Key files to create:**

1. **Entry Points:**
   - `src/index_http.ts` (from section 2.2A)
   - `src/index_stdio.ts` (from section 2.2B)

2. **Server Initialization:**
   - `src/server.ts` (from section 2.3)
   - `src/tool_loader.ts` (from section 2.4)

3. **Configuration:**
   - `src/config/server.config.ts` (from section 8.1)

4. **Type Definitions:**
   - Create all files from section 5

5. **Helper Classes:**
   - Create all files from section 6

6. **MCP Tools:**
   - Create all files from section 7

7. **Environment Configuration:**
   - Copy `.env.example` from section 8.1
   - Create `.env` with actual values

### 11.6 Create Field Configuration

Create `src/fields/default.md`:

```markdown
# Default Field Configuration

## Process Overview

This is the default field configuration for WinCC OA MCP Server.

## Naming Conventions

- Datapoints: Use PascalCase (e.g., `Pump1`, `Valve2`)
- Types: Prefix with project name (e.g., `MyProject_PumpType`)

## Safety Guidelines

1. Always verify datapoint exists before writing
2. Check current value before critical operations
3. Log all write operations
4. Implement confirmation for dangerous actions

## Operational Procedures

### Starting Equipment

1. Check prerequisites (power, safety interlocks)
2. Set equipment to ready state
3. Enable control loop
4. Start equipment
5. Monitor for normal operation

### Stopping Equipment

1. Disable control loop
2. Ramp down to stop
3. Wait for confirmation
4. Set to safe state
```

### 11.7 Build Project

```bash
# Build TypeScript to JavaScript
npx tsc

# Verify build output
ls build/
```

### 11.8 Test StdIO Mode

```bash
# Set environment
export MCP_MODE=stdio

# Run server
npm start

# Test with MCP inspector
npx @modelcontextprotocol/inspector
```

### 11.9 Test HTTP Mode

```bash
# Create .env file
cp .env.example .env

# Edit .env
# Set MCP_API_TOKEN=<generate secure token>

# Run HTTP server
npm start:http

# Test with curl
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

### 11.10 Integration with WinCC OA

1. **Copy Project to WinCC OA:**
   ```bash
   cp -r . <WinCC_OA_Project>/javascript/mcpServer/
   ```

2. **Add JavaScript Manager:**
   - Open WinCC OA Console
   - Add new manager: `WCCOAjavaScript`
   - Set script path: `mcpServer/build/index_http.js`
   - Set options: `-n -httpMode`

3. **Start Manager:**
   ```bash
   # Via Pmon
   WCCOApmon -start WCCOAjavaScript -num 10
   ```

4. **Verify Operation:**
   - Check manager status in Pmon
   - Test MCP endpoint
   - Review logs

---

## 12. Testing and Validation

### 12.1 Unit Testing

Create test files for each component:

```typescript
// Example: test-datapoint-tools.ts
import { WinccoaManager } from 'winccoa-manager';
import { registerTools } from './src/tools/datapoints/dp_basic.js';

async function testDpBasic() {
  const winccoa = new WinccoaManager();
  const context = {
    winccoa,
    fieldContent: '',
    activeFieldName: 'default',
    projectContent: null,
    systemPrompt: null
  };

  // Mock server
  const server = {
    tool: (name: string, desc: string, schema: any, handler: Function) => {
      console.log(`Registered tool: ${name}`);
    }
  };

  const count = registerTools(server as any, context);
  console.log(`Registered ${count} tools`);
}

testDpBasic().catch(console.error);
```

### 12.2 Integration Testing

```typescript
// test-opcua-browse.ts
import { OpcUaConnection } from './src/helpers/drivers/OpcUaConnection.js';
import { WinccoaManager } from 'winccoa-manager';

async function testOpcUaBrowse() {
  const winccoa = new WinccoaManager();
  const opcua = new OpcUaConnection(winccoa);

  // Add connection
  await opcua.addConnection({
    name: 'TestServer',
    ipAddress: '192.168.1.100',
    port: 4840,
    managerNumber: 1
  });

  // Browse
  const result = await opcua.browse({
    connectionName: 'TestServer',
    startNode: 'RootFolder',
    maxDepth: 2,
    maxNodes: 500
  });

  console.log(`Found ${result.totalNodes} nodes`);
  console.log(`Depth reached: ${result.depth}`);
  console.log(`Limit reached: ${result.limitReached}`);
  console.log(`Large branches: ${result.largeBranches.length}`);
}

testOpcUaBrowse().catch(console.error);
```

### 12.3 Security Testing

```bash
# Test authentication
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Expected: 401 Unauthorized

curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Expected: 401 Unauthorized

curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer correct-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
# Expected: 200 OK with tool list

# Test rate limiting
for i in {1..150}; do
  curl -X POST http://localhost:3000/mcp \
    -H "Authorization: Bearer correct-token" \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
done
# Expected: First 100 succeed, then 429 Too Many Requests
```

### 12.4 Performance Testing

```typescript
// test-performance.ts
import { WinccoaManager } from 'winccoa-manager';

async function testBatchPerformance() {
  const winccoa = new WinccoaManager();

  // Create 1000 datapoints
  const start = Date.now();
  const promises = [];

  for (let i = 0; i < 1000; i++) {
    promises.push(
      winccoa.dpCreate(`TestDp${i}`, 'ExampleDPT')
    );
  }

  await Promise.all(promises);
  const elapsed = Date.now() - start;

  console.log(`Created 1000 datapoints in ${elapsed}ms`);
  console.log(`Average: ${elapsed / 1000}ms per datapoint`);
}

testBatchPerformance().catch(console.error);
```

---

## 13. Troubleshooting

### 13.1 Common Issues

#### A. "Cannot find module 'winccoa-manager'"

**Cause:** `winccoa-manager` not installed or wrong path

**Solution:**
```bash
# Verify WinCC OA installation
ls "C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"

# Install as dev dependency
npm install --save-dev "file:C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
```

#### B. "MCP_API_TOKEN must be set"

**Cause:** `.env` file missing or token not set

**Solution:**
```bash
# Create .env file
cp .env.example .env

# Generate secure token
openssl rand -hex 32

# Add to .env
echo "MCP_API_TOKEN=<generated-token>" >> .env
```

#### C. "Port 3000 already in use"

**Cause:** Another process using the port

**Solution:**
```bash
# Find process using port
netstat -ano | findstr :3000

# Kill process or change port in .env
MCP_HTTP_PORT=3001
```

#### D. "SSL certificate loading failed"

**Cause:** Certificate files not found or invalid

**Solution:**
```bash
# Verify certificate files exist
ls /path/to/cert.pem
ls /path/to/key.pem

# Check file permissions
chmod 600 /path/to/key.pem

# Verify certificate validity
openssl x509 -in /path/to/cert.pem -text -noout
```

#### E. "Pmon connection timeout"

**Cause:** Pmon not running or wrong host/port

**Solution:**
```bash
# Verify Pmon is running
WCCOApmon -status

# Check Pmon port
netstat -ano | findstr :4999

# Test connection
telnet localhost 4999
```

#### F. "Browse operation timed out"

**Cause:** OPC UA server slow or large address space

**Solution:**
- Reduce `maxDepth` parameter
- Reduce `maxNodes` parameter
- Browse specific branches instead of root
- Increase timeout in `OpcUaConnection.ts`

### 13.2 Debug Logging

Add debug logging to troubleshoot issues:

```typescript
// Enable debug logging
process.env.DEBUG = 'mcp:*';

// Add logging to tools
console.log('[DEBUG] Tool called:', toolName, params);
console.log('[DEBUG] WinCC OA response:', response);
console.log('[DEBUG] Error:', error.message, error.stack);
```

### 13.3 WinCC OA Integration Issues

#### A. "Datapoint does not exist"

**Solution:**
```typescript
// Always verify before operations
const exists = await winccoa.dpExists(dpName);
if (!exists) {
  throw new Error(`Datapoint ${dpName} does not exist`);
}
```

#### B. "Type mismatch"

**Solution:**
```typescript
// Get datapoint type before writing
const dpInfo = await winccoa.dpGetInfo(dpName);
console.log('Expected type:', dpInfo.type);

// Convert value to correct type
if (dpInfo.elementType === DpElementType.Float) {
  value = parseFloat(value);
} else if (dpInfo.elementType === DpElementType.Int) {
  value = parseInt(value);
}
```

#### C. "Permission denied"

**Solution:**
- Check WinCC OA user permissions
- Verify manager has write access
- Check datapoint protection settings

---

## Conclusion

This comprehensive guide provides all necessary information to manually reproduce the WinCC OA MCP Server. It covers:

✓ Complete architecture and design patterns
✓ All type definitions and interfaces
✓ Helper classes and utilities
✓ All 26 MCP tools with implementation details
✓ Configuration and security setup
✓ Build and deployment procedures
✓ Step-by-step manual setup instructions
✓ Testing and troubleshooting guides

For additional support:
- GitHub Repository: https://github.com/winccoa/winccoa-ae-js-mcpserver
- WinCC OA Documentation: https://www.winccoa.com/documentation
- MCP Specification: https://modelcontextprotocol.io/

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Author:** ETM Control GesmbH (with AI assistance)
