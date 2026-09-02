/**
 * Unit tests for the TLS half of src/config/server.config.ts
 *
 * server.config.ts snapshots process.env at
 * module load, so every scenario resets the module registry and re-imports with
 * a different environment.
 *
 * The behaviour being pinned: when TLS is switched on, a missing or unreadable
 * certificate must fail configuration validation with a message that names the
 * offending environment variable. Previously loadSSLConfig() returned null and
 * the caller reported only "certificates could not be loaded".
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TOKEN = 'c'.repeat(64);

// A real readable file is enough: validateConfig only checks readability.
const dir = mkdtempSync(join(tmpdir(), 'mcp-tls-test-'));
const certPath = join(dir, 'cert.pem');
const keyPath = join(dir, 'key.pem');
const caPath = join(dir, 'ca.pem');
writeFileSync(certPath, '-- not a real certificate --');
writeFileSync(keyPath, '-- not a real key --');
writeFileSync(caPath, '-- not a real ca --');

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Load a fresh copy of the config module under a specific environment. */
async function loadConfig(env: Record<string, string | undefined>) {
  for (const key of [
    'MCP_API_TOKEN',
    'MCP_SSL_ENABLED',
    'MCP_SSL_CERT_PATH',
    'MCP_SSL_KEY_PATH',
    'MCP_SSL_CA_PATH',
    'MCP_HTTP_HOST'
  ]) {
    delete process.env[key];
  }
  Object.assign(process.env, env);

  vi.resetModules();
  return import('../../../src/config/server.config.js');
}

beforeEach(() => {
  vi.resetModules();
});

describe('validateConfig - API token', () => {
  it('reports a missing token, and suggests how to generate one', async () => {
    const { validateConfig } = await loadConfig({});
    const errors = validateConfig();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('MCP_API_TOKEN');
    expect(errors[0]).toContain('openssl rand -hex 32');
  });

  it('passes with a token and TLS off', async () => {
    const { validateConfig } = await loadConfig({ MCP_API_TOKEN: TOKEN });
    expect(validateConfig()).toEqual([]);
  });
});

describe('validateConfig - TLS', () => {
  it('defaults to TLS disabled', async () => {
    // Pinning current behaviour deliberately: flipping this default is a
    // breaking change deferred to 2.0.0, deliberately out of scope here.
    const { serverConfig } = await loadConfig({ MCP_API_TOKEN: TOKEN });
    expect(serverConfig.http.ssl.enabled).toBe(false);
  });

  it('is enabled only by the exact string "true"', async () => {
    for (const value of ['false', 'TRUE', '1', 'yes', '']) {
      const { serverConfig } = await loadConfig({
        MCP_API_TOKEN: TOKEN,
        MCP_SSL_ENABLED: value
      });
      expect(serverConfig.http.ssl.enabled, `MCP_SSL_ENABLED=${value}`).toBe(false);
    }
  });

  it('names the missing variable when TLS is on with no cert or key', async () => {
    const { validateConfig } = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true'
    });
    const errors = validateConfig();

    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toContain('MCP_SSL_CERT_PATH');
    expect(errors.join('\n')).toContain('MCP_SSL_KEY_PATH');
    // The message must be actionable, not just a complaint.
    expect(errors.join('\n')).toContain('openssl req');
    expect(errors.join('\n')).toContain('MCP_SSL_ENABLED=false');
  });

  it('reports the path when a cert is configured but unreadable', async () => {
    const { validateConfig } = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true',
      MCP_SSL_CERT_PATH: join(dir, 'does-not-exist.pem'),
      MCP_SSL_KEY_PATH: keyPath
    });
    const errors = validateConfig();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('MCP_SSL_CERT_PATH');
    expect(errors[0]).toContain('does-not-exist.pem');
    expect(errors[0]).toContain('could not be read');
  });

  it('passes when TLS is on and both files are readable', async () => {
    const { validateConfig } = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true',
      MCP_SSL_CERT_PATH: certPath,
      MCP_SSL_KEY_PATH: keyPath
    });
    expect(validateConfig()).toEqual([]);
  });

  it('validates the optional CA path when given', async () => {
    const ok = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true',
      MCP_SSL_CERT_PATH: certPath,
      MCP_SSL_KEY_PATH: keyPath,
      MCP_SSL_CA_PATH: caPath
    });
    expect(ok.validateConfig()).toEqual([]);

    const bad = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true',
      MCP_SSL_CERT_PATH: certPath,
      MCP_SSL_KEY_PATH: keyPath,
      MCP_SSL_CA_PATH: join(dir, 'no-ca.pem')
    });
    const errors = bad.validateConfig();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('MCP_SSL_CA_PATH');
  });

  it('loadSSLConfig returns null when TLS is off, and certs when on', async () => {
    const off = await loadConfig({ MCP_API_TOKEN: TOKEN });
    expect(off.loadSSLConfig()).toBeNull();

    const on = await loadConfig({
      MCP_API_TOKEN: TOKEN,
      MCP_SSL_ENABLED: 'true',
      MCP_SSL_CERT_PATH: certPath,
      MCP_SSL_KEY_PATH: keyPath
    });
    const loaded = on.loadSSLConfig();
    expect(loaded).not.toBeNull();
    expect(loaded!.cert.toString()).toContain('not a real certificate');
    expect(loaded!.ca).toBeUndefined();
  });
});

describe('isLoopbackHost', () => {
  it('recognises loopback addresses', async () => {
    const { isLoopbackHost } = await loadConfig({ MCP_API_TOKEN: TOKEN });

    for (const host of ['localhost', 'LOCALHOST', '127.0.0.1', '127.1.2.3', '::1', '[::1]', ' localhost ']) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
  });

  it('treats exposed binds as non-loopback', async () => {
    const { isLoopbackHost } = await loadConfig({ MCP_API_TOKEN: TOKEN });

    // 0.0.0.0 is the shipped default and is exposed - this is exactly the case
    // the startup [SECURITY WARNING] must fire for.
    for (const host of ['0.0.0.0', '10.2.42.117', '192.168.1.10', '::', 'winccoa.example.com']) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });
});
