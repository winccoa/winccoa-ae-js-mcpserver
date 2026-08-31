#!/usr/bin/env node
/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!     */
/*                                                     */
/*******************************************************/

import type { Request, Response, NextFunction } from 'express';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerContext } from './types/index.js';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as log from './utils/logger.js';

// Try to load dotenv if available BEFORE importing config
try {
  const dotenv = await import('dotenv');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const fs = await import('fs');

  // Get the directory of the current script
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Check if .env file exists
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    // Load .env from the script directory
    const result = dotenv.config({ path: envPath });
    console.log(`✓ .env file found and loaded from: ${envPath}`);

    // Debug: Check if dotenv actually loaded the variables
    if (result.error) {
      console.log(`✗ Error loading .env file: ${result.error}`);
    } else {
      console.log(`✓ dotenv.config() successful`);
      console.log(`✓ MCP_API_TOKEN after loading: ${process.env.MCP_API_TOKEN ? 'SET' : 'NOT SET'}`);
      if (process.env.MCP_API_TOKEN) {
        console.log(`✓ MCP_API_TOKEN ${log.describeSecret(process.env.MCP_API_TOKEN)}`);
      }
    }
  } else {
    console.log(`✗ .env file not found at: ${envPath}`);
  }
} catch (error) {
  // dotenv not available, continue without it
  console.log('dotenv not available, using environment variables directly');
}

// Import modules dynamically after dotenv is loaded
console.log('🔄 Starting module imports...');

let StreamableHTTPServerTransport: any;
let express: any;
let initContext: () => Promise<ServerContext>;
let createServer: (context: ServerContext) => Promise<McpServer>;
let serverConfig: any;
let loadSSLConfig: () => any;
let validateConfig: () => string[];
let isLoopbackHost: (host: string) => boolean;
let https: any;
let cors: any;
let rateLimit: any;

try {
  console.log('🔄 Importing StreamableHTTPServerTransport...');
  ({ StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js"));
  console.log('✅ StreamableHTTPServerTransport imported');

  console.log('🔄 Importing express...');
  express = (await import('express')).default;
  console.log('✅ Express imported');

  console.log('🔄 Importing server.js...');
  ({ initContext, createServer } = await import('./server.js'));
  console.log('✅ server.js imported');

  console.log('🔄 Importing server.config.js...');
  ({ serverConfig, loadSSLConfig, validateConfig, isLoopbackHost } = await import('./config/server.config.js'));
  console.log('✅ server.config.js imported');
  log.debug('🔍 serverConfig.http.auth.token:', serverConfig.http.auth.token ? 'SET' : 'NOT SET');

  console.log('🔄 Importing https...');
  https = await import('https');
  console.log('✅ https imported');

  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  cors = require('cors');
  rateLimit = require('express-rate-limit');
  console.log('✅ All modules imported successfully');
} catch (importError) {
  console.error('❌ Error importing modules:', importError);
  // Throw rather than process.exit(): this runs at module scope, and exiting
  // here takes down any host that merely imports the module - including a test
  // worker, where it surfaces as an unexplained failure with no error shown.
  // The direct-invocation guard at the bottom of this file turns it into an
  // exit code for the real entry point.
  throw importError;
}

// Process-wide context (one WinccoaManager). The McpServer is NOT shared:
// each request builds its own, see the /mcp handler below.
let context: ServerContext;

// ==================== EXPRESS SERVER SETUP ====================

console.log('🔄 Setting up Express server...');
const app = express();
app.use(express.json());
console.log('✅ Express JSON middleware enabled');

// Apply CORS if enabled
if (serverConfig.http.cors.enabled) {
  console.log('🔄 Setting up CORS middleware...');
  app.use(
    cors({
      origin: serverConfig.http.cors.origins,
      credentials: serverConfig.http.cors.credentials
    })
  );
  console.log('✅ CORS middleware enabled for origins:', serverConfig.http.cors.origins);
} else {
  console.log('ℹ️  CORS disabled');
}

// Apply rate limiting if enabled
if (serverConfig.security.rateLimit.enabled) {
  console.log('🔄 Setting up rate limiting middleware...');
  const limiter = rateLimit({
    windowMs: serverConfig.security.rateLimit.windowMs,
    max: serverConfig.security.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.'
  });
  app.use('/mcp', limiter);
  console.log(
    '✅ Rate limiting enabled:',
    serverConfig.security.rateLimit.max,
    'requests per',
    serverConfig.security.rateLimit.windowMs,
    'ms'
  );
} else {
  console.log('ℹ️  Rate limiting disabled');
}

// IP filtering middleware
if (serverConfig.security.ipFilter.enabled) {
  console.log('🔄 Setting up IP filtering middleware...');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || (req.connection as any).remoteAddress;
    log.debug('🔍 IP filter check for:', clientIp);

    // Check whitelist
    if (serverConfig.security.ipFilter.whitelist.length > 0) {
      if (!serverConfig.security.ipFilter.whitelist.includes(clientIp)) {
        console.log('❌ IP not whitelisted:', clientIp);
        res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Forbidden: IP not whitelisted'
          },
          id: null
        });
        return;
      }
      console.log('✅ IP whitelisted:', clientIp);
    }

    // Check blacklist
    if (serverConfig.security.ipFilter.blacklist.includes(clientIp)) {
      console.log('❌ IP blacklisted:', clientIp);
      res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32003,
          message: 'Forbidden: IP blacklisted'
        },
        id: null
      });
      return;
    }

    next();
  });
  console.log(
    '✅ IP filtering enabled. Whitelist:',
    serverConfig.security.ipFilter.whitelist,
    'Blacklist:',
    serverConfig.security.ipFilter.blacklist
  );
} else {
  console.log('ℹ️  IP filtering disabled');
}

// Authentication middleware
/**
 * Compare two secrets without leaking their contents through timing.
 *
 * `!==` on strings short-circuits at the first differing byte, which lets a
 * caller recover the expected token one character at a time. timingSafeEqual
 * requires equal-length buffers, so length is compared separately - length is
 * not secret in the way the value is.
 */
function secretsMatch(presented: string | undefined, expected: string | undefined): boolean {
  if (!presented || !expected) return false;

  const a = Buffer.from(presented, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!serverConfig.http.auth.enabled) {
    log.debug('ℹ️  Authentication disabled, skipping');
    return next();
  }

  let token: string | undefined;

  if (serverConfig.http.auth.type === 'bearer') {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice('Bearer '.length);
    }
  } else if (serverConfig.http.auth.type === 'api-key') {
    token = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
  }

  // Fallback to a token in the body, for backward compatibility.
  token = token || (req.body as any)?.token;

  // Deliberately no token material in the log - not even a prefix, and not the
  // expected value. Only whether one was presented at all.
  if (!secretsMatch(token, serverConfig.http.auth.token)) {
    log.warn(
      `❌ Authentication failed from ${req.ip ?? 'unknown'}: ` +
        (token ? 'token mismatch' : 'no token presented')
    );
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing token'
      },
      id: null
    });
    return;
  }

  log.debug('✅ Authentication successful');
  next();
}

app.post('/mcp', authenticate, async (req: Request, res: Response) => {
  console.log('📨 Received POST MCP request');
  log.debug('🔍 Request body size:', JSON.stringify(req.body).length, 'bytes');
  // Header *names* only, and only at debug level - values can carry credentials.
  log.debug('🔍 Request headers:', Object.keys(req.headers));

  try {
    // A fresh McpServer per request. Sharing one instance across requests is the
    // subject of a HIGH advisory against @modelcontextprotocol/sdk
    // ("cross-client data leak via shared server/transport instance reuse") and
    // is the same defect as GitHub issue #33: Protocol.close() closes whichever
    // transport is currently attached, so one request's res.on('close') - which
    // also fires on a plain client abort - would tear down another request's
    // transport mid-flight.
    const server = await createServer(context);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined
    });

    // Guarded so a close/abort/error cannot dispose the pair twice.
    let disposed = false;
    const dispose = (): void => {
      if (disposed) return;
      disposed = true;
      void Promise.resolve(transport.close()).catch(() => {});
      void Promise.resolve(server.close()).catch(() => {});
    };

    res.on('close', () => {
      console.log('📪 Request closed');
      dispose();
    });

    console.log('🔄 Connecting server to transport...');
    await server.connect(transport);
    console.log('✅ Server connected to transport');

    console.log('🔄 Handling request...');
    await transport.handleRequest(req, res, req.body);
    console.log('✅ Request handled successfully');
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    if (error instanceof Error) {
      console.error('❌ Error stack:', error.stack);
    }
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error'
        },
        id: null
      });
    }
  }
});

app.get('/mcp', async (req: Request, res: Response) => {
  console.log('📨 Received GET MCP request (not allowed)');
  res
    .writeHead(405)
    .end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed.'
        },
        id: null
      })
    );
});

app.delete('/mcp', async (req: Request, res: Response) => {
  console.log('📨 Received DELETE MCP request (not allowed)');
  res
    .writeHead(405)
    .end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Method not allowed.'
        },
        id: null
      })
    );
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'WinCC OA MCP Server',
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
});

// Initialize and start the server
async function start(): Promise<void> {
  // Validate configuration
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.error('Configuration errors:');
    configErrors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Invalid configuration:\n  - ${configErrors.join('\n  - ')}`);
  }

  // Build the SCADA handle and instruction content once, up front, so a
  // misconfiguration fails at boot rather than on the first request.
  context = await initContext();

  const { host, port } = serverConfig.http;

  // Create HTTP or HTTPS server
  let httpServer: any;
  if (serverConfig.http.ssl.enabled) {
    const sslConfig = loadSSLConfig();
    if (!sslConfig) {
      // validateConfig() above already reports which variable or path is at
      // fault, so reaching here means the files changed underneath us.
      throw new Error('SSL is enabled but certificates could not be loaded');
    }
    httpServer = https.createServer(sslConfig, app);
  } else {
    httpServer = app;
  }

  httpServer.listen(port, host, () => {
    const protocol = serverConfig.http.ssl.enabled ? 'https' : 'http';
    console.log(`MCP Extended WinCC OA Server with CNS/UNS`);
    console.log(`Server listening on ${protocol}://${host}:${port}`);
    console.log(`Health check: ${protocol}://${host}:${port}/health`);

    // Task 6 of #231342. Without TLS the bearer token is the only thing
    // protecting the server, and it crosses the network in clear text on every
    // request. On a loopback bind that traffic cannot leave the machine, so the
    // warning is limited to binds that are actually exposed.
    if (!serverConfig.http.ssl.enabled && !isLoopbackHost(host)) {
      console.warn('');
      console.warn('  ========================================================================');
      console.warn('  [SECURITY WARNING]  Unencrypted HTTP on a non-loopback address');
      console.warn('');
      console.warn(`  Bound to ${host}:${port} without TLS. The API token and every request`);
      console.warn('  and response travel the network in clear text and can be captured or');
      console.warn('  replayed by anyone who can observe the traffic.');
      console.warn('');
      console.warn('  Enable TLS:   MCP_SSL_ENABLED=true');
      console.warn('                MCP_SSL_CERT_PATH=/path/to/cert.pem');
      console.warn('                MCP_SSL_KEY_PATH=/path/to/key.pem');
      console.warn('');
      console.warn('  Or bind to loopback only:  MCP_HTTP_HOST=127.0.0.1');
      console.warn('  See docs/CONFIGURATION.md for the full TLS options.');
      console.warn('  ========================================================================');
      console.warn('');
    }

    if (serverConfig.http.auth.enabled) {
      console.log(`Authentication: ${serverConfig.http.auth.type}`);
      if (serverConfig.http.auth.token) {
        console.log(`API Token: ${log.describeSecret(serverConfig.http.auth.token)}`);
      }
    } else {
      console.log('⚠️  WARNING: Authentication is disabled!');
    }

    if (serverConfig.http.cors.enabled) {
      console.log('CORS enabled for:', serverConfig.http.cors.origins);
    }
  });
}

// Exported for tests. Importing this module must not start a listener, so the
// auto-start below is guarded: without it, index_http.ts could only ever be
// exercised by launching a real server, which is why it sat at 0% coverage.
export { app, start, authenticate, secretsMatch };

const invokedDirectly =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  start().catch((error: Error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
