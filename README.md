# WinCC OA MCP Server

**AI Integration for Industrial Automation**

This Model Context Protocol (MCP) server connects AI assistants to WinCC OA SCADA systems, enabling intelligent automation and monitoring for industrial environments.

## Quick Start

**Ask your AI:**
- "Show me all temperature values in the plant"
- "Which pumps are currently running?"
- "Set the setpoint for pump P-101 to 50%"
- "Create a production report for today"
- 
## ⚠️ Warning

**This tool can modify your WinCC OA system configuration and runtime data.** Changes made through this MCP server directly affect your SCADA system and connected industrial processes. Use at your own risk and ensure proper testing in a safe environment before deploying to production systems.

**To prevent write operations to SCADA configuration and runtime data**, exclude these tool categories from your configuration:
- **Datapoints**: `datapoints/dp_set`, `datapoints/dp_create`, `datapoints/dp_type_create`
- **Alarms**: `alarms/alarm_set`, `alarms/alarm_delete`
- **Archives**: `archive/archive_set`, `archive/archive_delete`
- **Common Config**: `common/common_set`, `common/common_delete`
- **PV Ranges**: `pv_range/pv_range_set`, `pv_range/pv_range_delete`
- **Managers**: `manager/manager_control`, `manager/manager_add`, `manager/manager_remove`, `manager/manager_properties`
- **Dashboards**: `dashboards/dashboard`, `dashboards/widget`
- **OPC UA**: `opcua/opcua_connection`, `opcua/opcua_address`
- **MQTT**: `mqtt/mqtt_connection`

**Note**: Icon tools (`icons/icon`) create/delete SVG files but don't modify SCADA data.

Example read-only configuration:
```env
# Only include read operations
TOOLS=datapoints/dp_basic,datapoints/dp_types,archive/archive_query,common/common_query,pv_range/pv_range_query,manager/manager_list,opcua/opcua_connection
```

## ℹ️ Version Requirements

**Dashboard Tools Requirement:** The dashboard-related tools require **WinCC OA version 3.21 or higher**. If you are using an earlier version of WinCC OA, these tools will not be available. Other tools and features will continue to work with earlier versions.

## Prerequisites

This MCP server requires an AI tool that supports Model Context Protocol (MCP) servers. It works with any AI tool that has MCP support. For instructions on how to configure an MCP server in your specific AI tool, please refer to your tools documentation.

For this guide, we'll use Claude Desktop as an example. [Download Claude Desktop](https://claude.ai/download)

For detailed prerequisites, see **[📋 Prerequisites Guide](docs/PREREQUISITES.md)**.



### 1. Install

Navigate to your WinCC OA projects javascript directory and create a folder for the MCP server. You can choose any name for this folder - we'll use `mcpServer` in this guide:

**Windows & Linux:**
```cmd
cd <OA_ProjPath>\javascript
mkdir mcpServer
cd mcpServer
```

Then install the required packages:

```bash
npm install @etm-professional-control/winccoa-mcp-server
npm install file:C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager
```

### 2. Configure

Create configuration file from template:

**Windows:**
```cmd
copy .env.example .env
notepad .env
```

**Linux/macOS:**
```bash
cp .env.example .env
nano .env  # or use your preferred editor
```

**Minimal .env setup:**
```env
# IMPORTANT: This token MUST match the token in Claude Desktop config!
# IMPORTANT: You can use any string as token (e.g., "my-secret-token-123")
# For better security, generate a random token:
# Windows:
#   - PowerShell: -join ((1..64) | ForEach {'{0:X}' -f (Get-Random -Max 16)})
#   - Node.js: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Linux/macOS:
#   - openssl rand -hex 32
#   - pwgen 64 1
#   - node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
MCP_API_TOKEN=your-secure-token-here

# Choose industry context
WINCCOA_FIELD=default  # or 'oil', 'transport'

# Configure available tools (examples - see docs/TOOLS.md for complete list)
# Full feature set
TOOLS=datapoints/dp_basic,datapoints/dp_set,opcua/opcua_connection,mqtt/mqtt_connection,dashboards/dashboard,manager/manager_list
# Default: Read-only monitoring (safe starting point)
TOOLS=datapoints/dp_basic,datapoints/dp_types,archive/archive_query,common/common_query,pv_range/pv_range_query,manager/manager_list

# Dashboard-focused setup (includes write operations)
# TOOLS=datapoints/dp_basic,dashboards/dashboard,dashboards/widget,icons/icon

# Manager control setup (includes write operations)
# TOOLS=manager/manager_list,manager/manager_control,manager/manager_add

# Full feature set (includes all write operations - use with caution)
# TOOLS=datapoints/dp_basic,datapoints/dp_set,opcua/opcua_connection,dashboards/dashboard,manager/manager_list
```

### 3. Start Server

Add JavaScript Manager in WinCC OA:
- **Manager Type:** JavaScript Manager  
- **Script Path:** `mcpServer/index_http.js`

### 4. Connect Claude Desktop

**To access the configuration file:**
1. Open Claude Desktop
2. Click the menu (☰) in the upper left corner
3. Navigate to File → Settings
4. Go to the Developer section
5. Click "Edit Config" to open the configuration file

Edit the configuration file:

```json
{
  "mcpServers": {
    "winccoa": {
      "command": "npx",
      "args": ["mcp-remote", "http://localhost:3000/mcp", "--header", "Authorization: Bearer YOUR_TOKEN_HERE"]
    }
  }
}
```

**⚠️ IMPORTANT:** Replace `YOUR_TOKEN_HERE` with the exact same token from your `.env` file's `MCP_API_TOKEN`. The tokens must match exactly!

**Windows Path Issue:** If you encounter the error `"C:\Program" is either misspelled or could not be found`, use this alternative configuration:

```json
{
  "mcpServers": {
    "winccoa": {
      "command": "cmd",
      "args": ["/c", "npx", "mcp-remote", "http://localhost:3000/mcp", "--header", "Authorization: Bearer YOUR_TOKEN_HERE"]
    }
  }
}
```

This method uses `cmd` to properly handle paths with spaces in Windows.

**Note:** After modifying the configuration, you must restart Claude Desktop completely:
- On Windows: Close Claude through the task-tray menu by selecting "Exit", or end the task in Task Manager if needed
- On macOS/Linux: Quit Claude Desktop completely and restart

**Remote Host:** When connecting to a remote WinCC OA server (not `localhost`), you must add the `--allow-http` flag to the `mcp-remote` args. Example:

```json
{
  "mcpServers": {
    "winccoa": {
      "command": "npx",
      "args": ["mcp-remote", "http://winccoaserver:3000/mcp", "--header", "Authorization: Bearer YOUR_TOKEN_HERE", "--allow-http"]
    }
  }
}
```

### 5. Connect Claude Code (CLI)

If you are using [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (the CLI), you can add the MCP server directly from your terminal:

```bash
claude mcp add --transport http winccoa http://localhost:3000/mcp --header "Authorization: Bearer your-secure-token-here"
```

**Remote Host:** When connecting to a remote WinCC OA server (not `localhost`), add the `--allow-http` flag:

```bash
claude mcp add --transport http winccoa http://winccoaserver:3000/mcp --header "Authorization: Bearer your-secure-token-here" --allow-http
```

## Documentation

- **[📦 Installation Guide](docs/INSTALLATION.md)** - Complete setup instructions
- **[⚙️ Configuration](docs/CONFIGURATION.md)** - All .env options and server modes  
- **[🔧 Tools](docs/TOOLS.md)** - Available tools and custom development
- **[📝 Instructions](docs/INSTRUCTIONS.md)** - Industry templates and project customization
- **[🔍 Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and limitations

## Features

✅ **Secure API** - Token-based authentication
✅ **Industry Templates** - Pre-configured for Oil & Gas, Transportation
✅ **Custom Tools** - Extend with your own WinCC OA integrations
✅ **Project Rules** - Plant-specific AI guidance
✅ **Dynamic Loading** - Configure only needed tools

### Available Tool Categories

- **📊 Datapoints** - Read, write, and create datapoints and types
- **🔗 OPC UA** - Connect to OPC UA servers and browse address spaces
- **📡 MQTT** - Connect to MQTT brokers and map topics to datapoints
- **📈 Dashboards & Widgets** - Create and manage visualization dashboards
- **🚨 Alarms** - Configure alarm thresholds and notifications
- **📁 Archives** - Query and configure historical data storage
- **⚙️ Manager Control** - Start, stop, and manage WinCC OA processes (Pmon)
- **🔧 Common Config** - Set descriptions, aliases, formats, and units
- **✓ PV Range Validation** - Define min/max value ranges
- **🎨 Icons** - Create custom SVG icons and browse 1,400+ built-in Siemens IX icons

See **[🔧 TOOLS.md](docs/TOOLS.md)** for complete tool documentation.  

## Support

- **Repository:** [GitHub](https://github.com/winccoa/winccoa-ae-js-mcpserver)
- **Issues:** [Report Bug](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues)
- **WinCC OA Docs:** [Official Documentation](https://www.winccoa.com/product-information/documentation.html)

## License

ISC - See LICENSE.md for details.
