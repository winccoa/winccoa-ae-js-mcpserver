/**
 * Unit tests for src/index_http.ts
 *
 * This file previously sat at 0% coverage: it called start() as an import side
 * effect and process.exit() on a config error, so no test could import it. The
 * auto-start is now guarded by an "invoked directly" check, which makes the
 * express app and the auth middleware reachable from here.
 *
 * Covers task 6 / A4 of #231342: timing-safe token comparison, and the promise
 * that no token material reaches the log.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';

// Must be set before importing the module: server.config.ts snapshots
// process.env at module load.
const TOKEN = 'a'.repeat(64);
process.env.MCP_API_TOKEN = TOKEN;
process.env.MCP_MODE = 'http';
// Autostart defaults to ON so the WinCC OA JavaScript Manager can never be left
// without a listener by a path-comparison mismatch. Tests opt out explicitly.
process.env.MCP_DISABLE_AUTOSTART = 'true';
delete process.env.TOOLS;

let app: any;
let secretsMatch: (a: string | undefined, b: string | undefined) => boolean;
let start: () => Promise<void>;

beforeAll(async () => {
  const mod = await import('../../../src/index_http.js');
  app = mod.app;
  secretsMatch = mod.secretsMatch;
  start = mod.start;
});

describe('module import', () => {
  it('exposes the express app without starting a listener', () => {
    // If the auto-start guard regressed, importing would bind a port and the
    // suite would hang or fail on an address conflict.
    expect(typeof app).toBe('function');
    expect(typeof app.listen).toBe('function');
  });
});

describe('secretsMatch', () => {
  it('accepts an exact match', () => {
    expect(secretsMatch(TOKEN, TOKEN)).toBe(true);
  });

  it('rejects a mismatch of equal length', () => {
    expect(secretsMatch('b'.repeat(64), TOKEN)).toBe(false);
  });

  it('rejects a prefix of the real token', () => {
    // The old `!==` comparison also rejected this, but short-circuited on the
    // first differing byte; this asserts the length guard in front of
    // timingSafeEqual, which throws on unequal-length buffers.
    expect(secretsMatch(TOKEN.slice(0, 8), TOKEN)).toBe(false);
  });

  it('rejects a longer string that starts with the real token', () => {
    expect(secretsMatch(TOKEN + 'extra', TOKEN)).toBe(false);
  });

  it('rejects undefined, empty and missing expectations', () => {
    expect(secretsMatch(undefined, TOKEN)).toBe(false);
    expect(secretsMatch('', TOKEN)).toBe(false);
    expect(secretsMatch(TOKEN, undefined)).toBe(false);
    expect(secretsMatch(undefined, undefined)).toBe(false);
  });

  it('handles multi-byte characters without throwing', () => {
    // Buffer.from(..., 'utf8') means byte length, not character length: a naive
    // implementation comparing .length on strings could feed timingSafeEqual
    // two different-sized buffers and throw.
    expect(secretsMatch('tökén', 'tökén')).toBe(true);
    expect(secretsMatch('tökén', 'token')).toBe(false);
  });
});

describe('no token material is logged', () => {
  it('logs neither the presented nor the expected token on failure', async () => {
    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(capture);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(capture);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(capture);

    const { authenticate } = await import('../../../src/index_http.js');

    const req: any = {
      headers: { authorization: 'Bearer wrong-token-value-here' },
      body: {},
      query: {},
      ip: '10.0.0.1'
    };
    const res: any = {
      status: () => res,
      json: () => res
    };

    authenticate(req, res, () => {});

    logSpy.mockRestore();
    warnSpy.mockRestore();
    errSpy.mockRestore();

    const output = lines.join('\n');

    // Neither secret, nor any prefix of either, may appear.
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain(TOKEN.slice(0, 8));
    expect(output).not.toContain('wrong-token-value-here');
    // ...but the rejection itself must be visible to an operator.
    expect(output).toContain('Authentication failed');
  });
});

describe('failure reporting', () => {
  // Regression test. This module used to call process.exit(1) both at import
  // scope (on an import error) and inside start() (on a config error). Under
  // vitest that kills the worker, so the file was reported as failed with all
  // its tests "skipped" and the underlying error never printed - observed once
  // as an unreproducible flake. Failures must propagate as exceptions; only the
  // direct-invocation guard turns them into an exit code.
  it('start() rejects on invalid configuration instead of exiting', async () => {
    const saved = process.env.MCP_API_TOKEN;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      delete process.env.MCP_API_TOKEN;
      vi.resetModules();
      const mod = await import('../../../src/index_http.js');

      // If this exits instead of rejecting, the worker dies and the whole file
      // is reported as failed - which is exactly the bug being pinned.
      await expect(mod.start()).rejects.toThrow(/Invalid configuration/);
    } finally {
      spy.mockRestore();
      if (saved === undefined) delete process.env.MCP_API_TOKEN;
      else process.env.MCP_API_TOKEN = saved;
      vi.resetModules();
    }
  });

  it('has no process.exit outside the autostart guard, and autostart defaults on', async () => {
    // Two structural guards, both for regressions that are near-impossible to
    // diagnose from logs alone:
    //  - a module-scope process.exit kills a vitest worker, so failures show up
    //    as tests silently "skipped"
    //  - an autostart condition that defaults to *off* leaves the WinCC OA
    //    JavaScript Manager with no listener and no error at all
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(
      new URL('../../../src/index_http.ts', import.meta.url),
      'utf8'
    );

    // The guard must be a negated opt-out, never a positive "only if invoked
    // directly" test against argv.
    expect(src).toMatch(/MCP_DISABLE_AUTOSTART !== 'true'/);
    expect(src).not.toMatch(/invokedDirectly/);
    // Strip comments first: this file legitimately *mentions* process.exit() in
    // a comment explaining why it is not used at module scope.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter(line => !line.trim().startsWith('//'))
      .join('\n');

    const occurrences = code.match(/process\.exit\(/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });
});
