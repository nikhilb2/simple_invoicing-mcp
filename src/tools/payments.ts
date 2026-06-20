import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

const PaymentInvoiceAllocation = z.object({
  invoice_id: z.number().int().positive().describe('Invoice ID to allocate payment against'),
  allocated_amount: z.number().positive().describe('Amount to allocate to this invoice'),
});

const PaymentCreate = z.object({
  ledger_id: z.number().int().positive().optional().describe('Ledger (customer/supplier) ID. Required for receipt/payment'),
  voucher_type: z.enum(['receipt', 'payment', 'opening_balance']).describe(
    'Payment type — required. Use "receipt" for money received, "payment" for money paid out, "opening_balance" for opening entry'
  ),
  amount: z.number().describe('Payment amount — required. Must be > 0 (or non-zero for opening_balance)'),
  account_id: z.number().int().positive().optional().describe('Bank/cash account ID'),
  date: z.string().optional().describe('Payment date (ISO 8601, e.g. 2025-06-20). Defaults to today'),
  mode: z.string().optional().describe('Payment mode (e.g. Cash, Bank Transfer, UPI, Cheque)'),
  reference: z.string().optional().describe('Reference number (e.g. cheque number, UTR)'),
  notes: z.string().optional().describe('Internal notes'),
  invoice_allocations: z.array(PaymentInvoiceAllocation).default([]).describe(
    'Allocate payment across specific invoices. Leave empty to record as unallocated'
  ),
});

export function registerPaymentTools(server: McpServer) {
  server.tool(
    'list_payments',
    'List all payments (receipts and disbursements).',
    {
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      voucher_type: z.enum(['receipt', 'payment', 'opening_balance']).optional().describe('Filter by payment type'),
      ledger_id: z.number().int().positive().optional().describe('Filter by ledger ID'),
    },
    async ({ page, page_size, voucher_type, ledger_id }) => {
      const params: Record<string, string | number> = {};
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (voucher_type) params.voucher_type = voucher_type;
      if (ledger_id) params.ledger_id = ledger_id;
      const { data } = await client.get('/api/payments/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_payment',
    'Get a single payment by ID.',
    {
      id: z.number().int().positive().describe('Payment ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/payments/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_payment',
    'Record a new payment. voucher_type and amount are required. Use "receipt" when customer pays you, "payment" when you pay a supplier. IMPORTANT: ledger_id is a numeric database ID — call list_ledgers first to resolve the ledger by name.',
    PaymentCreate.shape,
    async (paymentData) => {
      const { data } = await client.post('/api/payments/', paymentData);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
