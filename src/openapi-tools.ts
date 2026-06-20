import axios from 'axios';
import { z, ZodTypeAny } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// --- Types -----------------------------------------------------------------

interface OpenAPISpec {
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: { schemas?: Record<string, OpenAPISchema> };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: OpenAPISchema }>;
  };
  responses?: Record<string, unknown>;
}

interface OpenAPIParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required?: boolean;
  schema?: OpenAPISchema;
  description?: string;
}

interface OpenAPISchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  enum?: unknown[];
  anyOf?: OpenAPISchema[];
  allOf?: OpenAPISchema[];
  oneOf?: OpenAPISchema[];
  $ref?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  nullable?: boolean;
}

// --- Paths to expose as MCP tools ------------------------------------------
// Only expose meaningful, non-admin, non-auth, non-binary paths.
// Format: 'METHOD /path'
const ALLOWED_PATHS = new Set([
  'GET /api/invoices/',
  'POST /api/invoices/',
  'GET /api/invoices/{invoice_id}',
  'PUT /api/invoices/{invoice_id}',
  'DELETE /api/invoices/{invoice_id}',
  'POST /api/invoices/{invoice_id}/restore',
  'GET /api/invoices/dues',
  'GET /api/products/',
  'POST /api/products/',
  'PUT /api/products/{product_id}',
  'GET /api/ledgers/',
  'POST /api/ledgers/',
  'GET /api/ledgers/{ledger_id}',
  'PUT /api/ledgers/{ledger_id}',
  'GET /api/ledgers/{ledger_id}/statement',
  'GET /api/ledgers/{ledger_id}/unpaid-invoices',
  'GET /api/ledgers/day-book',
  'GET /api/payments/',
  'POST /api/payments/',
  'GET /api/payments/{payment_id}',
  'PUT /api/payments/{payment_id}',
  'DELETE /api/payments/{payment_id}',
  'GET /api/inventory/',
  'POST /api/inventory/adjust',
  'GET /api/company/',
  'GET /api/financial-years/',
  'GET /api/credit-notes/',
  'POST /api/credit-notes/',
  'GET /api/credit-notes/{cn_id}',
  'POST /api/credit-notes/{cn_id}/cancel',
]);

// Extra guidance injected into tool descriptions for LLM orientation
const EXTRA_HINTS: Record<string, string> = {
  'GET /api/ledgers/':
    'Use the search param to find a ledger by customer/supplier name. Returns id, name, address, gst, phone. Use the id in create_invoice (ledger_id) or create_payment (ledger_id).',
  'GET /api/products/':
    'Use the search param to find a product by name or SKU. Returns id, name, price, gst_rate. Use the id in create_invoice items[].product_id.',
  'POST /api/invoices/':
    'IMPORTANT: Pass fields FLAT at the top level — do NOT wrap in a "data" key or any other wrapper. Required: ledger_id (integer, from list_ledgers), items (array, min 1 element). Each item requires product_id (integer, from list_products) and quantity (number). To override price use unit_price (NOT "rate"). Invoice type field is voucher_type (NOT "invoice_type"), values: "sales" or "purchase". ALWAYS call list_ledgers and list_products first to get numeric IDs.',
  'PUT /api/invoices/{invoice_id}':
    'IMPORTANT: Pass fields FLAT — no wrapper. Replaces all items — include ALL line items, not just changes. Get the invoice first with get_invoice to retrieve existing items.',
  'POST /api/payments/':
    'IMPORTANT: Pass fields FLAT — no wrapper. ledger_id is a numeric DB ID. Call list_ledgers (search by name) first to resolve. Use voucher_type="receipt" when customer pays you, "payment" when you pay a supplier. To allocate against specific invoices use invoice_allocations[].',
  'POST /api/credit-notes/':
    'IMPORTANT: Pass fields FLAT — no wrapper. ledger_id and invoice_ids are numeric DB IDs. Call list_invoices first to find the invoice. Get the invoice details to find invoice_item_id values needed in items[].',
};

// --- $ref resolver ----------------------------------------------------------

function resolveRef(ref: string, components: OpenAPISpec['components']): OpenAPISchema {
  const name = ref.replace('#/components/schemas/', '');
  return components?.schemas?.[name] ?? {};
}

function resolveSchema(schema: OpenAPISchema, components: OpenAPISpec['components'], depth = 0): OpenAPISchema {
  if (depth > 8) return {};
  if (schema.$ref) return resolveSchema(resolveRef(schema.$ref, components), components, depth + 1);
  if (schema.allOf) {
    const merged: OpenAPISchema = { type: 'object', properties: {}, required: [] };
    for (const s of schema.allOf) {
      const r = resolveSchema(s, components, depth + 1);
      Object.assign(merged.properties!, r.properties ?? {});
      if (r.required) merged.required!.push(...r.required);
    }
    return merged;
  }
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf ?? schema.oneOf)!;
    // If it's nullable (anyOf: [T, {type: null}]), just return the non-null type
    const nonNull = variants.filter(v => v.type !== 'null' && !(v.$ref === undefined && Object.keys(v).length === 0));
    if (nonNull.length === 1) return resolveSchema(nonNull[0], components, depth + 1);
    return { type: 'string', description: schema.description }; // fallback
  }
  if (schema.properties) {
    const resolved: Record<string, OpenAPISchema> = {};
    for (const [k, v] of Object.entries(schema.properties)) {
      resolved[k] = resolveSchema(v, components, depth + 1);
    }
    return { ...schema, properties: resolved };
  }
  if (schema.items) {
    return { ...schema, items: resolveSchema(schema.items, components, depth + 1) };
  }
  return schema;
}

// --- OpenAPI schema → Zod --------------------------------------------------

function schemaToZod(schema: OpenAPISchema, required: boolean, components: OpenAPISpec['components']): ZodTypeAny {
  const s = resolveSchema(schema, components);
  let z_: ZodTypeAny;

  if (s.enum) {
    const values = s.enum.filter(v => v !== null) as [string, ...string[]];
    z_ = values.length > 0 ? z.enum(values) : z.string();
  } else if (s.type === 'integer' || s.type === 'number') {
    let n = s.type === 'integer' ? z.number().int() : z.number();
    if (s.minimum !== undefined) n = n.min(s.minimum);
    if (s.maximum !== undefined) n = n.max(s.maximum);
    z_ = n;
  } else if (s.type === 'boolean') {
    z_ = z.boolean();
  } else if (s.type === 'array') {
    z_ = z.array(s.items ? schemaToZod(s.items, true, components) : z.unknown());
  } else if (s.type === 'object' || s.properties) {
    const shape: Record<string, ZodTypeAny> = {};
    const requiredFields = new Set(s.required ?? []);
    for (const [k, v] of Object.entries(s.properties ?? {})) {
      shape[k] = schemaToZod(v, requiredFields.has(k), components);
    }
    z_ = z.object(shape);
  } else {
    // string / date / date-time / default
    let str = z.string();
    if (s.minLength !== undefined) str = str.min(s.minLength);
    if (s.maxLength !== undefined) str = str.max(s.maxLength);
    z_ = str;
  }

  if (s.description) z_ = z_.describe(s.description);

  if (!required) {
    if (s.default !== undefined) {
      z_ = z_.optional().default(s.default as never);
    } else {
      z_ = z_.optional();
    }
  }

  return z_;
}

// --- Build MCP input shape from operation ----------------------------------

function buildInputShape(
  op: OpenAPIOperation,
  pathTemplate: string,
  components: OpenAPISpec['components'],
): Record<string, ZodTypeAny> {
  const shape: Record<string, ZodTypeAny> = {};

  // Path + query parameters
  for (const param of op.parameters ?? []) {
    if (param.in === 'path' || param.in === 'query') {
      const s = param.schema ? schemaToZod(param.schema, param.required ?? false, components) : z.string().optional();
      shape[param.name] = param.description ? s.describe(param.description) : s;
    }
  }

  // Request body — flatten top-level properties into the shape
  const bodyContent = op.requestBody?.content?.['application/json'];
  if (bodyContent?.schema) {
    const resolved = resolveSchema(bodyContent.schema, components);
    const requiredFields = new Set(resolved.required ?? []);
    for (const [k, v] of Object.entries(resolved.properties ?? {})) {
      // Don't overwrite path/query params
      if (!(k in shape)) {
        shape[k] = schemaToZod(v, requiredFields.has(k), components);
      }
    }
  }

  return shape;
}

// --- Tool name from operationId / method + path ----------------------------

function toToolName(method: string, path: string, operationId?: string): string {
  if (operationId) {
    // e.g. "create_invoice_api_invoices__post" → "create_invoice"
    return operationId.replace(/_api_.*$/, '').replace(/[^a-z0-9_]/gi, '_');
  }
  // Fallback: build from method + path segments
  const segments = path.replace(/[{}]/g, '').split('/').filter(Boolean)
    .filter(s => !['api'].includes(s));
  return `${method.toLowerCase()}_${segments.join('_')}`.replace(/[^a-z0-9_]/gi, '_');
}

// --- Register all allowed operations as MCP tools --------------------------

export async function registerOpenAPITools(server: McpServer): Promise<void> {
  const baseURL = process.env.INVOICING_BASE_URL!;
  const apiKey = process.env.INVOICING_API_TOKEN!;

  console.log('Fetching OpenAPI spec from backend...');
  const specURL = baseURL.replace(/\/$/, '').replace(/^https?:\/\/[^/]+/, '') === ''
    ? baseURL
    : baseURL;

  // Fetch from internal cluster URL if available (faster, no TLS overhead)
  const internalBase = 'http://invoicing-backend:8000';
  let spec: OpenAPISpec;
  try {
    const { data } = await axios.get<OpenAPISpec>(`${internalBase}/openapi.json`, { timeout: 5000 });
    spec = data;
    console.log('Loaded spec from internal backend URL');
  } catch {
    const { data } = await axios.get<OpenAPISpec>(`${baseURL.replace(/\/$/, '')}/openapi.json`, { timeout: 10000 });
    spec = data;
    console.log('Loaded spec from external URL');
  }

  const { components } = spec;
  let registered = 0;

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(methods)) {
      const key = `${method.toUpperCase()} ${path}`;
      if (!ALLOWED_PATHS.has(key)) continue;

      const toolName = toToolName(method, path, op.operationId);
      const extraHint = EXTRA_HINTS[key] ?? '';
      const description = [
        op.summary ?? toolName,
        op.description ?? '',
        extraHint,
      ].filter(Boolean).join(' — ').slice(0, 1024);

      const inputShape = buildInputShape(op, path, components);

      // Build the path params list (to extract from flat shape for URL interpolation)
      const pathParamNames = (op.parameters ?? [])
        .filter(p => p.in === 'path')
        .map(p => p.name);
      const queryParamNames = (op.parameters ?? [])
        .filter(p => p.in === 'query')
        .map(p => p.name);

      server.tool(toolName, description, inputShape, async (rawArgs: Record<string, unknown>) => {
        // Defensively unwrap if ChatGPT wraps args in a "data" key
        const args: Record<string, unknown> =
          rawArgs.data && typeof rawArgs.data === 'object' && !Array.isArray(rawArgs.data)
            ? (rawArgs.data as Record<string, unknown>)
            : rawArgs;

        // Normalise common LLM field name mistakes
        if (args.rate !== undefined && args.unit_price === undefined) args.unit_price = args.rate;
        if (args.invoice_type !== undefined && args.voucher_type === undefined) args.voucher_type = args.invoice_type;
        // Build URL
        let url = path as string;
        for (const p of pathParamNames) {
          url = url.replace(`{${p}}`, encodeURIComponent(String(args[p] ?? '')));
        }

        // Build query params
        const queryParams: Record<string, unknown> = {};
        for (const q of queryParamNames) {
          if (args[q] !== undefined && args[q] !== null) queryParams[q] = args[q];
        }

        // Build request body (everything not a path/query param)
        const allParamNames = new Set([...pathParamNames, ...queryParamNames]);
        const body: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(args)) {
          if (!allParamNames.has(k) && v !== undefined) body[k] = v;
        }

        try {
          const { data } = await axios.request({
            method: method.toUpperCase(),
            url: `${internalBase}${url}`,
            headers: { Authorization: `Bearer ${apiKey}` },
            params: Object.keys(queryParams).length ? queryParams : undefined,
            data: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) ? body : undefined,
          });
          return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
        } catch (err: unknown) {
          const e = err as { response?: { status: number; data: unknown } };
          const status = e.response?.status;
          const detail = e.response?.data;
          console.error(`[MCP ERROR] ${method.toUpperCase()} ${url} → ${status}: ${JSON.stringify(detail)}`);
          return {
            content: [{
              type: 'text' as const,
              text: `Error ${status}: ${JSON.stringify(detail)}`,
            }],
          };
        }
      });

      registered++;
    }
  }

  console.log(`Registered ${registered} MCP tools from OpenAPI spec`);
}
