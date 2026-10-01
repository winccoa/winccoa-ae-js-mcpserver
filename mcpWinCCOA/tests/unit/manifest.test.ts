import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildRuntimeManifest } = require('../../manifest.cjs');

const source = {
  name: '@scope/pkg',
  version: '1.2.3',
  description: 'desc',
  type: 'module',
  bin: { a: './build/a.js' },
  scripts: { build: 'x', test: 'y', postinstall: 'node postinstall.cjs', start: 'node build/index_stdio.js' },
  files: ['build', 'postinstall.cjs'],
  license: 'ISC',
  author: 'me',
  repository: { type: 'git', url: 'u' },
  homepage: 'h',
  bugs: { url: 'b' },
  engines: { node: '>=24.0.0' },
  dependencies: { zod: '1.0.0' },
  peerDependencies: { 'winccoa-manager': '*' },
  peerDependenciesMeta: { 'winccoa-manager': { optional: true } },
  devDependencies: { vitest: '1.0.0' }
};

describe('buildRuntimeManifest', () => {
  const out = buildRuntimeManifest(source);

  it('drops the npm-layout and dev-only fields', () => {
    expect(out).not.toHaveProperty('bin');
    expect(out).not.toHaveProperty('files');
    expect(out).not.toHaveProperty('devDependencies');
    expect(out.scripts).not.toHaveProperty('postinstall');
    expect(out.scripts).not.toHaveProperty('build');
    expect(out.scripts).not.toHaveProperty('test');
  });

  it('rewrites the start scripts to the flat layout and marks it private', () => {
    expect(out.scripts).toEqual({ start: 'node index_stdio.js', 'start:http': 'node index_http.js' });
    expect(out.private).toBe(true);
  });

  it('keeps metadata, engines and runtime/peer dependencies', () => {
    for (const k of ['name', 'version', 'description', 'type', 'license', 'author', 'repository',
      'homepage', 'bugs', 'engines', 'dependencies', 'peerDependencies', 'peerDependenciesMeta']) {
      expect(out[k]).toEqual((source as Record<string, unknown>)[k]);
    }
  });

  it('does not mutate its input', () => {
    expect(source.scripts.postinstall).toBe('node postinstall.cjs');
    expect(source.bin).toBeDefined();
  });
});
