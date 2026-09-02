#!/usr/bin/env node
/**
 * Build the SIOS delivery archive.
 *
 * This is a different distribution channel from npm. `npm pack` produces the
 * tarball for `npm install`, where postinstall lays the files out; nobody
 * extracts it by hand. The SIOS archive is the opposite: a recipient unzips it
 * and runs the server directly, so it carries QUICKSTART.md - which is
 * deliberately NOT in the npm package, where it would only confuse.
 *
 * Scripted rather than assembled by hand so the contents are reproducible and a
 * file cannot silently go missing.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const version = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')).version;

const outDir = join(here, 'dist');
const name = `winccoa-mcp-server-${version}-sios`;
const outFile = join(outDir, `${name}.zip`);

/** Contents of the archive: [source, name inside the zip]. */
const ENTRIES = [
  [join(here, 'build'), 'build'],
  [join(here, 'QUICKSTART.md'), 'QUICKSTART.md'],
  // Required, not optional: the quick start's step 2 is "npm install", which
  // needs package.json to know the seven runtime dependencies, package-lock.json
  // to install the exact audited versions, and postinstall.cjs because
  // package.json's postinstall script calls it - a missing file there fails the
  // install outright.
  //
  // package-lock.json is deliberately NOT shipped. The quick start's step 2 is
  // `npm install`, which reads package.json, not the lockfile; all seven direct
  // dependencies are pinned to exact versions, so the resolved direct versions
  // are identical with or without it, and sbom.json records the audited set.
  // Including it also made the archive unbuildable on any machine that had run
  // `npm install --save-peer file:...winccoa-manager` per the quick start, since
  // that rewrites the lockfile with a local absolute path.
  //
  // .env.example stays at the root, not inside build/: build/ is disposable and
  // regenerated, so a template living only there is lost the moment someone
  // clears it. The quick start copies from the root into build/.env.
  [join(here, '.env.example'), '.env.example'],
  [join(here, 'package.json'), 'package.json'],
  [join(here, 'postinstall.cjs'), 'postinstall.cjs'],
  [join(here, 'sbom.json'), 'sbom.json'],
  [join(root, 'OSS.md'), 'OSS.md'],
  [join(root, 'LEGAL_INFO.md'), 'LEGAL_INFO.md'],
  [join(root, 'LICENSE.md'), 'LICENSE.md'],
  [join(root, 'CHANGELOG.md'), 'CHANGELOG.md']
];

// Refuse to ship an incomplete archive: a missing QUICKSTART or a stale build is
// exactly the kind of omission hand-assembly produces.
const missing = ENTRIES.filter(([src]) => !existsSync(src)).map(([src]) => src);
if (missing.length > 0) {
  console.error('❌ Cannot build the SIOS archive, these are missing:');
  for (const m of missing) console.error(`   ${m}`);
  console.error('\nRun "npm run build" and "npm run sbom" first.');
  console.error('(the archive ships the committed sbom.json, it does not regenerate it)');
  process.exit(1);
}

// The build must contain the assets tsc does not emit, or the server starts and
// then cannot find its field definitions.
for (const required of ['index_http.js', 'index_stdio.js', 'systemprompt.md', 'fields', 'config']) {
  if (!existsSync(join(here, 'build', required))) {
    console.error(`❌ build/${required} is missing - run "npm run build".`);
    process.exit(1);
  }
}

const staging = join(outDir, name);

// Remove any previous archive first: `zip` appends to an existing file rather
// than replacing it, which would silently keep stale entries. Report a locked
// file clearly instead of dying on a stack trace - on Windows an open Explorer
// preview or a virus scanner is enough to hold it.
try {
  rmSync(outFile, { force: true });
} catch (error) {
  console.error(`❌ Cannot replace the existing archive:\n   ${outFile}`);
  console.error(`   ${error instanceof Error ? error.message : String(error)}`);
  console.error('\nSomething is holding the file open - close any Explorer preview or');
  console.error('archive viewer, then run again.');
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

console.log(`🔄 Building ${name}.zip ...`);

/**
 * Never copy a secret into the archive.
 *
 * build/ is copied recursively and the server reads its .env from build/, so a
 * developer or tester who has configured one leaves MCP_API_TOKEN sitting in the
 * directory being packaged. The first version of this script shipped exactly
 * that. .env.example is the template and is meant to be included.
 */
const isSecret = (path) => {
  const base = path.split(/[\\/]/).pop() ?? '';
  return base === '.env' || (base.endsWith('.env') && base !== '.env.example');
};

// Stage first, then archive the staging directory. This keeps the contents
// identical on every platform - PowerShell's Compress-Archive has no exclude
// option - and makes the filter the single place secrets are kept out.
for (const [src, entryName] of ENTRIES) {
  const dest = join(staging, entryName);
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, {
    recursive: true,
    filter: (from) => {
      if (isSecret(from)) {
        console.log(`  ⨯ excluded ${from.replace(here + '/', '').replace(here + '\\', '')}`);
        return false;
      }
      return true;
    }
  });
}

// A manifest can carry a machine-specific path without anyone noticing: running
// `npm install --save-peer file:C:/...winccoa-manager` for local testing rewrites
// peerDependencies to that absolute path, and it has reached a commit that way
// more than once. Shipping it would make `npm install` fail for the recipient,
// who has no such directory.
for (const manifest of ['package.json']) {
  const staged = join(staging, manifest);
  if (!existsSync(staged)) continue;

  const text = readFileSync(staged, 'utf8');
  const offenders = [...text.matchAll(/"(?:file:)?((?:[A-Za-z]:[\\/]|\.\.[\\/])[^"]*)"/g)].map(m => m[1]);

  if (offenders.length > 0) {
    console.error(`❌ Refusing to ship: ${manifest} contains machine-specific path(s):`);
    for (const o of [...new Set(offenders)]) console.error(`   ${o}`);
    console.error('\nRestore the manifests (git restore) and rebuild.');
    rmSync(staging, { recursive: true, force: true });
    process.exit(1);
  }
}


if (process.platform === 'win32') {
  execFileSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path '${join(staging, '*').replace(/'/g, "''")}' -DestinationPath '${outFile.replace(/'/g, "''")}' -Force`
    ],
    { stdio: 'inherit' }
  );
} else {
  execFileSync('zip', ['-q', '-r', outFile, '.'], { cwd: staging, stdio: 'inherit' });
}

rmSync(staging, { recursive: true, force: true });

// Verify the archive rather than trusting the filter: a secret reaching SIOS is
// not something to discover afterwards.
const listing =
  process.platform === 'win32'
    ? execFileSync('powershell', [
        '-NoProfile',
        '-Command',
        `Add-Type -A System.IO.Compression.FileSystem; ` +
          `[IO.Compression.ZipFile]::OpenRead('${outFile.replace(/'/g, "''")}').Entries | ForEach-Object { $_.FullName }`
      ]).toString()
    : execFileSync('unzip', ['-Z1', outFile]).toString();

const leaked = listing
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l && isSecret(l));

if (leaked.length > 0) {
  console.error('❌ Refusing to ship: the archive contains secret files:');
  for (const l of leaked) console.error(`   ${l}`);
  rmSync(outFile, { force: true });
  process.exit(1);
}

const kb = Math.round(statSync(outFile).size / 1024);
console.log(`✅ ${outFile} (${kb} KB)`);
console.log('   contents: ' + ENTRIES.map(([, n]) => n).join(', '));
console.log('   verified: no .env or secret-shaped file present');
