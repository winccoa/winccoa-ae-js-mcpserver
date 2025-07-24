/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!     */
/*                                                     */
/*******************************************************/


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
let StreamableHTTPServerTransport, express, initializeServer, serverConfig, loadSSLConfig, validateConfig, https, createRequire, require, cors, rateLimit;

try {
  console.log('🔄 Importing StreamableHTTPServerTransport...');
  ({ StreamableHTTPServerTransport } = await import("@modelcontextprotocol/sdk/server/streamableHttp.js"));
  console.log('✅ StreamableHTTPServerTransport imported');
  
  console.log('🔄 Importing express...');
  express = (await import('express')).default;
  console.log('✅ Express imported');
  
  console.log('🔄 Importing server.js...');
  ({ initializeServer } = await import('./server.js'));
  console.log('✅ server.js imported');
  
  console.log('🔄 Importing server.config.js...');
  ({ serverConfig, loadSSLConfig, validateConfig } = await import('./config/server.config.js'));
  console.log('✅ server.config.js imported');
  console.log('🔍 serverConfig.http.auth.token:', serverConfig.http.auth.token ? 'SET' : 'NOT SET');
  
  console.log('🔄 Importing https...');
  https = await import('https');
  console.log('✅ https imported');
  
  ({ createRequire } = await import('module'));
  require = createRequire(import.meta.url);
  cors = require('cors');
  rateLimit = require('express-rate-limit');
  console.log('✅ All modules imported successfully');
} catch (importError) {
  console.error('❌ Error importing modules:', importError);
  process.exit(1);
}

let server;

// ==================== EXPRESS SERVER SETUP ====================

console.log('🔄 Setting up Express server...');
const app = express();
app.use(express.json());
console.log('✅ Express JSON middleware enabled');

// Apply CORS if enabled
if (serverConfig.http.cors.enabled) {
  console.log('🔄 Setting up CORS middleware...');
  app.use(cors({
    origin: serverConfig.http.cors.origins,
    credentials: serverConfig.http.cors.credentials
  }));
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
  console.log('✅ Rate limiting enabled:', serverConfig.security.rateLimit.max, 'requests per', serverConfig.security.rateLimit.windowMs, 'ms');
} else {
  console.log('ℹ️  Rate limiting disabled');
}

// IP filtering middleware
if (serverConfig.security.ipFilter.enabled) {
  console.log('🔄 Setting up IP filtering middleware...');
  app.use((req, res, next) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    console.log('🔍 IP filter check for:', clientIp);
    
    // Check whitelist
    if (serverConfig.security.ipFilter.whitelist.length > 0) {
      if (!serverConfig.security.ipFilter.whitelist.includes(clientIp)) {
        console.log('❌ IP not whitelisted:', clientIp);
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32003,
            message: 'Forbidden: IP not whitelisted',
          },
          id: null,
        });
      }
      console.log('✅ IP whitelisted:', clientIp);
    }
    
    // Check blacklist
    if (serverConfig.security.ipFilter.blacklist.includes(clientIp)) {
      console.log('❌ IP blacklisted:', clientIp);
      return res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32003,
          message: 'Forbidden: IP blacklisted',
        },
        id: null,
      });
    }
    
    next();
  });
  console.log('✅ IP filtering enabled. Whitelist:', serverConfig.security.ipFilter.whitelist, 'Blacklist:', serverConfig.security.ipFilter.blacklist);
} else {
  console.log('ℹ️  IP filtering disabled');
}

// Authentication middleware
function authenticate(req, res, next) {
  console.log('🔍 Authentication check started');
  console.log('🔍 Auth enabled:', serverConfig.http.auth.enabled);
  console.log('🔍 Auth type:', serverConfig.http.auth.type);
  
  if (!serverConfig.http.auth.enabled) {
    console.log('ℹ️  Authentication disabled, skipping');
    return next();
  }
  
  let token;
  
  if (serverConfig.http.auth.type === 'bearer') {
    const authHeader = req.headers['authorization'];
    console.log('🔍 Authorization header:', authHeader ? `${authHeader.substring(0, 20)}...` : 'NOT SET');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
      console.log('🔍 Bearer token extracted:', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
    }
  } else if (serverConfig.http.auth.type === 'api-key') {
    token = req.headers['x-api-key'] || req.query.apiKey;
    console.log('🔍 API key token:', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
  }
  
  // Fallback to body token for backward compatibility
  token = token || req.body?.token;
  console.log('🔍 Final token (after fallback):', token ? `${token.substring(0, 8)}...` : 'NOT FOUND');
  console.log('🔍 Expected token:', serverConfig.http.auth.token ? `${serverConfig.http.auth.token.substring(0, 8)}...` : 'NOT SET');
  
  if (token !== serverConfig.http.auth.token) {
    console.log('❌ Authentication failed: token mismatch');
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing token',
      },
      id: null,
    });
  }
  
  console.log('✅ Authentication successful');
  next();
}

app.post('/mcp', authenticate, async (req, res) => {
  console.log('📨 Received POST MCP request');
  console.log('🔍 Request body size:', JSON.stringify(req.body).length, 'bytes');
  console.log('🔍 Request headers:', Object.keys(req.headers));
  
  try {
    console.log('🔄 Creating StreamableHTTPServerTransport...');
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    
    res.on('close', () => {
      console.log('📪 Request closed');
      transport.close();
      server.close();
    });
    
    console.log('🔄 Connecting server to transport...');
    await server.connect(transport);
    console.log('✅ Server connected to transport');
    
    console.log('🔄 Handling request...');
    await transport.handleRequest(req, res, req.body);
    console.log('✅ Request handled successfully');
    
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    console.error('❌ Error stack:', error.stack);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

app.get('/mcp', async (req, res) => {
  console.log('📨 Received GET MCP request (not allowed)');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

app.delete('/mcp', async (req, res) => {
  console.log('📨 Received DELETE MCP request (not allowed)');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'WinCC OA MCP Server',
    version: '3.0.0',
    timestamp: new Date().toISOString()
  });
});

// Initialize and start the server
async function start() {
  // Validate configuration
  const configErrors = validateConfig();
  if (configErrors.length > 0) {
    console.error('Configuration errors:');
    configErrors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  server = await initializeServer();
  
  const { host, port } = serverConfig.http;
  
  // Create HTTP or HTTPS server
  let httpServer;
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

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
