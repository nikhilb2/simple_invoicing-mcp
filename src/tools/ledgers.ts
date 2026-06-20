import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

const LedgerCreate = z.object({
  name: z.string().min(1).describe('Ledger name (customer or supplier name) — required'),
  address: z.string().min(1).describe('Full address — required'),
  phone_number: z.string().min(1).describe('Phone number — required'),
  gst: z.string().optional().describe('GSTIN (15-character GST number). Optional'),
  opening_balance: z.number().optional().describe('Opening balance amount. Positive = debit, negative = credit'),
  email: z.string().email().optional().describe('Email address'),
  website: z.string().optional().describe('Website URL'),
  bank_name: z.string().optional().describe('Bank name'),
  branch_name: z.string().optional().describe('Bank branch name'),
  account_name: z.string().optional().describe('Bank account holder name'),
  account_number: z.string().optional().describe('Bank account number'),
  ifsc_code: z.string().optional().describe('Bank IFSC code'),
});

export function registerLedgerTools(server: McpServer) {
  server.tool(
    'list_ledgers',
    'List all ledgers (customers and suppliers).',
    {
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      search: z.string().optional().describe('Search by name, phone, or GSTIN'),
    },
    async ({ page, page_size, search }) => {
      const params: Record<string, string | number> = {};
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (search) params.search = search;
      const { data } = await client.get('/api/ledgers/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_ledger',
    'Get a single ledger by ID.',
    {
      id: z.number().int().positive().describe('Ledger ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/ledgers/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_ledger',
    'Create a new ledger (customer or supplier). Name, address, and phone_number are required.',
    LedgerCreate.shape,
    async (ledgerData) => {
      const { data } = await client.post('/api/ledgers/', ledgerData);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_ledger_statement',
    'Get the full transaction statement for a ledger, with running balance.',
    {
      id: z.number().int().positive().describe('Ledger ID'),
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async ({ id, start_date, end_date }) => {
      const params: Record<string, string> = {};
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      const { data } = await client.get(`/api/ledgers/${id}/statement`, { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_day_book',
    'Get all transactions (invoices and payments) for a date range.',
    {
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async ({ start_date, end_date }) => {
      const params: Record<string, string> = {};
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;
      const { data } = await client.get('/api/ledgers/day-book', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
