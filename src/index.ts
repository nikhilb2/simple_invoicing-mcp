import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerInvoiceTools } from './tools/invoices.js';
import { registerProductTools } from './tools/products.js';
import { registerLedgerTools } from './tools/ledgers.js';
import { registerInventoryTools } from './tools/inventory.js';
import { registerBuyerTools } from './tools/buyers.js';
import { registerPaymentTools } from './tools/payments.js';

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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Failed to start MCP server:', err);
  process.exit(1);
});
