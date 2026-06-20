import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

const BuyerCreate = z.object({
  name: z.string().min(1).describe('Buyer name — required'),
  address: z.string().min(1).describe('Full address — required'),
  phone_number: z.string().min(1).describe('Phone number — required'),
  gst: z.string().optional().describe('GSTIN (15-character GST number). Optional'),
  email: z.string().email().optional().describe('Email address'),
  website: z.string().optional().describe('Website URL'),
  bank_name: z.string().optional().describe('Bank name'),
  branch_name: z.string().optional().describe('Bank branch name'),
  account_name: z.string().optional().describe('Bank account holder name'),
  account_number: z.string().optional().describe('Bank account number'),
  ifsc_code: z.string().optional().describe('Bank IFSC code'),
});

export function registerBuyerTools(server: McpServer) {
  server.tool(
    'list_buyers',
    'List all buyers.',
    {
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      search: z.string().optional().describe('Search by name or phone'),
    },
    async ({ page, page_size, search }) => {
      const params: Record<string, string | number> = {};
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (search) params.search = search;
      const { data } = await client.get('/api/buyers/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_buyer',
    'Get a single buyer by ID.',
    {
      id: z.number().int().positive().describe('Buyer ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/buyers/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_buyer',
    'Create a new buyer. Name, address, and phone_number are required.',
    BuyerCreate.shape,
    async (buyerData) => {
      const { data } = await client.post('/api/buyers/', buyerData);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
