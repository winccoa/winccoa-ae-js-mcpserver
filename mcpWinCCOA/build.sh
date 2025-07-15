#!/bin/bash

# Build script for WinCC OA MCP Server
echo "🔄 Building WinCC OA MCP Server..."

# TypeScript compilation
echo "🔄 Compiling TypeScript..."
tsc

# Set executable permissions
echo "🔄 Setting executable permissions..."
chmod 755 build/index_stdio.js
chmod 755 build/index_http.js

# Copy configuration files
echo "🔄 Copying configuration files..."
mkdir -p build/config
cp config/demo-project-instructions.md build/config/

# Copy fields directory
echo "🔄 Copying fields directory..."
cp -r src/fields build/

# Copy system prompt
echo "🔄 Copying system prompt..."
cp src/systemprompt.md build/

echo "✅ Build completed successfully!"