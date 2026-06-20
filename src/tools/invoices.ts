import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    'list_invoices',
    'List all invoices with optional filtering',
    {
      invoice_type: z
        .enum(['sales', 'purchase'])
        .optional()
        .describe('Filter by invoice type'),
      skip: z.number().int().min(0).optional().default(0).describe('Number of records to skip'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Number of records to return'),
    },
    async ({ invoice_type, skip, limit }) => {
      const params: Record<string, string | number> = {};
      if (invoice_type) params.invoice_type = invoice_type;
      if (skip !== undefined) params.skip = skip;
      if (limit !== undefined) params.limit = limit;

      const { data } = await client.get('/api/invoices/', { params });
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_invoice',
    'Get a single invoice by ID',
    {
      id: z.number().int().positive().describe('Invoice ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/invoices/${id}`);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'create_invoice',
    'Create a new invoice',
    {
      data: z.record(z.any()).describe('Invoice data object matching the API schema'),
    },
    async ({ data: invoiceData }) => {
      const { data } = await client.post('/api/invoices/', invoiceData);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'get_invoice_pdf',
    'Get the PDF for an invoice (returns base64 if available)',
    {
      id: z.number().int().positive().describe('Invoice ID'),
    },
    async ({ id }) => {
      try {
        const { data } = await client.get(`/api/invoices/${id}/pdf`, {
          responseType: 'arraybuffer',
        });
        const base64 = Buffer.from(data).toString('base64');
        return {
          content: [{ type: 'text' as const, text: base64 }],
        };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return {
            content: [{ type: 'text' as const, text: 'PDF not available for this invoice' }],
          };
        }
        throw err;
      }
    }
  );
}
