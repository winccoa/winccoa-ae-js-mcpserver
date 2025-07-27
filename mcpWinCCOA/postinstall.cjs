#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get package info dynamically
const packageJson = require('./package.json');
const packageName = packageJson.name;

// Determine the installation directory (where npm install was run)
const installDir = process.env.INIT_CWD || process.cwd();
const nodeModulesPath = path.join(installDir, 'node_modules', packageName);

console.log(`Installing WinCC OA MCP Server files to: ${installDir}`);
console.log(`Package location: ${nodeModulesPath}`);

try {
  // Copy build files to installation directory
  const buildDir = path.join(nodeModulesPath, 'build');
  
  if (fs.existsSync(buildDir)) {
    // Copy all files from build directory
    const files = fs.readdirSync(buildDir, { withFileTypes: true });
    
    for (const file of files) {
      const srcPath = path.join(buildDir, file.name);
      const destPath = path.join(installDir, file.name);
      
      if (file.isDirectory()) {
        // Copy directory recursively
        fs.cpSync(srcPath, destPath, { recursive: true });
        console.log(`Copied directory: ${file.name}`);
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
        console.log(`Copied file: ${file.name}`);
      }
    }
    
    // Copy .env.example
    const envExampleSrc = path.join(nodeModulesPath, '.env.example');
    const envExampleDest = path.join(installDir, '.env.example');
    
    if (fs.existsSync(envExampleSrc)) {
      fs.copyFileSync(envExampleSrc, envExampleDest);
      console.log('Copied .env.example');
    }

    // Copy package.json
    const packageJsonSrc = path.join(nodeModulesPath, 'package.json');
    const packageJsonDest = path.join(installDir, 'package.json');
    
    console.log('\n✅ Installation complete!');
    console.log('\nNext steps:');
    console.log('1. Copy the environment file: cp .env.example .env');
    console.log('2. Edit .env with your configuration');
    console.log('3. Add JavaScript Manager in WinCC OA with script path: index_http.js');
    
  } else {
    console.error('Build directory not found in package');
    process.exit(1);
  }
  
} catch (error) {
  console.error('Error during postinstall:', error.message);
  process.exit(1);
}