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
        console.log(`✓ MCP_API_TOKEN value: ${process.env.MCP_API_TOKEN.substring(0, 8)}...`);
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
  ({ serverConfig, loadSSLConfig, validateConfig } = await import('./config/server.config.js'));
  console.log('✅ server.config.js imported');
  console.log('🔍 serverConfig.http.auth.token:', serverConfig.http.auth.token ? 'SET' : 'NOT SET');

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
  process.exit(1);
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
    console.log('🔍 IP filter check for:', clientIp);

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
function authenticate(req: Request, res: Response, next: NextFunction): void {
  console.log('🔍 Authentication check started');
  console.log('🔍 Auth enabled:', serverConfig.http.auth.enabled);
  console.log('🔍 Auth type:', serverConfig.http.auth.type);

  if (!serverConfig.http.auth.enabled) {
    console.log('ℹ️  Authentication disabled, skipping');
    return next();
  }

  let token: string | undefined;

  if (serverConfig.http.auth.type === 'bearer') {
    const authHeader = req.headers['authorization'];
    console.log('🔍 Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'NOT SET');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
      console.log('🔍 Bearer token extracted:', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
    }
  } else if (serverConfig.http.auth.type === 'api-key') {
    token = (req.headers['x-api-key'] as string) || (req.query.apiKey as string);
    console.log('🔍 API key token:', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
  }

  // Fallback to body token for backward compatibility
  token = token || (req.body as any)?.token;
  console.log('🔍 Final token (after fallback):', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
  console.log(
    '🔍 Expected token:',
    serverConfig.http.auth.token ? `${serverConfig.http.auth.token.substring(0, 8)}...` : 'NOT SET'
  );

  if (token !== serverConfig.http.auth.token) {
    console.log('❌ Authentication failed: token mismatch');
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

  console.log('✅ Authentication successful');
  next();
}

app.post('/mcp', authenticate, async (req: Request, res: Response) => {
  console.log('📨 Received POST MCP request');
  console.log('🔍 Request body size:', JSON.stringify(req.body).length, 'bytes');
  console.log('🔍 Request headers:', Object.keys(req.headers));

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
    process.exit(1);
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
      console.error('SSL is enabled but certificates could not be loaded');
      process.exit(1);
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

    if (serverConfig.http.auth.enabled) {
      console.log(`Authentication: ${serverConfig.http.auth.type}`);
      if (serverConfig.http.auth.token) {
        console.log(`API Token: ${serverConfig.http.auth.token.substring(0, 8)}... (first 8 chars shown)`);
      }
    } else {
      console.log('⚠️  WARNING: Authentication is disabled!');
    }

    if (serverConfig.http.cors.enabled) {
      console.log('CORS enabled for:', serverConfig.http.cors.origins);
    }
  });
}

start().catch((error: Error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
