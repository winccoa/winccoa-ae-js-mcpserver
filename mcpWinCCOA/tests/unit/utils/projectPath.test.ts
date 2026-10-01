/**
 * Unit tests for src/utils/projectPath.ts
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import {
  resolveProjectPath,
  resolveProjectPathWithSource,
  findProjectDirUpward
} from '../../../src/utils/projectPath.js';

const savedEnv = { WINCCOA_PROJ_PATH: process.env.WINCCOA_PROJ_PATH, PVSS_II: process.env.PVSS_II };

let tempRoot: string;

beforeEach(() => {
  delete process.env.WINCCOA_PROJ_PATH;
  delete process.env.PVSS_II;
  tempRoot = mkdtempSync(join(tmpdir(), 'mcp-projpath-'));
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(tempRoot, { recursive: true, force: true });
});

/** Create <tempRoot>/proj/config/config and return the project dir. */
function makeProject(): string {
  const proj = join(tempRoot, 'proj');
  mkdirSync(join(proj, 'config'), { recursive: true });
  writeFileSync(join(proj, 'config', 'config'), '[general]\n');
  return proj;
}

const managerWithPaths = (paths: string[]) => ({ getPaths: () => paths });

describe('resolveProjectPathWithSource', () => {
  it('prefers WINCCOA_PROJ_PATH over everything else', () => {
    process.env.WINCCOA_PROJ_PATH = '/override/proj';
    process.env.PVSS_II = '/pvss/proj/config/config';
    expect(resolveProjectPathWithSource(managerWithPaths(['/manager/proj']))).toEqual({
      path: resolve('/override/proj'),
      source: 'WINCCOA_PROJ_PATH'
    });
  });

  it('resolves a relative WINCCOA_PROJ_PATH to an absolute path', () => {
    process.env.WINCCOA_PROJ_PATH = 'relative/proj';
    expect(resolveProjectPathWithSource()).toEqual({
      path: resolve('relative/proj'),
      source: 'WINCCOA_PROJ_PATH'
    });
  });

  it('ignores an empty WINCCOA_PROJ_PATH', () => {
    process.env.WINCCOA_PROJ_PATH = '  ';
    expect(resolveProjectPathWithSource(managerWithPaths(['/manager/proj'])).source).toBe('winccoa.getPaths()');
  });

  it('uses the first entry of winccoa.getPaths()', () => {
    process.env.PVSS_II = '/pvss/proj/config/config';
    expect(resolveProjectPathWithSource(managerWithPaths(['/manager/proj', '/opt/WinCC_OA/3.21']))).toEqual({
      path: '/manager/proj',
      source: 'winccoa.getPaths()'
    });
  });

  it('falls back to PVSS_II when getPaths throws or returns nothing', () => {
    process.env.PVSS_II = '/pvss/proj/config/config';
    const throwing = { getPaths: () => { throw new Error('not connected'); } };
    expect(resolveProjectPathWithSource(throwing)).toEqual({ path: '/pvss/proj', source: 'PVSS_II' });
    expect(resolveProjectPathWithSource(managerWithPaths([]))).toEqual({ path: '/pvss/proj', source: 'PVSS_II' });
    expect(resolveProjectPathWithSource({})).toEqual({ path: '/pvss/proj', source: 'PVSS_II' });
  });

  it('searches upward for a directory containing config/config', () => {
    const proj = makeProject();
    const deep = join(proj, 'javascript', 'mcpWinCCOA', 'utils');
    mkdirSync(deep, { recursive: true });
    expect(resolveProjectPathWithSource(undefined, deep)).toEqual({ path: proj, source: 'directory search' });
    expect(findProjectDirUpward(deep)).toBe(proj);
  });

  it('returns undefined when nothing matches', () => {
    const empty = join(tempRoot, 'a', 'b');
    mkdirSync(empty, { recursive: true });
    expect(resolveProjectPathWithSource(undefined, empty)).toEqual({ path: undefined, source: 'none' });
  });
});

describe('resolveProjectPath', () => {
  it('returns just the path', () => {
    process.env.WINCCOA_PROJ_PATH = '/override/proj';
    expect(resolveProjectPath()).toBe(resolve('/override/proj'));
  });
});
