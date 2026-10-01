/**
 * Unit tests for src/helpers/icons (IconGenerator, IconList)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { IconGenerator, IconStorageError, InvalidIconNameError, validateIconName } from '../../../src/helpers/icons/IconGenerator.js';
import { IconList, ICON_CATEGORIES } from '../../../src/helpers/icons/IconList.js';

let tempRoot: string;

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'mcp-icons-'));
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('IconGenerator', () => {
  it('constructor does not throw or touch the filesystem without a project path', () => {
    const generator = new IconGenerator(undefined);
    expect(generator.getIconsPath()).toBeUndefined();
  });

  it('constructor does not create the icons directory', () => {
    const generator = new IconGenerator(join(tempRoot, 'proj'));
    expect(generator.getIconsPath()).toBe(join(tempRoot, 'proj', 'data', 'WebUI', 'icons'));
    expect(existsSync(join(tempRoot, 'proj'))).toBe(false);
  });

  it('constructor does not throw for an unwritable path', () => {
    expect(() => new IconGenerator('/proc/definitely/not/writable')).not.toThrow();
  });

  it('generateIcon reports a clean error when the project path is unknown', () => {
    const generator = new IconGenerator();
    expect(() => generator.generateIcon({ name: 'x', type: 'simple' })).toThrow(IconStorageError);
    expect(() => generator.generateIcon({ name: 'x', type: 'simple' })).toThrow(/project path unknown.*WINCCOA_PROJ_PATH/);
  });

  it('generateIcon reports a clean error when the directory is not writable', () => {
    // A regular file where a directory is expected cannot be created into.
    const blocker = join(tempRoot, 'proj');
    writeFileSync(blocker, 'not a directory');
    const generator = new IconGenerator(blocker);
    try {
      generator.generateIcon({ name: 'x', type: 'simple' });
      expect.unreachable('generateIcon should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(IconStorageError);
      expect((error as Error).message).toContain('directory not writable');
      expect((error as IconStorageError).iconsPath).toBe(join(blocker, 'data', 'WebUI', 'icons'));
    }
  });

  it('creates the directory lazily and keeps the public URL', () => {
    const proj = join(tempRoot, 'proj');
    const generator = new IconGenerator(proj);
    const url = generator.generateIcon({ name: 'pump', type: 'gauge' });
    expect(url).toBe('/data/WebUI/icons/pump.svg');
    const file = join(proj, 'data', 'WebUI', 'icons', 'pump.svg');
    expect(readFileSync(file, 'utf8')).toContain('<svg');
    expect(generator.listCustomIcons()).toEqual(['/data/WebUI/icons/pump.svg']);
    expect(generator.deleteIcon('pump')).toBe(true);
    expect(generator.listCustomIcons()).toEqual([]);
  });

  it('listCustomIcons returns [] when the directory does not exist yet', () => {
    expect(new IconGenerator(join(tempRoot, 'proj')).listCustomIcons()).toEqual([]);
  });

  it('list and delete report a storage error when the project path is unknown', () => {
    const generator = new IconGenerator();
    expect(() => generator.listCustomIcons()).toThrow(IconStorageError);
    expect(() => generator.deleteIcon('x')).toThrow(IconStorageError);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'reports a read-only icons directory as not writable',
    () => {
      const proj = join(tempRoot, 'proj');
      const icons = join(proj, 'data', 'WebUI', 'icons');
      mkdirSync(icons, { recursive: true });
      chmodSync(icons, 0o555);
      try {
        expect(() => new IconGenerator(proj).generateIcon({ name: 'x', type: 'simple' })).toThrow(
          /directory not writable/
        );
      } finally {
        chmodSync(icons, 0o755);
      }
    }
  );
});

describe('IconList', () => {
  it('loads the shipped IX icon list by default (development checkout: mcpWinCCOA/docs)', () => {
    const list = new IconList();
    expect(list.getTotalCount()).toBeGreaterThan(1000);
    expect(list.getSource()).toMatch(/IX_ICONS_LIST\.txt$/);
  });

  it('loads an explicit list file', () => {
    const file = join(tempRoot, 'IX_ICONS_LIST.txt');
    writeFileSync(file, 'alpha\r\nbeta\n\ngamma\n');
    const list = new IconList(file);
    expect(list.searchIcons('', 10)).toEqual(['alpha', 'beta', 'gamma']);
    expect(list.getSource()).toBe(file);
  });

  it('falls back to the built-in subset when no list file exists', () => {
    const list = new IconList(join(tempRoot, 'missing.txt'));
    const subset = new Set(ICON_CATEGORIES.flatMap(c => c.icons));
    expect(list.getTotalCount()).toBe(subset.size);
    expect(list.getSource()).toBe('built-in subset');
  });
});

describe('icon tools (icons/icon registerTools)', () => {
  type Handler = (args: any) => Promise<{ content: Array<{ text: string }> }>;

  async function register(winccoa: unknown) {
    const { registerTools } = await import('../../../src/tools/icons/icon.js');
    const tools = new Map<string, Handler>();
    const server = { tool: (name: string, _d: string, _s: unknown, handler: Handler) => tools.set(name, handler) };
    registerTools(server, { winccoa } as any);
    return async (name: string, args: any) => JSON.parse((await tools.get(name)!(args)).content[0]!.text);
  }

  const saved = { WINCCOA_PROJ_PATH: process.env.WINCCOA_PROJ_PATH, PVSS_II: process.env.PVSS_II };

  beforeEach(() => {
    delete process.env.WINCCOA_PROJ_PATH;
    delete process.env.PVSS_II;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('writes icons into the project reported by winccoa.getPaths()', async () => {
    const proj = join(tempRoot, 'proj');
    const call = await register({ getPaths: () => [proj, '/opt/WinCC_OA/3.21'] });
    const parsed = await call('create-custom-icon', { name: 'trend1', type: 'trend' });
    expect(parsed.data.iconPath).toBe('/data/WebUI/icons/trend1.svg');
    expect(existsSync(join(proj, 'data', 'WebUI', 'icons', 'trend1.svg'))).toBe(true);
  });

  it('returns a clean error envelope (no stack trace log) when the project path is unknown', async () => {
    vi.resetModules();
    vi.doMock('../../../src/utils/projectPath.js', () => ({
      resolveProjectPathWithSource: () => ({ path: undefined, source: 'none' })
    }));
    try {
      const call = await register({});
      for (const [tool, args] of [
        ['create-custom-icon', { name: 'x', type: 'simple' }],
        ['list-custom-icons', {}],
        ['delete-custom-icon', { name: 'x' }]
      ] as const) {
        const parsed = await call(tool, args);
        expect(parsed.error).toBe(true);
        expect(parsed.errorType).toBe('ICON_STORAGE_UNAVAILABLE');
        expect(parsed.message).toContain('project path unknown');
        expect(parsed.message).toContain('WINCCOA_PROJ_PATH');
      }
      expect(console.error).not.toHaveBeenCalled();
      // The "project path unknown" warning is logged once at registration.
      const call2 = await register({});
      await call2('list-ix-icons', {});
      const warnings = vi.mocked(console.warn).mock.calls.filter(c => String(c[0]).startsWith('Icon tools:'));
      expect(warnings).toHaveLength(1);
    } finally {
      vi.doUnmock('../../../src/utils/projectPath.js');
      vi.resetModules();
    }
  });
});

describe('icon name validation (path traversal)', () => {
  const bad = ['../x', '..', 'a/b', 'a\\b', '.hidden', '', 'a'.repeat(200), '/etc/passwd', 'x.svg/../../y'];

  it.each(bad)('validateIconName rejects %j', name => {
    expect(() => validateIconName(name)).toThrow(InvalidIconNameError);
  });

  it('validateIconName accepts pump_01-ok', () => {
    expect(validateIconName('pump_01-ok')).toBe('pump_01-ok');
  });

  it.each(bad)('generateIcon rejects %j and writes nothing', name => {
    const generator = new IconGenerator(join(tempRoot, 'proj'));
    expect(() => generator.generateIcon({ name, type: 'simple' })).toThrow(InvalidIconNameError);
    expect(existsSync(join(tempRoot, 'proj'))).toBe(false);
  });

  it('generateIcon accepts pump_01-ok', () => {
    const generator = new IconGenerator(join(tempRoot, 'proj'));
    expect(generator.generateIcon({ name: 'pump_01-ok', type: 'simple' })).toBe('/data/WebUI/icons/pump_01-ok.svg');
  });

  it('deleteIcon with a traversal name does not touch a file outside the icons dir', () => {
    const proj = join(tempRoot, 'proj');
    const iconsDir = join(proj, 'data', 'WebUI', 'icons');
    mkdirSync(iconsDir, { recursive: true });
    const outside = join(proj, 'data', 'WebUI', 'victim.svg');
    writeFileSync(outside, 'keep me');
    const generator = new IconGenerator(proj);

    expect(() => generator.deleteIcon('../victim')).toThrow(InvalidIconNameError);
    expect(() => generator.deleteIcon('../victim.svg')).toThrow(InvalidIconNameError);
    expect(existsSync(outside)).toBe(true);
  });

  it('deleteIcon still accepts names with and without .svg', () => {
    const generator = new IconGenerator(join(tempRoot, 'proj'));
    generator.generateIcon({ name: 'a-1', type: 'simple' });
    generator.generateIcon({ name: 'b-2', type: 'simple' });
    expect(generator.deleteIcon('a-1.svg')).toBe(true);
    expect(generator.deleteIcon('b-2')).toBe(true);
  });
});
