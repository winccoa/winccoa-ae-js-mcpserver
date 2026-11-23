#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { buildRuntimeManifest } = require('./manifest.cjs');

// Get package info dynamically
const packageJson = require('./package.json');
const packageName = packageJson.name;

// The package root is where this script lives. It is inside a node_modules folder
// whenever the package was installed (also hoisted or with a non-default layout);
// in a repository checkout it is not.
const packageRoot = __dirname;
const isInstalledPackage = packageRoot.split(path.sep).includes('node_modules');

// Two entry points share this script:
//  - npm "postinstall" lifecycle (npm 11 and older): INIT_CWD is the directory where
//    `npm install` was run, process.cwd() is the package folder itself.
//  - the "winccoa-mcp-install" bin (`npx winccoa-mcp-install`, required on npm 12+,
//    where install scripts are opt-in): the user's project directory is process.cwd().
const isLifecycle = process.env.npm_lifecycle_event === 'postinstall';
const installDir = path.resolve(isLifecycle ? (process.env.INIT_CWD || process.cwd()) : process.cwd());
const nodeModulesPath = packageRoot;
const srcPath = path.join(nodeModulesPath, 'src');

// Skip when running inside the repository itself (development mode): the package is not
// installed under node_modules, or the target would be the package folder itself.
const isDevMode = !isInstalledPackage || installDir === path.resolve(packageRoot);

if (isDevMode) {
  console.log('Development mode detected - skipping postinstall.');
  console.log('Use "npm run build" to build the TypeScript sources.');
  process.exit(0);
}

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
      
      // User-owned files: never overwrite on a re-run. fields/ is handled below
      // (per file, existing files are kept).
      if (file.name === 'fields' || ((file.name === '.env' || file.name === 'systemprompt.md') && fs.existsSync(destPath))) {
        continue;
      }

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

    // Write a runtime package.json. The package's own manifest must NOT be copied
    // verbatim: it still has the postinstall hook (postinstall.cjs is not copied, so
    // a later `npm install` here would fail), build/-based bin and start entries,
    // files and devDependencies. See manifest.cjs (shared with zip.mjs).
    // Like the build files above, an existing package.json is overwritten.
    const packageJsonSrc = path.join(nodeModulesPath, 'package.json');
    const packageJsonDest = path.join(installDir, 'package.json');
    if (fs.existsSync(packageJsonSrc)) {
      const runtimeManifest = buildRuntimeManifest(JSON.parse(fs.readFileSync(packageJsonSrc, 'utf8')));
      fs.writeFileSync(packageJsonDest, JSON.stringify(runtimeManifest, null, 2) + '\n');
      console.log('Wrote runtime package.json');
    }


    // Copy demo-project-instructions.md
    const demoSrc = path.join(nodeModulesPath, 'config', 'demo-project-instructions.md');
    const demoDest = path.join(installDir, 'demo-project-instructions.md');
    if (fs.existsSync(demoSrc)) {
      fs.copyFileSync(demoSrc, demoDest);
      console.log('Copied demo-project-instructions.md');
    }

    const fieldsPathSrc = path.join(srcPath, 'fields');
    const fieldsPathDest = path.join(installDir, 'fields');

    if(!fs.existsSync(fieldsPathDest)) {
      fs.mkdirSync(fieldsPathDest);
      console.log('Created fields directory');
    }

    if (fs.existsSync(fieldsPathSrc)) {
      // Copy all files from src/fields directory
      const files = fs.readdirSync(fieldsPathSrc, { withFileTypes: true });

      for (const file of files) {
        // Skip . and .. entries
        if (file.name === '.' || file.name === '..') {
          continue;
        }

        // Copy file
        const sourceFilePath = path.join(fieldsPathSrc, file.name);
        const destinationFilePath = path.join(fieldsPathDest, file.name);
        if(!fs.existsSync(destinationFilePath)) {
           fs.copyFileSync(sourceFilePath, destinationFilePath);
           console.log(`Copied file: ${file.name}`);
      }
      }
    }

    
    console.log('\n✅ Installation complete!');
    console.log('(Safe to re-run: npx winccoa-mcp-install. Needed on npm 12+, where install scripts are opt-in.)');
    console.log('\nNext steps:');
    console.log('1. Copy the environment file: cp .env.example .env');
    console.log('2. Edit .env with your configuration');
    console.log('3. Add JavaScript Manager in WinCC OA with script path: mcpWinCCOA/index_http.js (install into <OA_ProjPath>/javascript/mcpWinCCOA)');
    
  } else {
    console.error('Build directory not found in package');
    process.exit(1);
  }
  
} catch (error) {
  console.error('Error during setup:', error.message);
  process.exit(1);
}