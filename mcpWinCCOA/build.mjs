#!/usr/bin/env node
/**
 * Build script for the WinCC OA MCP Server.
 *
 * Cross-platform replacement for the former build.sh: compiles TypeScript and
 * copies the non-TS runtime assets (field definitions, system prompt, demo
 * project instructions) into build/, since tsc only emits .js for src/**.
 *
 * Runs on Windows, Linux and macOS - no shell required.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chmodSync, cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = dirname(fileURLToPath(import.meta.url));
const buildDir = join(root, 'build');

/** Entry points that must stay executable on POSIX (npm bin targets). */
const ENTRY_POINTS = ['index_stdio.js', 'index_http.js'];

/** Non-TS assets the server loads at runtime, relative to the package root. */
const ASSETS = [
  { from: join(root, 'src', 'fields'), to: join(buildDir, 'fields'), label: 'fields directory' },
  { from: join(root, 'src', 'systemprompt.md'), to: join(buildDir, 'systemprompt.md'), label: 'system prompt' },
  {
    from: join(root, 'config', 'demo-project-instructions.md'),
    to: join(buildDir, 'config', 'demo-project-instructions.md'),
    label: 'demo project instructions'
  }
];

console.log('🔄 Building WinCC OA MCP Server...');

// TypeScript compilation. Invoke the compiler's JS entry point directly with
// the current node binary, so we do not depend on a shell, a PATH lookup, or
// the .cmd/.ps1 shims npm installs on Windows.
console.log('🔄 Compiling TypeScript...');
const tsc = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc')], {
  cwd: root,
  stdio: 'inherit'
});

if (tsc.error) {
  console.error('❌ Could not run the TypeScript compiler:', tsc.error.message);
  process.exit(1);
}
if (tsc.status !== 0) {
  console.error(`❌ TypeScript compilation failed (exit code ${tsc.status}).`);
  process.exit(tsc.status ?? 1);
}

// Copy runtime assets.
console.log('🔄 Copying runtime assets...');
for (const { from, to, label } of ASSETS) {
  if (!existsSync(from)) {
    console.error(`❌ Missing build input: ${from}`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`  ✓ ${label}`);
}

// Mark the npm bin entry points executable. Meaningless on Windows, where
// executability comes from the file extension rather than a mode bit.
if (process.platform !== 'win32') {
  console.log('🔄 Setting executable permissions...');
  for (const entry of ENTRY_POINTS) {
    chmodSync(join(buildDir, entry), 0o755);
    console.log(`  ✓ ${entry}`);
  }
}

console.log('✅ Build completed successfully!');
