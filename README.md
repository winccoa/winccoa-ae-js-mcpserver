# WinCC OA MCP Server

**AI Integration for Industrial Automation**

This Model Context Protocol (MCP) server connects AI assistants to WinCC OA SCADA systems, enabling intelligent automation and monitoring for industrial environments.

## Prerequisites

This MCP server requires an AI tool that supports Model Context Protocol (MCP) servers. It works with any AI tool that has MCP support. For instructions on how to configure an MCP server in your specific AI tool, please refer to your tool's documentation.

For this guide, we'll use Claude Desktop as an example. [Download Claude Desktop](https://claude.ai/download)

For detailed prerequisites, see **[📋 Prerequisites Guide](docs/PREREQUISITES.md)**.

## Quick Start

**Ask your AI:**
- "Show me all temperature values in the plant"
- "Which pumps are currently running?"  
- "Set the setpoint for pump P-101 to 50%"
- "Create a production report for today"

### 1. Install

```bash
# In your WinCC OA project directory
cd <OA_ProjPath>/javascript
mkdir mcpServer && cd mcpServer

# Install packages
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

# Configure available tools  
TOOLS=datapoints/dp_basic,datapoints/dp_set,datapoints/dp_types
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
- On Windows: Close Claude and end the task in Task Manager, as it continues running in the background
- On macOS/Linux: Quit Claude Desktop completely and restart

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

## Support

- **Repository:** [GitHub](https://github.com/winccoa/winccoa-ae-js-mcpserver)
- **Issues:** [Report Bug](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues)
- **WinCC OA Docs:** [Official Documentation](https://www.winccoa.com/product-information/documentation.html)

## License

ISC - See LICENSE.md for details.
