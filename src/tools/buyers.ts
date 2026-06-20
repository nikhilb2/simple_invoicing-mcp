import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerBuyerTools(server: McpServer) {
  server.tool(
    'list_buyers',
    'List all buyers',
    {
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of records to return'),
    },
    async ({ skip, limit }) => {
      const params: Record<string, number> = {};
      if (skip !== undefined) params.skip = skip;
      if (limit !== undefined) params.limit = limit;

      const { data } = await client.get('/api/buyers/', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_buyer',
    'Get a single buyer by ID',
    {
      id: z.number().int().positive().describe('Buyer ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/buyers/${id}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
