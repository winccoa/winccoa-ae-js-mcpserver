# WinCC OA MCP Server - AI Integration for Industrial Automation

This Model Context Protocol (MCP) server provides a secure interface between AI assistants and WinCC OA SCADA systems, enabling intelligent automation and monitoring capabilities for industrial environments.

## Overview

The WinCC OA MCP Server bridges the gap between modern AI technologies and industrial control systems, allowing AI assistants to:

✅ **Interact with WinCC OA systems** through secure, controlled interfaces  
✅ **Leverage industry-specific configurations** tailored for Oil & Gas, Transportation, and other sectors  

### Practical Use Cases

**Ask your AI:**
- "Show me all temperature values in the plant"
- "Which pumps are currently running?"
- "Set the setpoint for pump P-101 to 50%"
- "Create a production report for today"

**The AI automatically respects:**
- Plant-specific restrictions

## Installation 

### Step 1: Install Server

```bash
# In your WinCC OA project directory
# change into the javascript directory. create if not exist.
cd <OA_ProjPath>/javascript
mkdir mcpServer
cd mcpServer

# Install package (automatic extraction)
npm install @etm/winccoa-mcp-server
```

**Note for Windows users:** You may need to run the command prompt as Administrator for npm install commands.

### Step 2: Install WinCCOA-Manager

Replace the path with your installation path:
```bash
npm install file:C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager
```

**Note for Windows users:** You may need to run the command prompt as Administrator for npm install commands.

### Step 3: Configure Settings

Copy and edit the environment file:

**Linux/macOS:**
```bash
cp .env.example .env
nano .env
```

**Windows:**
```cmd
copy .env.example .env
notepad .env
```

Required settings:
```env
# Generate security token with: openssl rand -hex 32
MCP_API_TOKEN=your-secure-token-here

# Server settings
MCP_MODE=http                # Server mode: 'http' or 'stdio'
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0

# Authentication
MCP_AUTH_TYPE=bearer         # 'bearer' or 'api-key'

# Choose your industry
WINCCOA_FIELD=default        # default instructions
# WINCCOA_FIELD=transport # For Transportation systems
# WINCCOA_FIELD=oil   # For Oil & Gas

# Configure which tools to load
TOOLS=alerts/alerts,cns/cns_views,datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,system/system
```

### Step 4: Configure WinCC OA Manager

Add a JavaScript Manager in WinCC OA:
- **Manager Type:** JavaScript Manager
- **Script Path:** `mcpServer/index_http.js`

## Connect AI Client

### Configure Claude Desktop

Open configuration file:
- **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

Add entry:
```json
{
  "mcpServers": {
    "winccoa": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "Authorization: Bearer ${MCP_API_TOKEN}"
      ],
      "env": {
        "MCP_API_TOKEN": "your-token-from-env-file"
      }
    }
  }
}
```


## Project-Specific Instructions

Every industrial facility is unique. While our industry templates provide a solid foundation, your specific plant may have unique requirements, custom naming conventions, or special operational procedures that need to be respected by the AI assistant.

**Create Your Custom Rules:**

The MCP Server allows you to define project-specific instructions that override and extend the industry templates. These instructions help the AI understand your specific:

- **Naming Conventions** - Your unique datapoint naming patterns
- **Operational Limits** - Plant-specific temperature, pressure, and flow ranges  
- **Equipment Specifics** - Unique equipment types and their handling requirements
- **Process Knowledge** - Plant-specific process optimization guidelines
- **Maintenance Procedures** - Custom maintenance schedules and requirements

**Implementation:**

1. Create a Markdown file with your plant-specific rules:
```markdown
# My Plant - Custom Instructions

## Equipment Naming
- All reactors follow pattern: `REACTOR_R[0-9]{3}_*`
- Compressors use: `COMP_[ABC][0-9]{2}_*`

## Operational Guidelines
- Target efficiency for Unit 100: 92-95%
- Steam pressure optimal range: 15-18 bar
- Reactor temperatures should stay within 300-350°C range

## Process Optimization
- Monitor pump efficiency weekly
- Check valve positions during shift changes
```

2. Configure in `.env`:
```env
WINCCOA_PROJECT_INSTRUCTIONS=./config/my-plant-rules.md
```

The AI will now combine your custom instructions with the industry template, giving priority to your project-specific rules when conflicts arise.

## Tool Configuration

You can configure which tools are available to the AI by editing the `TOOLS` setting in your `.env` file:

```env
# Load all available tools (default)
TOOLS=alerts/alerts,cns/cns_views,datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,system/system

# Load only datapoint tools
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types

# Load only system and alert tools
TOOLS=system/system,alerts/alerts
```

### Available Tools:
- **alerts/alerts** - Alarm and event management
- **cns/cns_views** - Control navigation system views
- **datapoints/dp_basic** - Basic datapoint operations (read, write)
- **datapoints/dp_create** - Create new datapoints
- **datapoints/dp_set** - Datapoint configuration and setup
- **datapoints/dp_types** - Datapoint type management
- **system/system** - System information and management

**Note:** If a tool file doesn't exist or fails to load, an error will be logged but the server will continue running with the other tools.

## Advanced Configuration

### Server Modes

The MCP server supports two connection modes:

- **HTTP Mode** (`MCP_MODE=http`): Default mode for remote connections
- **STDIO Mode** (`MCP_MODE=stdio`): For direct process communication


## Instruction Hierarchy

The MCP Server uses a 3-level instruction system to provide context and guidance to AI assistants:

### 1. System Instructions
**Global AI behavior and capabilities**
- Loaded from `systemprompt.md`
- Defines overall AI personality and constraints
- Always active regardless of field or project

### 2. Field Instructions
**Industry-specific knowledge and guidelines**
- Selected via `WINCCOA_FIELD` environment variable
- Stored in `fields/[fieldname].md` files
- Provides industry context and best practices

Available fields:
- **`default`** - General WinCC OA guidance
- **`oil`** - Oil & Gas industry specifics
- **`transport`** - Transportation systems guidance

### 3. Project Instructions (Optional)
**Plant-specific rules and customizations**
- Path specified via `WINCCOA_PROJECT_INSTRUCTIONS`
- Your own Markdown file with plant-specific rules
- Highest priority - overrides field instructions

### Configuration Example

```env
# Choose industry field
WINCCOA_FIELD=oil

# Add your plant-specific instructions
WINCCOA_PROJECT_INSTRUCTIONS=./config/my-refinery-rules.md
```

### Instruction Resources

The AI can access these instruction levels via MCP resources:
- `instructions://system` - System prompt
- `instructions://field` - Field instructions
- `instructions://project` - Project instructions
- `instructions://combined` - All levels merged

**Priority:** Project instructions > Field instructions > System instructions
## Known restrictions

### Transport Layer Security

The current implementation does not support encrypted connections to remote MCP servers. For remote connections, the client must be configured with the `--allow-http` flag to explicitly acknowledge unencrypted communication.

**Remote Connection Configuration:**

```json
{
  "command": "npx",
  "args": [
    "mcp-remote",
    "http://192.168.0.41:3000/mcp",
    "--header",
    "Authorization: Bearer ${MCP_API_TOKEN}",
    "--allow-http"
  ],
  "env": {
    "MCP_API_TOKEN": "your-token-from-env-file"
  }
}
```

**Security Recommendation:** For production environments, consider implementing a reverse proxy with TLS termination or restricting connections to localhost only.

### Authorization

Currently, the JavaScript Manager operates with root privileges within the WinCC OA environment. Future releases will implement user-based authentication using API tokens to provide granular access control and enhanced security compliance.
## Support

- **Repository:** https://github.com/winccoa/winccoa-ae-js-mcpserver
- **Report issues:** GitHub Issues
- **WinCC OA Documentation:** https://www.winccoa.com/product-information/documentation.html

## License

ISC - See LICENSE.md for details.