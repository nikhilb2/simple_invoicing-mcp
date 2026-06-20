import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerLedgerTools(server: McpServer) {
  server.tool(
    'list_ledgers',
    'List all ledgers',
    {
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of records to return'),
    },
    async ({ skip, limit }) => {
      const params: Record<string, number> = {};
      if (skip !== undefined) params.skip = skip;
      if (limit !== undefined) params.limit = limit;

      const { data } = await client.get('/api/ledgers/', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_ledger_statement',
    'Get the statement for a ledger with optional date range',
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
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_day_book',
    'Get the day book entries with optional date range',
    {
      start_date: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async ({ start_date, end_date }) => {
      const params: Record<string, string> = {};
      if (start_date) params.start_date = start_date;
      if (end_date) params.end_date = end_date;

      const { data } = await client.get('/api/ledgers/day-book', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
