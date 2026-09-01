# Changelog

All notable changes to the WinCC OA MCP Server are documented here.

This project follows [Semantic Versioning](https://semver.org/).

## [1.5.0] — 2026-08-31

Security and supply-chain release, implementing the remediation items from Siemens work item #231342.

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
