/**
 * Unit tests for src/server.ts
 *
 * Covers the split of initializeServer() into a memoised process-wide
 * initContext() plus a per-request createServer(), and the four instruction
 * resources.
 *
 * Background: sharing one McpServer across HTTP requests is the subject of a
 * HIGH advisory against @modelcontextprotocol/sdk ("cross-client data leak via
 * shared server/transport instance reuse") and is the same defect as GitHub
 * issue #33. The WinccoaManager, by contrast, has no close()/dispose() and
 * hands out dpConnect subscriptions, so it must stay a process-wide singleton.
 * These tests pin both halves of that contract.
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { initContext, createServer, getContext } from '../../../src/server.js';
import { managerStats } from '../../fixtures/mock-winccoa-manager.js';

// loadAllTools() reads TOOLS and registers nothing when it is unset, which
// keeps these tests focused on context and resources.
delete process.env.TOOLS;

describe('initContext', () => {
  it('constructs exactly one WinccoaManager however often it is called', async () => {
    const before = managerStats.constructions;

    const a = await initContext();
    const b = await initContext();
    const c = await initContext();

    // One SCADA handle for the process, and the very same object each time.
    expect(managerStats.constructions - before).toBeLessThanOrEqual(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('exposes the field content and active field name', async () => {
    const ctx = await initContext();

    expect(ctx.activeFieldName).toBe('default');
    expect(typeof ctx.fieldContent).toBe('string');
    expect(ctx.fieldContent.length).toBeGreaterThan(0);
    expect(ctx.winccoa).toBeDefined();
  });

  it('getContext() resolves to the same shared context', async () => {
    expect(await getContext()).toBe(await initContext());
  });
});

describe('createServer', () => {
  it('returns a distinct McpServer per call, reusing the one context', async () => {
    const ctx = await initContext();
    const before = managerStats.constructions;

    const first = await createServer(ctx);
    const second = await createServer(ctx);

    // Distinct instances: this is what makes one server per HTTP request safe.
    expect(first).not.toBe(second);
    // ...and building them must not create another SCADA handle.
    expect(managerStats.constructions).toBe(before);

    await first.close();
    await second.close();
  });
});

describe('instruction resources', () => {
  // Regression test. These four were registered as
  //   server.resource("instructions://field", "Field-specific instructions", cb)
  // but the SDK signature is resource(name, uriOrTemplate, cb), so the URI was
  // the human-readable sentence and every read failed with -32602. This test
  // fails against that code.
  let client: Client;

  beforeEach(async () => {
    const ctx = await initContext();
    const server = await createServer(ctx);

    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport)
    ]);
  });

  afterAll(async () => {
    await client?.close();
  });

  it('lists resources under instructions:// URIs', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map(r => r.uri);

    expect(uris).toContain('instructions://field');
    expect(uris).toContain('instructions://combined');

    // Every URI must be a real URI, not a description that was passed in the
    // wrong argument position.
    for (const uri of uris) {
      expect(uri).toMatch(/^instructions:\/\//);
    }
  });

  it('reads instructions://field', async () => {
    const result = await client.readResource({ uri: 'instructions://field' });

    expect(result.contents).toHaveLength(1);
    expect(result.contents[0]!.uri).toBe('instructions://field');
    expect(result.contents[0]!.mimeType).toBe('text/markdown');
    expect(String(result.contents[0]!.text).length).toBeGreaterThan(0);
  });

  it('reads instructions://combined and includes the active field name', async () => {
    const result = await client.readResource({
      uri: 'instructions://combined'
    });
    const text = String(result.contents[0]!.text);

    expect(text).toContain('# Field Instructions (default)');
  });

  it('rejects a URI that was never registered', async () => {
    await expect(
      client.readResource({ uri: 'instructions://does-not-exist' })
    ).rejects.toThrow();
  });
});

describe('concurrent clients (issue #33 / SDK advisory)', () => {
  it('serves two clients at once, each on its own server and transport', async () => {
    const ctx = await initContext();

    // What the HTTP layer now does per request.
    const build = async () => {
      const server = await createServer(ctx);
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const client = new Client({ name: 'test-client', version: '1.0.0' });
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport)
      ]);
      return { server, client };
    };

    const first = await build();
    const second = await build();

    // Both must answer while the other is still open. With a single shared
    // McpServer the second connect() would take over the first's transport,
    // and closing either would tear down the other.
    const [a, b] = await Promise.all([
      first.client.listResources(),
      second.client.listResources()
    ]);

    expect(a.resources.map(r => r.uri)).toContain('instructions://field');
    expect(b.resources.map(r => r.uri)).toContain('instructions://field');

    // Disposing one must leave the other fully functional.
    await first.client.close();
    await first.server.close();

    const stillWorks = await second.client.readResource({
      uri: 'instructions://field'
    });
    expect(String(stillWorks.contents[0]!.text).length).toBeGreaterThan(0);

    await second.client.close();
    await second.server.close();
  });

  it('does not create additional WinccoaManager handles per client', async () => {
    const ctx = await initContext();
    const before = managerStats.constructions;

    const servers = await Promise.all([
      createServer(ctx),
      createServer(ctx),
      createServer(ctx)
    ]);

    expect(managerStats.constructions).toBe(before);
    await Promise.all(servers.map(s => s.close()));
  });
});
