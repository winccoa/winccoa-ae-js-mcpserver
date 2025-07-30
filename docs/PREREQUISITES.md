# Prerequisites Guide

This guide covers all prerequisites needed to set up and use the WinCC OA MCP Server.

## AI Tool with MCP Support

The WinCC OA MCP Server requires an AI tool that supports the Model Context Protocol (MCP). This server is compatible with any AI tool that implements MCP support.

### Compatible AI Tools

- **Claude Desktop** (recommended for this guide)
- Any other AI assistant with MCP server support

### Installing Claude Desktop

1. **Download Claude Desktop**
   - Visit [https://claude.ai/download](https://claude.ai/download)
   - Choose the appropriate version for your operating system
   - Follow the installation instructions

2. **Create a Claude Account**
   - You'll need to create an account at [claude.ai](https://claude.ai)
   - Follow the registration process
   - Sign in to Claude Desktop with your account

### General MCP Requirements

For detailed information about MCP prerequisites and setup, refer to the official MCP documentation:
[https://modelcontextprotocol.io/quickstart/user#prerequisites](https://modelcontextprotocol.io/quickstart/user#prerequisites)

## System Requirements

### WinCC OA
- WinCC OA 3.20 or later
- Valid WinCC OA license
- JavaScript Manager available

### Node.js
- Node.js 18.x or later
- npm (comes with Node.js)

### Operating System
- Windows 10/11, Windows Server 2016 or later
- Linux distributions supported by WinCC OA


## Next Steps

Once all prerequisites are met:
1. Continue with the [Installation Guide](INSTALLATION.md)
2. Configure your environment following the [Configuration Guide](CONFIGURATION.md)
3. Connect your AI tool to the MCP server

## Troubleshooting Prerequisites

### Node.js Issues

**Problem**: `npm` command not found
- **Solution**: Install Node.js from [nodejs.org](https://nodejs.org/)

**Problem**: Wrong Node.js version
- **Solution**: Check version with `node --version` and update if needed

### WinCC OA Issues

**Problem**: JavaScript Manager not available
- **Solution**: Ensure your WinCC OA license includes the JavaScript Manager feature

For more troubleshooting help, see the [Troubleshooting Guide](TROUBLESHOOTING.md).