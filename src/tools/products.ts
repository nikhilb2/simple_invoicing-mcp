import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerProductTools(server: McpServer) {
  server.tool(
    'list_products',
    'List all products',
    {
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of records to return'),
    },
    async ({ skip, limit }) => {
      const params: Record<string, number> = {};
      if (skip !== undefined) params.skip = skip;
      if (limit !== undefined) params.limit = limit;

      const { data } = await client.get('/api/products/', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_product',
    'Get a single product by ID',
    {
      id: z.number().int().positive().describe('Product ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/products/${id}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_product',
    'Create a new product',
    {
      data: z.record(z.any()).describe('Product data object matching the API schema'),
    },
    async ({ data: productData }) => {
      const { data } = await client.post('/api/products/', productData);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
