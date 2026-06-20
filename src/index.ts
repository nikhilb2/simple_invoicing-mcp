import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express, { Request, Response } from 'express';
import { registerInvoiceTools } from './tools/invoices.js';
import { registerProductTools } from './tools/products.js';
import { registerLedgerTools } from './tools/ledgers.js';
import { registerInventoryTools } from './tools/inventory.js';
import { registerBuyerTools } from './tools/buyers.js';
import { registerPaymentTools } from './tools/payments.js';

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT || '3000', 10);

function createServer(): McpServer {
  const server = new McpServer({
    name: 'simple-invoicing',
    version: '1.0.0',
  });

  registerInvoiceTools(server);
  registerProductTools(server);
  registerLedgerTools(server);
  registerInventoryTools(server);
  registerBuyerTools(server);
  registerPaymentTools(server);

  return server;
}

// MCP endpoint — stateless: each request creates a fresh server + transport
async function verifyApiKey(key: string): Promise<boolean> {
  try {
    const { default: axios } = await import('axios');
    const baseURL = process.env.INVOICING_BASE_URL;
    await axios.get(`${baseURL}/api/api-keys/verify`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    return true;
  } catch {
    return false;
  }
}

app.post('/mcp', async (req: Request, res: Response) => {
  // Auth: accept api_key query param or Authorization Bearer header
  const queryKey = req.query.api_key as string | undefined;
  const headerKey = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const key = queryKey || headerKey;

  if (!key) {
    res.status(401).json({ error: 'Missing api_key' });
    return;
  }

  const valid = await verifyApiKey(key);
  if (!valid) {
    res.status(401).json({ error: 'Invalid or expired api_key' });
    return;
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
  });

  res.on('close', () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
});
