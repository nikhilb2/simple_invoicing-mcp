import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import axios from 'axios';
import { registerOpenAPITools } from './openapi-tools.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3000', 10);

// Server factory — built once per process startup (shared, stateless)
let serverReady: Promise<McpServer> | null = null;

function getServer(): Promise<McpServer> {
  if (!serverReady) {
    serverReady = (async () => {
      const server = new McpServer({ name: 'simple-invoicing', version: '1.0.0' });
      await registerOpenAPITools(server);
      return server;
    })();
  }
  return serverReady;
}

// --- Auth ------------------------------------------------------------------

async function verifyApiKey(key: string): Promise<boolean> {
  try {
    const baseURL = process.env.INVOICING_BASE_URL;
    await axios.get(`${baseURL}/api/api-keys/verify`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return true;
  } catch {
    return false;
  }
}

// --- MCP endpoint ----------------------------------------------------------

app.post('/mcp', async (req: Request, res: Response) => {
  // Log every incoming call for debugging
  const body = req.body;
  if (body?.method === 'tools/call') {
    console.log(`[MCP CALL] tool=${body?.params?.name} args=${JSON.stringify(body?.params?.arguments)}`);
  } else if (body?.method) {
    console.log(`[MCP] method=${body.method}`);
  }
  const queryKey = req.query.api_key as string | undefined;
  const headerKey = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const key = queryKey || headerKey;

  if (!key) { res.status(401).json({ error: 'Missing api_key' }); return; }

  const valid = await verifyApiKey(key);
  if (!valid) { res.status(401).json({ error: 'Invalid or expired api_key' }); return; }

  const server = await getServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// --- Health ----------------------------------------------------------------

app.get('/health', async (_req: Request, res: Response) => {
  try {
    await getServer(); // ensure spec loaded
    res.json({ status: 'ok' });
  } catch (err: unknown) {
    res.status(503).json({ status: 'error', detail: String(err) });
  }
});

// --- Start -----------------------------------------------------------------

app.listen(PORT, async () => {
  console.log(`MCP server listening on port ${PORT}`);
  // Eagerly load spec so first request is fast
  try {
    await getServer();
  } catch (err) {
    console.error('Failed to load OpenAPI spec on startup:', err);
  }
});
