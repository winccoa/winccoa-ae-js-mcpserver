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
delete process.env.TOOLS;

let app: any;
let secretsMatch: (a: string | undefined, b: string | undefined) => boolean;

beforeAll(async () => {
  const mod = await import('../../../src/index_http.js');
  app = mod.app;
  secretsMatch = mod.secretsMatch;
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
