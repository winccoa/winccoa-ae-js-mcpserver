# Changelog

All notable changes to the WinCC OA MCP Server are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [1.5.1] — 2026-09-30

Maintenance and security release: Node.js 24 LTS, an `mcp-remote` security update, and a flat SIOS
archive.

### ⚠️ Upgrade notes

- **Node.js 24 LTS is now the minimum** (`engines.node >= 24.0.0`). Node.js 20 LTS reached end-of-life
  on 2026-04-30. This is breaking for anyone still on Node.js 20 or 22: upgrade Node before installing
  this version.
- **The SIOS archive layout has changed** ([#36](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues/36)).
  Existing archive users must re-extract: the `build/` folder is gone, so the manager script path
  changes from `mcpWinCCOA/build/index_http.js` to `mcpWinCCOA/index_http.js` (or `<your folder>/index_http.js`)
  and `.env` moves from `build\.env` to the directory that holds `index_http.js`. The npm install path
  keeps its layout.

### Changed

- **CI:** GitHub Actions updated to Node 24 runtimes (`actions/upload-artifact` v5 → v7) and the Ubuntu
  runner pinned to `ubuntu-24.04` ahead of the `ubuntu-latest` migration to Ubuntu 26 on 2026-10-19.

### Security

- **Updated `mcp-remote` 0.1.37 → 0.14.3.** Fixes the Remote Information Disclosure in OAuth scope
  handling that affects 0.1.32 to 0.1.38 (fixed in 0.1.39; Siemens SVM notification 236904). The update
  also removes the vulnerable transitive versions it pulled in: `undici` 7.29.0 (ten high advisories,
  now 7.30.0) and the `express` 4 / `body-parser` / `qs` chain (moderate, now `express` 4.22.3,
  `body-parser` 1.20.8, `qs` 6.16.0). The `mcp-remote` CLI flags used in the documentation
  (positional URL, `--header`, `--allow-http`) are unchanged.
- Lockfile refreshed with `npm audit fix` (no `--force`): `fast-uri` 3.1.8, `ip-address` 10.7.2 and,
  dev-only, `brace-expansion` 2.1.7. `npm audit` reports **0 vulnerabilities**, with and without
  `--omit=dev`.

### Changed

- **SIOS archive is now flat, matching the npm install layout**
  ([#36](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues/36)). The contents of `build/`
  (`index_http.js`, `index_stdio.js`, `systemprompt.md`, `fields/`, `config/`, ...) sit at the archive
  root next to the documentation, so one set of instructions covers both delivery paths. The archive's
  `package.json` is now generated: it keeps the runtime `dependencies` so `npm install` still works,
  but has no `postinstall` script, no build/test scripts and no `devDependencies`, and is marked
  `private`. `postinstall.cjs` is no longer part of the archive. `zip.mjs` refuses to build an archive
  that is not flat.
- `@types/node` 20.19.43 → 24.19.0.
- CI and the release workflow run on Node.js 24.

### Fixed

- **npm install path: the manifest written into the install directory was broken.** `postinstall.cjs`
  copied the package's `package.json` verbatim, including the `postinstall` hook (whose script is not
  copied), `build/`-based `bin` / `start` entries, `files` and `devDependencies`, so a later
  `npm install` in the install directory failed with `MODULE_NOT_FOUND`. It now writes a runtime
  manifest (no `postinstall`, no build/test scripts, no `devDependencies`, `start` /
  `start:http` pointing at the flat files, `"private": true`). The sanitizer (`manifest.cjs`) is shared
  with `zip.mjs`, so the npm and SIOS paths produce the same manifest. Re-running `npm install` in the
  install directory no longer fails.
- **Icon tools were missing from every session.** The icon tools derived the WinCC OA project
  directory by walking a fixed six levels up from their own module, which is only right for a git
  clone inside `<project>/javascript/`; it was wrong in all shipped layouts (flat npm/SIOS install,
  the old archive) and for symlinked development checkouts, and pointed outside the project. Because the
  icons directory was created in the constructor, the resulting `EACCES` made `icons/icon` fail to
  load, so `create-custom-icon`, `list-custom-icons`, `delete-custom-icon` and `list-ix-icons` were
  absent, logged as a SEVERE error on every request. The project path is now resolved via the WinCC OA
  manager (`winccoa.getPaths()`), with `WINCCOA_PROJ_PATH` as an optional override and `PVSS_II` / a
  search for `config/config` as fallbacks, and logged once at startup. The directory is created only
  when an icon is written; an unknown or unwritable path now yields a clear tool error
  (`ICON_STORAGE_UNAVAILABLE`) instead of a failed module.
- **`list-ix-icons` only knew a small built-in subset.** `IX_ICONS_LIST.txt` (1,407 icons) was read from
  `docs/`, which is not shipped; it is now copied into the build (`helpers/icons/`) and included in the
  npm package and the SIOS archive.
- **Tool loader summary counted configured modules, not loaded ones.** "Registered N tools from M
  modules" now reports the modules that actually registered and names the ones that failed. A module
  that fails to load is reported once per process instead of on every HTTP request (per-request detail
  with `MCP_LOG_LEVEL=debug`).
- **`get-value` hid the actual error.** Errors forwarded only the outer 9399 "multiple errors (N errors
  total)"; the message and `errorCode` now carry the inner WinCC OA errors (a missing datapoint yields
  71 / `DP_NOT_EXIST`), and `details` lists them. The same applies to `failures[]` of a partial
  multi-element read.
- **`get-datapoints` pagination data never reached the client, and an empty result was empty.** The
  `metadata` field was not part of the MCP tool result and was dropped. The tool now returns one JSON
  envelope `{success, data: {datapoints, totalCount, start, limit, returnedCount, hasMore}}`, also when
  nothing matches (`datapoints: []`). **Output shape change.**
- **`get-dpTypes` returned bare text items** and its description promised complete structure
  information. It now returns `{success, data: {types, count, withInternals}}` (names only; use
  `dp-type-get` for the structure). **Output shape change.**
- **`dp-type-name` description** claimed an empty string on error; it documents the actual
  `{dpName, typeName}` / error envelope now, and an empty type name is reported as an error.
- **`pv-range-query` logged a SEVERE error with stack trace for every element without a range
  config.** "Attribute does not exist in this config" (code 19) is now treated as "not configured"
  (debug log only), the config type is read first, other errors return an error envelope, and the
  description states that `{configured: false, ...}` is returned rather than `null`.

### Documentation

- `QUICKSTART.md` rewritten for the flat archive: extract into `javascript\mcpWinCCOA\` (the same folder
  name is used in all docs, for the archive and the npm path), `.env` next to `index_http.js`, manager options
  `mcpWinCCOA/index_http.js`, plus an upgrade note for 1.5.0 archive users. It also stated version 1.4.0.
- Node.js requirement updated to 24 LTS in `QUICKSTART.md`, `docs/INSTALLATION.md` (which still said
  Node.js 18+) and `docs/PREREQUISITES.md`.
- `docs/dev/release.md` documents the SIOS archive structure.

## [1.5.0] — 2026-08-31

Security and supply-chain release, implementing the findings of an internal Siemens security review.

### ⚠️ Upgrade notes

- **Node.js 20 LTS is now the minimum** (`engines.node >= 20.0.0`). Node 18 has reached end-of-life.
  Upgrade Node before installing this version.
- **`build.sh` has been removed.** Build with `npm run build`, which now runs `build.mjs`. If you built
  with a bare `npx tsc`, stop: that omits the runtime assets and the server cannot find its field
  definitions or system prompt.
- **TLS remains off by default.** The server now prints a `[SECURITY WARNING]` at startup when it binds
  a non-loopback address without TLS. Nothing changes in behaviour, but the warning is new and
  deliberate — enabling TLS by default is planned for 2.0.0.
- **Releases now require the version to be bumped before tagging.** The release workflow verifies that
  the tag matches both `mcpWinCCOA/package.json` and `package.winccoa.json`, and fails if they disagree.

### Security

- **Fixed a cross-client data leak in the HTTP transport.** A single `McpServer` instance was shared
  across every HTTP request. This is the subject of a HIGH advisory against `@modelcontextprotocol/sdk`
  ("cross-client data leak via shared server/transport instance reuse") and the same defect as
  [#33](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues/33). Each request now gets its own
  server instance; the WinCC OA manager remains a process-wide singleton.
- **Bumped `@modelcontextprotocol/sdk` 1.25.3 → 1.30.0**, past that advisory's range (1.10.0–1.25.3).
- **Resolved all 16 dependency advisories** (2 critical, 7 high, 7 moderate) — `npm audit` is now clean.
- **API tokens are no longer written to logs.** Previously each request logged the `Authorization`
  header prefix, the presented token prefix, the expected token prefix and all request header names, and
  two startup lines logged the token prefix. Authentication failures now log only the client IP and
  whether a token was presented.
- **Token comparison is now timing-safe** (`crypto.timingSafeEqual`). The previous `!==` comparison
  short-circuited on the first differing byte.
- **Configuration validation now covers TLS.** Enabling TLS with a missing or unreadable certificate
  fails at startup with a message naming the environment variable, the path and the OS error.
- Added `MCP_LOG_LEVEL` (`debug` | `info` | `warn` | `error`, default `info`). Per-request tracing is
  now behind `debug`.

### Supply chain

- **All 12 direct dependencies pinned to exact versions**; lockfile regenerated. `winccoa-manager`
  remains an open, optional `peerDependency` — it is proprietary Siemens code supplied by the WinCC OA
  installation and is never bundled.
- **Added a CycloneDX SBOM** (`npm run sbom` → `sbom.json`), scoped to what is actually distributed
  (111 components). Generated and validated in CI, and attached to each GitHub release.
- **CI fails on any high or critical advisory** (`npm audit --audit-level=high`), and rejects an SBOM
  containing proprietary components, unlicensed components, or a leaked local build path.
- **`OSS.md` populated** with all direct runtime dependencies, their exact versions and licences.
- **Removed a machine-specific path from `package-lock.json`** that pointed into a local
  `C:\Program Files\Siemens\WinCC_OA\...` installation and broke `npm install` on Windows.

### Added

- `build.mjs` — a cross-platform build with no shell dependency, so `npm run build` works on Windows,
  Linux and macOS. Replaces the bash-only `build.sh`.
- CI now runs on **Windows as well as Linux**, and verifies that the build output contains the assets
  `tsc` does not emit (`fields/`, `systemprompt.md`, `config/`).
- `.gitattributes` enforcing LF line endings, ending the disagreement between Git for Windows and
  Linux/WSL clients over which files are modified.
- Cybersecurity information in `README.md`, and the current disclaimer in `LEGAL_INFO.md` (English and
  German).

### Fixed

- **All four `instructions://*` resources were unreachable.** They were registered with the URI in the
  `name` argument, so every read failed with `-32602`. None of `instructions://system`, `://field`,
  `://project` or `://combined` could be read.
- The reported server version was hardcoded to `3.0.0`; it is now read from `package.json`.
- `npm run dev` used a bare `tsc`, producing an incomplete build.
- The release workflow never bumped the version and never ran the tests, though
  `docs/dev/release.md` described both.
- Replaced the archived `actions/upload-release-asset@v1` in the release path with `gh release upload`.

### Documentation

- **`docs/TROUBLESHOOTING.md` claimed there was no built-in HTTPS support.** Untrue since the feature
  existed — replaced with the real limitations, including the previously undocumented absence of
  client-certificate (mTLS) authentication
  ([#34](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues/34)).
- `README.md` now warns, at both places that recommend `--allow-http`, that the token and all traffic
  cross the network in clear text.
- `docs/TOOLS.md` documents that all widget types are read-only and that command widgets are not
  currently supported ([#32](https://github.com/winccoa/winccoa-ae-js-mcpserver/issues/32)).
- `docs/INSTALLATION.md` gained a build-from-source section; there was none.
- **`npm install` for `winccoa-manager` now documented as `npm install --save-peer file:...`.** On
  npm 11 and later, a plain `npm install file:...` silently does nothing for this package — it prints
  `added 25 packages`, exits 0, and never creates `node_modules/winccoa-manager`, so the server fails
  at startup with `ERR_MODULE_NOT_FOUND`. `winccoa-manager` is an optional `peerDependency`, and npm 11
  no longer materialises those from a `file:` spec (verified: npm 10.9.4 does, npm 11.6.0 does not).
  `--save-peer` works on both and records the package under `peerDependencies` rather than
  `dependencies`, which is where it belongs. Covered in `docs/INSTALLATION.md` and
  `docs/TROUBLESHOOTING.md`.
- `docs/dev/release.md` corrected throughout.

### Tests

- 147 → 176 tests. Coverage: `server.config.ts` 0% → 93%, `index_http.ts` 0% → 37%,
  `src/server.ts` 0% → 62%.
- Upgraded vitest 2.1.9 → 4.1.11 (required for the security fixes in its dependency tree).
- **Removed `src/config/server.config.js`**, a stale compiled artifact committed alongside
  `server.config.ts`. Because every import specifier ends in `.js`, tests had been resolving the stale
  file rather than the TypeScript source.

## [1.4.0] and earlier

See the [GitHub releases](https://github.com/winccoa/winccoa-ae-js-mcpserver/releases).
