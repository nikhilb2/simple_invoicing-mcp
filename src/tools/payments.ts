import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerPaymentTools(server: McpServer) {
  server.tool(
    'list_payments',
    'List all payments',
    {
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of records to return'),
    },
    async ({ skip, limit }) => {
      const params: Record<string, number> = {};
      if (skip !== undefined) params.skip = skip;
      if (limit !== undefined) params.limit = limit;

      const { data } = await client.get('/api/payments/', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_payment',
    'Create a new payment',
    {
      data: z.record(z.any()).describe('Payment data object matching the API schema'),
    },
    async ({ data: paymentData }) => {
      const { data } = await client.post('/api/payments/', paymentData);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
