import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerInventoryTools(server: McpServer) {
  server.tool(
    'list_inventory',
    'List current stock levels for all products.',
    {
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      search: z.string().optional().describe('Search by product name or SKU'),
      low_stock: z.boolean().optional().describe('Only show items with zero or low stock'),
    },
    async ({ page, page_size, search, low_stock }) => {
      const params: Record<string, string | number | boolean> = {};
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (search) params.search = search;
      if (low_stock !== undefined) params.low_stock = low_stock;
      const { data } = await client.get('/api/inventory/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'adjust_inventory',
    'Manually adjust stock quantity for a product (e.g. for stock-take corrections).',
    {
      product_id: z.number().int().positive().describe('Product ID — required'),
      quantity: z.number().describe('Quantity to add (positive) or remove (negative) from stock — required'),
    },
    async ({ product_id, quantity }) => {
      const { data } = await client.post('/api/inventory/adjust', { product_id, quantity });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
