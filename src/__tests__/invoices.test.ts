import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('invoice tools', () => {
  let mock: MockAdapter;
  const registeredTools: Array<{ name: string; schema: any; handler: Function }> = [];

  const mockServer = {
    tool: (name: string, description: string, schema: any, handler: Function) => {
      registeredTools.push({ name, schema, handler });
    },
  } as unknown as McpServer;

  beforeEach(() => {
    vi.resetModules();
    registeredTools.length = 0;
    mock = new MockAdapter(axios);
    process.env.INVOICING_BASE_URL = 'https://api.example.com';
    process.env.INVOICING_API_TOKEN = 'test-token';
  });

  afterEach(() => {
    mock.restore();
    delete process.env.INVOICING_BASE_URL;
    delete process.env.INVOICING_API_TOKEN;
  });

  it('should register 4 invoice tools', async () => {
    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    expect(registeredTools).toHaveLength(4);
    const names = registeredTools.map((t) => t.name);
    expect(names).toContain('list_invoices');
    expect(names).toContain('get_invoice');
    expect(names).toContain('create_invoice');
    expect(names).toContain('get_invoice_pdf');
  });

  it('list_invoices handler should call GET /api/invoices/ with params', async () => {
    mock.onGet('/api/invoices/').reply(200, [{ id: 1 }]);

    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    const listTool = registeredTools.find((t) => t.name === 'list_invoices')!;
    const result = await listTool.handler({ invoice_type: 'sales', skip: 0, limit: 10 });

    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 1 }]);
  });

  it('get_invoice handler should call GET /api/invoices/:id', async () => {
    mock.onGet('/api/invoices/42').reply(200, { id: 42, number: 'INV-042' });

    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    const getTool = registeredTools.find((t) => t.name === 'get_invoice')!;
    const result = await getTool.handler({ id: 42 });

    expect(JSON.parse(result.content[0].text)).toEqual({ id: 42, number: 'INV-042' });
  });

  it('create_invoice handler should POST to /api/invoices/', async () => {
    mock.onPost('/api/invoices/').reply((config) => {
      const body = JSON.parse(config.data);
      expect(body).toEqual({ number: 'INV-001', total: 100 });
      return [201, { id: 1, number: 'INV-001', total: 100 }];
    });

    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    const createTool = registeredTools.find((t) => t.name === 'create_invoice')!;
    const result = await createTool.handler({ data: { number: 'INV-001', total: 100 } });

    expect(JSON.parse(result.content[0].text)).toEqual({ id: 1, number: 'INV-001', total: 100 });
  });

  it('get_invoice_pdf should return base64 when PDF is available', async () => {
    const pdfBuffer = Buffer.from('%PDF-fake');
    mock.onGet('/api/invoices/42/pdf').reply(200, pdfBuffer, {
      'Content-Type': 'application/pdf',
    });

    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    const pdfTool = registeredTools.find((t) => t.name === 'get_invoice_pdf')!;
    const result = await pdfTool.handler({ id: 42 });

    expect(result.content[0].text).toBe(pdfBuffer.toString('base64'));
  });

  it('get_invoice_pdf should return message when PDF not available (404)', async () => {
    mock.onGet('/api/invoices/42/pdf').reply(404);

    const { registerInvoiceTools } = await import('../tools/invoices');
    registerInvoiceTools(mockServer);
    const pdfTool = registeredTools.find((t) => t.name === 'get_invoice_pdf')!;
    const result = await pdfTool.handler({ id: 42 });

    expect(result.content[0].text).toBe('PDF not available for this invoice');
  });
});
