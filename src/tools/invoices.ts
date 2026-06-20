import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

const InvoiceItemCreate = z.object({
  product_id: z.number().int().positive().describe('Product ID'),
  quantity: z.number().positive().describe('Quantity'),
  unit_price: z.number().nonnegative().optional().describe('Override unit price (uses product price if omitted)'),
  description: z.string().optional().describe('Line item description override'),
  discount_type: z.enum(['percentage', 'net']).optional().describe('Discount type for this line'),
  discount_value: z.number().nonnegative().optional().describe('Discount value (% or fixed amount)'),
});

const InvoiceCreate = z.object({
  ledger_id: z.number().int().positive().describe('Ledger (customer/supplier) ID — required'),
  voucher_type: z.enum(['sales', 'purchase']).default('sales').describe('Invoice type'),
  invoice_date: z.string().optional().describe('Invoice date (YYYY-MM-DD). Defaults to today'),
  due_date: z.string().optional().describe('Payment due date (YYYY-MM-DD)'),
  supplier_invoice_number: z.string().optional().describe('Supplier\'s own invoice number (for purchase invoices)'),
  reference_notes: z.string().optional().describe('Internal reference notes'),
  tax_inclusive: z.boolean().default(false).describe('Whether item prices already include GST'),
  apply_round_off: z.boolean().default(false).describe('Round off the final total'),
  discount_type: z.enum(['percentage', 'net']).optional().describe('Invoice-level discount type'),
  discount_value: z.number().nonnegative().optional().describe('Invoice-level discount value'),
  shipping_address_same_as_billing: z.boolean().default(true).describe('Use billing address as shipping address'),
  shipping_address_id: z.number().int().positive().optional().describe('Existing shipping address ID'),
  items: z.array(InvoiceItemCreate).min(1).describe('Line items — at least one required'),
});

export function registerInvoiceTools(server: McpServer) {
  server.tool(
    'list_invoices',
    'List invoices with optional filters. Returns paginated results.',
    {
      invoice_type: z.enum(['sales', 'purchase']).optional().describe('Filter by invoice type'),
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      search: z.string().optional().describe('Search by invoice number, ledger name'),
      payment_status: z.enum(['unpaid', 'partial', 'paid']).optional().describe('Filter by payment status'),
    },
    async ({ invoice_type, page, page_size, search, payment_status }) => {
      const params: Record<string, string | number> = {};
      if (invoice_type) params.invoice_type = invoice_type;
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (search) params.search = search;
      if (payment_status) params.payment_status = payment_status;
      const { data } = await client.get('/api/invoices/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_invoice',
    'Get a single invoice by ID, including all line items and payment status.',
    {
      id: z.number().int().positive().describe('Invoice ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/invoices/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_invoice',
    'Create a new sales or purchase invoice. Requires a ledger_id and at least one item with a product_id.',
    InvoiceCreate.shape,
    async (invoiceData) => {
      const { data } = await client.post('/api/invoices/', invoiceData);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_invoice_pdf',
    'Get the PDF for an invoice as a base64-encoded string.',
    {
      id: z.number().int().positive().describe('Invoice ID'),
    },
    async ({ id }) => {
      try {
        const { data } = await client.get(`/api/invoices/${id}/pdf`, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(data).toString('base64');
        return { content: [{ type: 'text' as const, text: base64 }] };
      } catch (err: any) {
        if (err.response?.status === 404) {
          return { content: [{ type: 'text' as const, text: 'PDF not available for this invoice' }] };
        }
        throw err;
      }
    }
  );
}
