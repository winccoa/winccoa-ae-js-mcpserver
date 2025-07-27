# Troubleshooting Guide

Common issues, solutions, and known limitations.

## Installation Issues

### "winccoa-manager not found"

**Symptoms:**
- npm install fails with package not found
- Server fails to start with import errors

**Solutions:**
1. **Verify WinCC OA installation path**
   ```bash
   # Check if manager exists
   ls "C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager"
   ```

2. **Use correct npm install command**
   ```bash
   # Windows
   npm install file:C:/Siemens/Automation/WinCC_OA/3.20/javascript/winccoa-manager
   
   # Linux  
   npm install file:/opt/WinCC_OA/3.20/javascript/winccoa-manager
   ```

3. **Check WinCC OA version compatibility**
   - Requires WinCC OA 3.20 or higher
   - Check version: WinCC OA → Help → About

### "Permission denied" Errors

**Symptoms:**
- npm install fails with EACCES errors
- Cannot create directories or files

**Solutions:**
1. **Windows: Run as Administrator**
   ```bash
   # Open Command Prompt as Administrator
   npm install @etm/winccoa-mcp-server
   ```

2. **Linux: Check permissions**
   ```bash
   # Verify directory permissions
   ls -la /path/to/winccoa/project/javascript
   
   # Fix permissions if needed
   chmod 755 /path/to/winccoa/project/javascript
   ```

3. **Check disk space**
   ```bash
   # Windows
   dir C:
   
   # Linux
   df -h
   ```

### "Port already in use"

**Symptoms:**
- Server fails to start with port binding error
- `EADDRINUSE` error in logs

**Solutions:**
1. **Change port in .env**
   ```env
   MCP_HTTP_PORT=3001
   ```

2. **Find and stop conflicting process**
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <process_id> /F
   
   # Linux
   lsof -i :3000
   kill <process_id>
   ```

3. **Check firewall settings**
   - Ensure port is not blocked by firewall
   - Add exception for Node.js if needed

## Configuration Issues

### Windows Path Issue in Claude Desktop

**Symptoms:**
- Error message: `"C:\Program" is either misspelled or could not be found`
- Claude Desktop cannot start MCP server on Windows
- Issue occurs when npx is installed in a path with spaces (e.g., "C:\Program Files")

**Solution:**
Use `cmd` to properly handle paths with spaces:

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

This wraps the npx command in Windows Command Prompt, which correctly handles paths containing spaces.

### "Invalid token" Errors

**Symptoms:**
- AI client cannot connect
- HTTP 401 Unauthorized responses

**Solutions:**
1. **Verify token configuration**
   ```env
   # .env file
   MCP_API_TOKEN=your-secure-token-here
   ```

2. **Check client configuration**
   ```json
   {
     "env": {
       "MCP_API_TOKEN": "your-secure-token-here"
     }
   }
   ```

3. **Generate new token**
   ```bash
   # Generate secure token
   openssl rand -hex 32
   ```

### "Field not found" Errors

**Symptoms:**
- Field instructions not loading
- Default field used instead of specified field

**Solutions:**
1. **Verify field name**
   ```env
   # Valid options: default, oil, transport
   WINCCOA_FIELD=oil
   ```

2. **Check field file exists**
   ```bash
   # Verify field file exists
   ls src/fields/oil.md
   ```

3. **Check file permissions**
   ```bash
   # Ensure file is readable
   cat src/fields/oil.md
   ```

### Project Instructions Not Loading

**Symptoms:**
- Project instructions not found in resources
- Only field instructions available

**Solutions:**
1. **Verify file path**
   ```env
   # Path relative to WinCC OA project directory
   WINCCOA_PROJECT_INSTRUCTIONS=./config/my-rules.md
   ```

2. **Check file exists**
   ```bash
   # From WinCC OA project root
   cat ./config/my-rules.md
   ```

3. **Verify file accessibility**
   - Ensure WinCC OA can read the file
   - Check path separators (use `/` not `\`)

## Runtime Issues

### JavaScript Manager Fails to Start

**Symptoms:**
- Manager shows error status in WinCC OA
- No HTTP server listening on configured port

**Solutions:**
1. **Check script path**
   - Manager script path: `mcpServer/index_http.js`
   - Verify file exists in WinCC OA project

2. **Review WinCC OA logs**
   ```
   # Look for specific error messages in:
   # Windows: %WINCCOA_PROJ%/log/
   # Linux: $WINCCOA_PROJ/log/
   ```

3. **Verify .env file**
   ```bash
   # Check .env exists and has required settings
   cat mcpServer/.env
   ```

4. **Test Node.js directly**
   ```bash
   # Test if script runs outside WinCC OA
   cd mcpServer
   node index_http.js
   ```

### Tools Not Loading

**Symptoms:**
- Some tools missing from AI client
- "Tool not found" errors

**Solutions:**
1. **Check TOOLS configuration**
   ```env
   # Verify tool paths in .env
   TOOLS=datapoints/dp_basic,datapoints/dp_create,datapoints/dp_set,datapoints/dp_types
   ```

2. **Verify tool files exist**
   ```bash
   # Check each tool file
   ls src/tools/datapoints/dp_basic.js
   ls src/tools/datapoints/dp_create.js
   ls src/tools/datapoints/dp_set.js
   ls src/tools/datapoints/dp_types.js
   ```

3. **Review console logs**
   - Check for tool loading errors
   - Look for missing dependencies

4. **Test individual tools**
   ```env
   # Load only one tool for testing
   TOOLS=datapoints/dp_basic
   ```

### WinCC OA Connection Issues

**Symptoms:**
- "WinCC OA connection not available" errors
- Datapoint operations fail

**Solutions:**
1. **Verify WinCC OA manager running**
   - Check WinCC OA System Management
   - Ensure JavaScript Manager is active

2. **Check manager configuration**
   - Verify manager script path
   - Check manager startup parameters

3. **Test WinCC OA functionality**
   ```javascript
   // Test basic WinCC OA operations
   console.log(winccoa.dpNames('*'));
   ```

## Performance Issues

### Slow Response Times

**Symptoms:**
- AI responses take long time
- Timeouts in client connections

**Solutions:**
1. **Check rate limiting**
   ```env
   # Increase rate limits if needed
   RATE_LIMIT_MAX=200
   ```

2. **Optimize tool configuration**
   ```env
   # Load only necessary tools
   TOOLS=datapoints/dp_basic,datapoints/dp_set
   ```

3. **Monitor system resources**
   - Check CPU and memory usage
   - Monitor WinCC OA system performance

### Memory Issues

**Symptoms:**
- Node.js process memory grows over time
- Out of memory errors

**Solutions:**
1. **Monitor memory usage**
   ```bash
   # Check Node.js process memory
   ps aux | grep node
   ```

2. **Restart manager periodically**
   - Set up scheduled manager restarts
   - Monitor for memory leaks

3. **Optimize tool operations**
   - Avoid large datapoint queries
   - Use pagination for large results

## Network Issues

### Remote Connection Failures

**Symptoms:**
- Cannot connect from remote AI clients
- Connection refused errors

**Solutions:**
1. **Check bind address**
   ```env
   # Ensure server binds to all interfaces
   MCP_HTTP_HOST=0.0.0.0
   ```

2. **Verify firewall rules**
   ```bash
   # Windows Firewall
   netsh advfirewall firewall add rule name="MCP Server" dir=in action=allow protocol=TCP localport=3000
   
   # Linux iptables
   iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
   ```

3. **Test connectivity**
   ```bash
   # Test from remote machine
   telnet <server_ip> 3000
   curl http://<server_ip>:3000/mcp
   ```

### SSL/TLS Issues

**Symptoms:**
- HTTPS connections fail
- Certificate errors

**Solutions:**
1. **Verify certificate files**
   ```bash
   # Check certificate validity
   openssl x509 -in cert.pem -text -noout
   ```

2. **Check file permissions**
   ```bash
   # Ensure Node.js can read certificates
   ls -la /path/to/cert.pem
   ```

3. **Validate configuration**
   ```env
   MCP_SSL_ENABLED=true
   MCP_SSL_CERT_PATH=/absolute/path/to/cert.pem
   MCP_SSL_KEY_PATH=/absolute/path/to/key.pem
   ```

## Known Limitations

### Transport Layer Security

**Current Limitation:**
- No built-in HTTPS support for remote connections
- Clients must use `--allow-http` flag for remote access

**Workarounds:**
1. **Use reverse proxy**
   ```nginx
   # nginx configuration
   server {
     listen 443 ssl;
     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;
     
     location / {
       proxy_pass http://localhost:3000;
     }
   }
   ```

2. **Restrict to localhost**
   ```env
   # Only allow local connections
   MCP_HTTP_HOST=127.0.0.1
   ```

3. **Use VPN or secure network**
   - Deploy within secure network perimeter
   - Use VPN for remote access

### Authorization Limitations

**Current Limitation:**
- JavaScript Manager runs with root privileges
- No user-based access control

**Planned Improvements:**
- User-based authentication with API tokens
- Granular access control per tool
- Audit logging for security compliance

**Current Workarounds:**
1. **Network-level security**
   - Use IP whitelisting
   - Deploy behind firewall

2. **Tool-level restrictions**
   - Configure only necessary tools
   - Implement custom validation in tools

## Getting Help

### Log Analysis

**Enable debug logging:**
```env
# Add to .env for detailed logs
DEBUG=true
LOG_LEVEL=debug
```

**Key log locations:**
- **WinCC OA logs:** `%WINCCOA_PROJ%/log/` (Windows) or `$WINCCOA_PROJ/log/` (Linux)
- **Console output:** JavaScript Manager console in WinCC OA
- **Node.js logs:** Standard output/error streams

### Diagnostic Commands

**Test server connectivity:**
```bash
# Basic connectivity test
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/mcp

# Health check
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/health
```

**Check configuration:**
```bash
# Verify .env file
cat .env | grep -v '#' | grep '='

# Check tool files
find src/tools -name "*.js" -type f
```

### Support Channels

- **GitHub Issues:** [Report bugs](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues)
- **Documentation:** [Official docs](https://www.winccoa.com/product-information/documentation.html)
- **Community:** WinCC OA user forums and communities

### Information to Include in Bug Reports

1. **Environment details:**
   - WinCC OA version
   - Node.js version
   - Operating system

2. **Configuration:**
   - Relevant .env settings (redact sensitive tokens)
   - Tool configuration

3. **Error details:**
   - Complete error messages
   - Log file excerpts
   - Steps to reproduce

4. **System state:**
   - WinCC OA manager status
   - Network configuration
   - Resource usage