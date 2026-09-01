# Installation Guide

Complete setup instructions for the WinCC OA MCP Server.

## Prerequisites

- **WinCC OA 3.20** or higher
- **Node.js 18+** installed
- **npm** package manager
- **Windows 10/11** or **Linux**

## Step 1: Install MCP Server

### 1.1 Navigate to Project Directory

```bash
# Change to your WinCC OA project directory
cd <OA_ProjPath>/javascript

# Create MCP server directory
mkdir mcpServer
cd mcpServer
```

### 1.2 Install Server Package

```bash
# Install the MCP server package (automatic extraction)
npm install @etm-professional-control/winccoa-mcp-server
```

**Note for Windows users:** You may need to run Command Prompt as Administrator for npm install commands.

### 1.3 Alternative: build from source

Most users should install the published package as shown above. To build from a clone of the
repository instead:

```bash
cd mcpWinCCOA
npm install --ignore-scripts
npm run build
```

`npm run build` runs `build.mjs`, which is plain Node and needs **no shell** - it works identically
in cmd, PowerShell, Git Bash and on Linux. It compiles TypeScript and copies the runtime assets
(`fields/`, `systemprompt.md`, `config/demo-project-instructions.md`) into `build/`.

Do not substitute a bare `npx tsc`: it skips those copies, and the server will start but fail to
find its field definitions and system prompt.

Building needs nothing else — the repository carries its own type declarations. **Running** the built
server needs the real `winccoa-manager` from your WinCC OA installation, so add it the same way as in
[step 2.2](#22-install-manager-package), from the `mcpWinCCOA` directory:

```bash
npm install --save-peer file:"C:/Program Files/Siemens/WinCC_OA/3.21/javascript/winccoa-manager"
node -e "console.log(require.resolve('winccoa-manager'))"
```

This modifies `package.json` and `package-lock.json` with a path specific to your machine. **Keep
those changes local and never commit them** — a committed absolute path breaks `npm install` for
everyone else, and has previously broken CI on Windows. Re-run the command after any `npm install` or
`npm ci`, which remove the link.

## Step 2: Install WinCC OA Manager

The WinCC OA JavaScript Manager is required but **not bundled** with the MCP server for licensing reasons.

### 2.1 Locate Your WinCC OA Installation

Find your WinCC OA installation directory. The default path depends on the version:

**WinCC OA 3.20:**
- **Windows:** `C:/Siemens/Automation/WinCC_OA/3.20/`
- **Linux:** `/opt/WinCC_OA/3.20/`

**WinCC OA 3.21:**
- **Windows:** `C:\Program Files\Siemens\WinCC_OA\3.21\`
- **Linux:** `/opt/WinCC_OA/3.21/`

### 2.2 Install Manager Package

Replace the path with your actual WinCC OA installation, and use **`--save-peer`**:

```bash
# Windows - WinCC OA 3.20 example
npm install --save-peer file:C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager

# Windows - WinCC OA 3.21 example (note: path contains spaces, use quotes)
npm install --save-peer file:"C:\Program Files\Siemens\WinCC_OA\3.21\javascript\winccoa-manager"

# Linux example
npm install --save-peer file:/opt/WinCC_OA/3.21/javascript/winccoa-manager
```

Then confirm it resolves:

```bash
node -e "console.log(require.resolve('winccoa-manager'))"
```

> **⚠️ `--save-peer` is required on npm 11 and later.** `winccoa-manager` is declared an *optional*
> `peerDependency`, and from npm 11 a plain `npm install file:...` **silently does nothing**: it prints
> `added 25 packages` and exits 0, having installed only the manager's own dependencies and never
> created `node_modules/winccoa-manager`. The server then fails at startup with
> `ERR_MODULE_NOT_FOUND: Cannot find package 'winccoa-manager'`.
>
> Verified behaviour with identical inputs: npm 10.9.4 creates the link, npm 11.6.0 does not.
> `--save-peer` works on both, and has the further advantage of recording the package under
> `peerDependencies` rather than `dependencies` — the latter must never happen, since
> `winccoa-manager` is proprietary Siemens code that must not be redistributed.
>
> Neither `--include=peer`, `--include=optional`, `--legacy-peer-deps`, `--install-links`, nor running
> as Administrator makes a difference. Note also that a later plain `npm install` or `npm ci` removes
> the link again — that is what "optional" means to npm — so re-run the command above afterwards.

## Step 3: Basic Configuration

### 3.1 Create Environment File

```bash
# Copy example configuration
copy .env.example .env    # Windows (cmd)
cp .env.example .env      # Linux / macOS / Git Bash

# Edit configuration file
notepad .env        # Windows
nano .env          # Linux
```

### 3.2 Minimal Configuration

Edit `.env` with these required settings:

```env
# REQUIRED: Generate secure token
# Command: openssl rand -hex 32
MCP_API_TOKEN=your-secure-token-here

# Server settings
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0

# Choose industry field
WINCCOA_FIELD=default

# Configure tools to load
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types
```

## Step 4: Configure WinCC OA Manager

### 4.1 Add JavaScript Manager

In WinCC OA GEDI (WinCC OA Editor):

1. Open **System Management**
2. Navigate to **Console** → **Managers**
3. Right-click and select **Insert Manager**
4. Configure:
   - **Manager Type:** `JavaScript Manager`
   - **Script Path:** `mcpServer/index_http.js`
   - **Manager Number:** (auto-assign)
   - **Manager Name:** `MCP_Server` (or your choice)

### 4.2 Start Manager

- Right-click the manager
- Select **Start** or set to **Auto-start**

## Step 5: Verify Installation

### 5.1 Check Server Logs

Monitor the WinCC OA Log Viewer for:
```
✅ MCP Server initialized successfully
✅ Tools loaded and registered
✅ Server listening on port 3000
```

### 5.2 Test HTTP Endpoint

```bash
# Test server response
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/mcp
```

Expected response: JSON with server capabilities.

## Troubleshooting Installation

### Common Issues

**"winccoa-manager not found"**
- Verify WinCC OA installation path
- Check file permissions
- Ensure WinCC OA 3.20+ is installed

**"Permission denied"**
- Run npm as Administrator (Windows)
- Check directory permissions (Linux)
- Verify WinCC OA project directory access

**"Port already in use"**
- Change `MCP_HTTP_PORT` in `.env`
- Check for conflicting services
- Verify firewall settings

**JavaScript Manager fails to start**
- Check script path: `mcpServer/index_http.js`
- Verify `.env` file exists and is configured
- Check WinCC OA logs for specific error messages

### Windows-Specific Notes

- **User Account Control:** May require Administrator privileges
- **Antivirus:** May flag Node.js processes - add exceptions
- **Firewall:** May block port 3000 - add exception if needed
- **Path Separators:** Use forward slashes `/` in script paths

### Linux-Specific Notes

- **File Permissions:** Ensure WinCC OA can read project directory
- **Node.js Version:** Use Node Version Manager (nvm) for version control
- **Service User:** WinCC OA service user needs npm access

## Next Steps

- **[Configuration](CONFIGURATION.md)** - Detailed .env options
- **[Tools](TOOLS.md)** - Available tools and customization
- **[Instructions](INSTRUCTIONS.md)** - Industry templates and project rules
