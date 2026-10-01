'use strict';

/**
 * Builds the runtime manifest (package.json) that is written next to the flat
 * server files, for both delivery paths:
 *
 *  - npm install: postinstall.cjs writes it into the install directory
 *  - SIOS archive: zip.mjs writes it into the archive
 *
 * CommonJS so that postinstall.cjs can require() it and zip.mjs can load it via
 * createRequire(). It is listed in the package.json "files" field because
 * postinstall.cjs needs it inside the published npm package.
 *
 * The manifest exists only so that `npm install` in the flat directory pulls the
 * runtime dependencies. Everything that refers to the repository/npm layout is
 * removed:
 *
 *  - scripts.postinstall: would run postinstall.cjs, which is not copied into
 *    the flat directory (and has nothing to do there).
 *  - build/test/release scripts: they need src/ and the dev toolchain.
 *    start / start:http are rewritten to the flat paths.
 *  - devDependencies: a finished build is shipped; keeps the installed set equal
 *    to what sbom.json (--omit dev) describes.
 *  - bin / files: describe the npm package layout (./build/...), not the flat one.
 *
 * "private": true guards against an accidental `npm publish` from the install
 * directory. The published package.json itself is not affected.
 *
 * @param {Record<string, unknown>} source the package's own package.json
 * @returns {Record<string, unknown>} the sanitized manifest
 */
function buildRuntimeManifest(source) {
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

module.exports = { buildRuntimeManifest };
