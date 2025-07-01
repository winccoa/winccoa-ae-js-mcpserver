/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!     */
/*                                                     */
/*******************************************************/


import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from 'express';
import { init_tools } from './tool_oa.js';

/* Random token generation*/
import crypto from 'crypto';

const API_TOKEN = '1a89f5420cc0f92318b29552198592e4'; //crypto.randomBytes(16).toString('hex');

const server = init_tools();

// ==================== EXPRESS SERVER SETUP ====================

const app = express();
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const token = req.headers['authorization'] || req.body?.token;
  console.log(token);
  if (token !== API_TOKEN) {
    return res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Unauthorized: Invalid or missing token',
      },
      id: null,
    });
  }
  console.log('Received POST MCP request');
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on('close', () => {
      console.log('Request closed');
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
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
  console.log('Received GET MCP request');
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
  console.log('Received DELETE MCP request');
  res.writeHead(405).end(JSON.stringify({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed."
    },
    id: null
  }));
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`MCP Extended WinCC OA Server with CNS/UNS listening on port ${PORT}`);
});
