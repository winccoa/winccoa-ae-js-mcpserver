/*******************************************************/
/*                                                     */
/*   This file was initially creates by Martin Kumhera */
/*   and extended by AI with CNS (UNS) functions!      */
/*                                                     */
/*******************************************************/
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from 'express';
import fs from 'fs';
import https from 'https';
import State from "./tools/stateManager.js";
import { init_tools } from './tools/tool_oa.js';
import { WinccoaManager } from 'winccoa-manager'; 

const winccoa = new WinccoaManager();
const instance = await new State().init(winccoa);

const options = {
  key: fs.readFileSync(instance.getState().keyPath), 
  cert: fs.readFileSync(instance.getState().certPath)
};

const server = init_tools(winccoa);
const app = express();
console.log(instance.getState().mainInstructions);
console.log(instance.getState().specificInstructions);
app.use(express.json());

app.post('/mcp', async (req, res) => {
  const token = req.headers['authorization'];
  if (token !== instance.getState().token) {
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

const PORT = 3000;
https.createServer(options, app).listen(PORT, () => {
  console.log(`HTTPS server running on port ${PORT}`);
});