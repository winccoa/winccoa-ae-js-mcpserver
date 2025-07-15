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
npm install @etm/winccoa-mcp-server
```

**Note for Windows users:** You may need to run Command Prompt as Administrator for npm install commands.

## Step 2: Install WinCC OA Manager

The WinCC OA JavaScript Manager is required but **not bundled** with the MCP server for licensing reasons.

### 2.1 Locate Your WinCC OA Installation

Find your WinCC OA installation directory (typically):
- **Windows:** `C:/Siemens/Automation/WinCC_OA/3.20/`
- **Linux:** `/opt/WinCC_OA/3.20/`

### 2.2 Install Manager Package

Replace the path with your actual WinCC OA installation:

```bash
# Windows example
npm install file:C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager

# Linux example  
npm install file:/opt/WinCC_OA/3.20/javascript/winccoa-manager
```

## Step 3: Basic Configuration

### 3.1 Create Environment File

```bash
# Copy example configuration
cp .env.example .env

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