#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get package info dynamically
const packageJson = require('./package.json');
const packageName = packageJson.name;

// Determine the installation directory (where npm install was run)
const installDir = process.env.INIT_CWD || process.cwd();
const nodeModulesPath = path.join(installDir, 'node_modules', packageName);
const srcPath = path.join(nodeModulesPath, 'src');


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

    // Copy systempprompt.md
    const systemPromptSrc = path.join(srcPath, 'systemprompt.md');
    const systemPromptDest = path.join(installDir, 'systemprompt.md');

    if (fs.existsSync(systemPromptSrc) && !fs.existsSync(systemPromptDest)) {
      fs.copyFileSync(systemPromptSrc, systemPromptDest);
      console.log('Copied systemprompt.md');
    }

    // Copy package.json
    const packageJsonSrc = path.join(nodeModulesPath, 'package.json');
    const packageJsonDest = path.join(installDir, 'package.json');
    if (fs.existsSync(packageJsonSrc)) {
      fs.copyFileSync(packageJsonSrc, packageJsonDest);
      console.log('Copied package.json');
    }

    const fieldsPathSrc = path.join(srcPath, 'fields');
    const fieldsPathDest = path.join(installDir, 'fields');

    if (fs.existsSync(fieldsPathSrc)) {
      // Copy all files from src/fields directory
      const files = fs.readdirSync(fieldsPathSrc, { withFileTypes: true });

      for (const file of files) {
        // Copy file
        const destinationFilePath = path.join(fieldsPathDest, file.name);
        if(!fs.existsSync(destinationFilePath)) {
           fs.copyFileSync(srcPath, destinationFilePath);
           console.log(`Copied file: ${file.name}`);
      }
      }
    }

    
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