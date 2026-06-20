import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { client } from '../client.js';

const ProductCreate = z.object({
  sku: z.string().min(1).describe('Unique product SKU / code — required'),
  name: z.string().min(1).describe('Product name — required'),
  description: z.string().optional().describe('Product description'),
  hsn_sac: z.string().optional().describe('HSN or SAC code for GST'),
  price: z.number().nonnegative().describe('Selling price per unit — required'),
  gst_rate: z.number().nonnegative().default(0).describe('GST rate in % (e.g. 18 for 18%). Defaults to 0'),
  unit: z.string().default('Pieces').describe('Unit of measure (e.g. Pieces, Kg, Ltrs). Defaults to Pieces'),
  allow_decimal: z.boolean().default(false).describe('Allow fractional quantities'),
  maintain_inventory: z.boolean().default(true).describe('Track stock for this product'),
  is_producable: z.boolean().default(false).describe('Can be manufactured via BOM'),
  production_cost: z.number().nonnegative().optional().describe('Manufacturing cost per unit'),
  initial_quantity: z.number().default(0).describe('Opening stock quantity'),
});

export function registerProductTools(server: McpServer) {
  server.tool(
    'list_products',
    'List all products with optional pagination.',
    {
      page: z.number().int().min(1).optional().default(1).describe('Page number'),
      page_size: z.number().int().min(1).max(100).optional().default(20).describe('Results per page'),
      search: z.string().optional().describe('Search by name or SKU'),
    },
    async ({ page, page_size, search }) => {
      const params: Record<string, string | number> = {};
      if (page !== undefined) params.page = page;
      if (page_size !== undefined) params.page_size = page_size;
      if (search) params.search = search;
      const { data } = await client.get('/api/products/', { params });
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'get_product',
    'Get a single product by ID.',
    {
      id: z.number().int().positive().describe('Product ID'),
    },
    async ({ id }) => {
      const { data } = await client.get(`/api/products/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    'create_product',
    'Create a new product. sku, name, and price are required.',
    ProductCreate.shape,
    async (productData) => {
      const { data } = await client.post('/api/products/', productData);
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
