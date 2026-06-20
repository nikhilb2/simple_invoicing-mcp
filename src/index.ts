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
app.post('/mcp', async (req: Request, res: Response) => {
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
