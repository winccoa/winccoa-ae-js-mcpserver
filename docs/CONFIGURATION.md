# Configuration Guide

Complete reference for all `.env` configuration options.

## Overview

The MCP server is configured via environment variables in the `.env` file. Copy `.env.example` to `.env` and adjust settings for your environment.

## Required Settings

### API Authentication

```env
# REQUIRED: Generate secure token
# Command: openssl rand -hex 32
MCP_API_TOKEN=your-secure-token-here
```

**Security Note:** Never commit this token to version control. Each deployment should use a unique token.

## Server Configuration

### Connection Settings

```env
# Server mode: 'http' or 'stdio'
MCP_MODE=http

# HTTP server settings (when MCP_MODE=http)
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0

# Authentication type: 'bearer' or 'api-key'  
MCP_AUTH_TYPE=bearer
```

### Server Modes

**HTTP Mode** (`MCP_MODE=http`)
- **Use case:** Remote AI clients, production deployment
- **Pros:** Network accessible, multiple clients
- **Cons:** Requires network security

**STDIO Mode** (`MCP_MODE=stdio`)
- **Use case:** Direct process communication
- **Pros:** More secure, no network exposure  
- **Cons:** Single client, local only

## Security Settings

### Rate Limiting

```env
# Enable/disable rate limiting
RATE_LIMIT_ENABLED=true

# Time window in milliseconds (default: 1 minute)
RATE_LIMIT_WINDOW_MS=60000

# Maximum requests per window
RATE_LIMIT_MAX=100
```

### IP Filtering

```env
# Enable IP filtering
IP_FILTER_ENABLED=false

# Allowed IPs (comma-separated)
IP_WHITELIST=192.168.1.10,192.168.1.20

# Blocked IPs (comma-separated)  
IP_BLACKLIST=192.168.1.100
```

### CORS Settings

```env
# Enable CORS for web clients
MCP_CORS_ENABLED=false

# Allowed origins (comma-separated or *)
MCP_CORS_ORIGINS=*

# Allow credentials in CORS requests
MCP_CORS_CREDENTIALS=false
```

### SSL/TLS Configuration

```env
# Enable HTTPS
MCP_SSL_ENABLED=false

# Certificate files (absolute paths)
MCP_SSL_CERT_PATH=/path/to/cert.pem
MCP_SSL_KEY_PATH=/path/to/key.pem
MCP_SSL_CA_PATH=/path/to/ca.pem
```

## WinCC OA Settings

### Field Selection

```env
# Industry field for AI context
WINCCOA_FIELD=default
```

**Available Fields:**
- `default` - General WinCC OA guidance
- `oil` - Oil & Gas industry specifics  
- `transport` - Transportation systems guidance

### Project Instructions

```env
# Path to project-specific instructions (optional)
# Relative to WinCC OA project directory
WINCCOA_PROJECT_INSTRUCTIONS=./config/my-plant-rules.md
```

**Example Project Instructions File:**
```markdown
# My Plant - Custom Rules

## Equipment Naming
- All reactors: `REACTOR_R[0-9]{3}_*`
- Compressors: `COMP_[ABC][0-9]{2}_*`

## Operational Limits
- Target efficiency Unit 100: 92-95%
- Steam pressure: 15-18 bar
- Reactor temp: 300-350°C
```

### Pmon Configuration

Configure connection to Pmon for manager control tools.

```env
# Pmon TCP connection (optional - defaults shown)
WINCCOA_PMON_HOST=localhost
WINCCOA_PMON_PORT=4999

# Pmon authentication (optional - leave empty for no auth)
WINCCOA_PMON_USER=
WINCCOA_PMON_PASSWORD=
```

**Note:** Pmon configuration is only required when using manager tools (`manager/*`).

## Tool Configuration

```env
# Tools to load (comma-separated, no .js extension)
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types
```

**Tool Categories:**
- `datapoints/*` - Datapoint operations (dp_basic, dp_create, dp_set, dp_types, dp_type_create)
- `opcua/*` - OPC UA connections (opcua_connection, opcua_address)
- `alarms/*` - Alarm configuration (alarm_set, alarm_delete)
- `archive/*` - Historical data (archive_query, archive_set, archive_delete)
- `common/*` - Common attributes (common_query, common_set, common_delete)
- `pv_range/*` - Value ranges (pv_range_query, pv_range_set, pv_range_delete)
- `manager/*` - Process control (manager_list, manager_control, manager_add, manager_remove, manager_properties)
- `dashboards/*` - Visualization (dashboard, widget)
- `icons/*` - Icon management (icon)

**Custom Tools:**
Add your own tools by placing them in `tools/[category]/[name].ts` and including `[category]/[name]` in the TOOLS list.

## Example Configurations

### Development Setup (Read-Only)

```env
MCP_API_TOKEN=dev-token-12345
MCP_MODE=http
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=127.0.0.1
WINCCOA_FIELD=default
TOOLS=datapoints/dp_basic,datapoints/dp_types,archive/archive_query,common/common_query,pv_range/pv_range_query,manager/manager_list
RATE_LIMIT_ENABLED=false
```

### Production Setup

```env
MCP_API_TOKEN=prod-secure-token-67890
MCP_MODE=http
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0
WINCCOA_FIELD=oil
WINCCOA_PROJECT_INSTRUCTIONS=./config/refinery-rules.md
TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types,opcua/opcua_connection,opcua/opcua_address,alarms/alarm_set,archive/archive_query,archive/archive_set,common/common_query,common/common_set
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=50
IP_FILTER_ENABLED=true
IP_WHITELIST=192.168.10.100,192.168.10.101
```

### Secure Remote Setup

```env
MCP_API_TOKEN=remote-secure-token-abcdef
MCP_MODE=http
MCP_HTTP_PORT=3000
MCP_HTTP_HOST=0.0.0.0
MCP_SSL_ENABLED=true
MCP_SSL_CERT_PATH=/etc/ssl/certs/mcp-server.pem
MCP_SSL_KEY_PATH=/etc/ssl/private/mcp-server.key
WINCCOA_FIELD=transport
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=30
IP_FILTER_ENABLED=true
IP_WHITELIST=10.0.1.50
```

## Environment Variable Precedence

1. **Process Environment** - System environment variables
2. **`.env` File** - Project-specific settings  
3. **Default Values** - Built-in fallbacks

## Security Best Practices

### Token Management
- **Generate strong tokens:** Use `openssl rand -hex 32`
- **Rotate regularly:** Change tokens periodically
- **Secure storage:** Never commit to version control
- **Environment specific:** Different tokens per environment

### Network Security  
- **Restrict access:** Use IP whitelist in production
- **Enable rate limiting:** Prevent abuse
- **Use HTTPS:** Enable SSL for remote access
- **Firewall rules:** Limit port access

### Monitoring
- **Enable logging:** Monitor access patterns
- **Rate limit alerts:** Detect unusual activity
- **Token usage:** Track API usage per token

## Troubleshooting Configuration

**"Invalid token" errors**
- Verify `MCP_API_TOKEN` is set correctly
- Check token matches client configuration
- Ensure no extra spaces or characters

**"Port already in use"**
- Change `MCP_HTTP_PORT` to available port
- Check for conflicting services
- Verify firewall rules

**"Field not found" errors**
- Verify `WINCCOA_FIELD` value is valid (`default`, `oil`, `transport`)
- Check `src/fields/[fieldname].md` file exists

**SSL certificate errors**
- Verify certificate file paths are correct
- Check file permissions
- Ensure certificates are valid and not expired