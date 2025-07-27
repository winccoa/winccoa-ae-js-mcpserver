# WinCC OA MCP Server

**AI Integration for Industrial Automation**

This Model Context Protocol (MCP) server connects AI assistants to WinCC OA SCADA systems, enabling intelligent automation and monitoring for industrial environments.

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
# Optional: Generate a secure token with: openssl rand -hex 32
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

Edit `%APPDATA%/Claude/claude_desktop_config.json`:

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
