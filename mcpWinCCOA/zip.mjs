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
 *
 * Layout: the archive is FLAT. The contents of build/ (index_http.js,
 * index_stdio.js, systemprompt.md, fields/, config/, helpers/, tools/, ...) sit
 * directly at the archive root, next to the documentation - exactly the layout
 * postinstall.cjs produces for an npm install. One set of instructions (manager
 * script path, .env location) therefore holds for both delivery paths.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const manifest = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'));
const version = manifest.version;
const buildDir = join(here, 'build');

const outDir = join(here, 'dist');
const name = `winccoa-mcp-server-${version}-sios`;
const outFile = join(outDir, `${name}.zip`);

/**
 * Root files of the archive: [source, name inside the zip].
 *
 * package.json is NOT copied from here - a sanitized manifest is generated into
 * the staging directory further below (see buildArchiveManifest). It is still
 * required: the quick start's step 2 is "npm install", which needs package.json
 * to know the runtime dependencies.
 *
 * package-lock.json is deliberately NOT shipped. `npm install` reads
 * package.json, not the lockfile; all direct dependencies are pinned to exact
 * versions, so the resolved direct versions are identical with or without it,
 * and sbom.json records the audited set. Including it also made the archive
 * unbuildable on any machine that had run
 * `npm install --save-peer file:...winccoa-manager` per the quick start, since
 * that rewrites the lockfile with a local absolute path.
 *
 * postinstall.cjs is deliberately NOT shipped either. It exists for the npm
 * channel, where it copies node_modules/<package>/build/* into the project. The
 * extracted archive already has that layout, and the archive's package.json has
 * no postinstall script, so there is nothing that could call it.
 *
 * .env.example sits at the root next to index_http.js; the quick start copies
 * it to .env in the same directory, which is where the server looks for it.
 */
const ROOT_FILES = [
  [join(here, 'QUICKSTART.md'), 'QUICKSTART.md'],
  [join(here, '.env.example'), '.env.example'],
  [join(here, 'sbom.json'), 'sbom.json'],
  [join(root, 'OSS.md'), 'OSS.md'],
  [join(root, 'LEGAL_INFO.md'), 'LEGAL_INFO.md'],
  [join(root, 'LICENSE.md'), 'LICENSE.md'],
  [join(root, 'CHANGELOG.md'), 'CHANGELOG.md']
];

/** Name of the generated manifest inside the zip. */
const MANIFEST_NAME = 'package.json';

// Refuse to ship an incomplete archive: a missing QUICKSTART or a stale build is
// exactly the kind of omission hand-assembly produces.
const missing = [buildDir, ...ROOT_FILES.map(([src]) => src)].filter(src => !existsSync(src));
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
  if (!existsSync(join(buildDir, required))) {
    console.error(`❌ build/${required} is missing - run "npm run build".`);
    process.exit(1);
  }
}

/**
 * The children of build/ become the archive root. TypeScript declaration files
 * and source maps are build artefacts nobody at runtime needs; they are shipped
 * anyway, as before, so the archive and the npm package carry the same build.
 */
const BUILD_ENTRIES = readdirSync(buildDir).map(child => [join(buildDir, child), child]);

// Flattening puts build/ children and the root files into one namespace. A
// collision would let one silently overwrite the other, so refuse instead.
const rootNames = new Set([...ROOT_FILES.map(([, n]) => n), MANIFEST_NAME]);
const collisions = BUILD_ENTRIES.map(([, n]) => n).filter(n => rootNames.has(n));
if (collisions.length > 0) {
  console.error('❌ Cannot build the flat SIOS archive, build/ contains names that clash with root files:');
  for (const c of collisions) console.error(`   build/${c}`);
  process.exit(1);
}

const ENTRIES = [...BUILD_ENTRIES, ...ROOT_FILES];

/**
 * The manifest shipped in the archive.
 *
 * It exists only so that `npm install` in the extracted directory pulls the
 * runtime dependencies. Everything that refers to the repository/npm layout is
 * removed:
 *
 *  - scripts.postinstall: would run postinstall.cjs, which is not shipped (and
 *    has nothing to do in an already-flat directory). Dropping the script makes
 *    a failing or surprising install impossible rather than merely unlikely.
 *  - the build/test/release scripts: they need src/ and the dev toolchain,
 *    neither of which is in the archive. start / start:http are rewritten to
 *    the flat paths.
 *  - devDependencies: the archive ships a finished build, so `npm install`
 *    need not download TypeScript, vitest and the SBOM generator. It also keeps
 *    the installed set equal to what sbom.json (--omit dev) describes.
 *  - bin / files: describe the npm package layout (./build/...), not this one.
 *
 * "private": true guards against an accidental `npm publish` from an extracted
 * archive. The npm-published package.json is not affected by any of this.
 */
function buildArchiveManifest(source) {
  const {
    scripts: _scripts,
    devDependencies: _devDependencies,
    bin: _bin,
    files: _files,
    ...rest
  } = source;
  return {
    ...rest,
    private: true,
    scripts: {
      start: 'node index_stdio.js',
      'start:http': 'node index_http.js'
    }
  };
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
 * The children of build/ are copied recursively, and in a development checkout the
 * server reads its .env from build/ (next to index_http.js), so a developer or
 * tester who has configured one leaves MCP_API_TOKEN sitting in the directory
 * being packaged. The first version of this script shipped exactly that.
 * .env.example is the template and is meant to be included.
 */
const isSecret = (path) => {
  const base = path.split(/[\\/]/).pop() ?? '';
  return base === '.env' || (base.endsWith('.env') && base !== '.env.example');
};

// Stage first, then archive the staging directory. This keeps the contents
// identical on every platform - PowerShell's Compress-Archive has no exclude
// option - and makes the filter the single place secrets are kept out.
writeFileSync(
  join(staging, MANIFEST_NAME),
  JSON.stringify(buildArchiveManifest(manifest), null, 2) + '\n'
);

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
const stagedManifest = join(staging, MANIFEST_NAME);
const stagedText = readFileSync(stagedManifest, 'utf8');
const offenders = [...stagedText.matchAll(/"(?:file:)?((?:[A-Za-z]:[\\/]|\.\.[\\/])[^"]*)"/g)].map(m => m[1]);

if (offenders.length > 0) {
  console.error(`❌ Refusing to ship: ${MANIFEST_NAME} contains machine-specific path(s):`);
  for (const o of [...new Set(offenders)]) console.error(`   ${o}`);
  console.error('\nRestore the manifests (git restore) and rebuild.');
  rmSync(staging, { recursive: true, force: true });
  process.exit(1);
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
// not something to discover afterwards. The same listing also proves the layout
// is flat and that nothing belonging to a development checkout slipped in.
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

const entries = listing.split(/\r?\n/).map(l => l.trim().replace(/\\/g, '/')).filter(Boolean);
const misplaced = entries.filter(
  l =>
    l.startsWith('build/') ||
    l.startsWith('node_modules/') ||
    l === 'package-lock.json' ||
    l === 'postinstall.cjs'
);
const absent = ['index_http.js', 'index_stdio.js', 'systemprompt.md', MANIFEST_NAME].filter(
  f => !entries.includes(f)
);
if (misplaced.length > 0 || absent.length > 0) {
  console.error('❌ Refusing to ship: the archive does not have the flat layout.');
  for (const l of misplaced.slice(0, 10)) console.error(`   unexpected: ${l}`);
  for (const f of absent) console.error(`   missing at root: ${f}`);
  rmSync(outFile, { force: true });
  process.exit(1);
}

const kb = Math.round(statSync(outFile).size / 1024);
console.log(`✅ ${outFile} (${kb} KB)`);
console.log('   contents: ' + [...ENTRIES.map(([, n]) => n), MANIFEST_NAME].join(', '));
console.log('   verified: flat layout, no .env or secret-shaped file, no postinstall');
