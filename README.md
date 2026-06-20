# simple_invoicing-mcp

MCP (Model Context Protocol) server that acts as a bridge to any deployed [`simple_invoicing`](https://github.com/nikhilb2/simple_invoicing) FastAPI instance.

This server exposes the simple_invoicing REST API as MCP tools, making it usable directly from Claude Desktop, Cursor, or any other MCP-compatible client.

## Prerequisites

- Node.js ≥ 18
- A running `simple_invoicing` FastAPI backend
- A long-lived bearer token (API token) for the backend

## Setup

```bash
git clone https://github.com/nikhilb2/simple_invoicing-mcp.git
cd simple_invoicing-mcp
npm install
npm run build
```

## Configuration

Set these environment variables before running:

```bash
export INVOICING_BASE_URL=https://your-invoicing-instance.example.com
export INVOICING_API_TOKEN=your-long-lived-bearer-token-here
```

Or copy `.env.example` to `.env` and fill in the values.

### How to get an API token

1. Open your `simple_invoicing` backend's Swagger UI (usually at `/docs`)
2. Use the `/api/auth/login` endpoint with your credentials
3. Copy the `access_token` from the response
4. Use this token as `INVOICING_API_TOKEN`

## Running locally (dev)

```bash
npm run dev
```

This starts the MCP server on stdio using `tsx`.

## MCP Client Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "invoicing": {
      "command": "node",
      "args": ["/absolute/path/to/simple_invoicing-mcp/dist/index.js"],
      "env": {
        "INVOICING_BASE_URL": "https://invoicing.example.com",
        "INVOICING_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "invoicing": {
      "command": "node",
      "args": ["/absolute/path/to/simple_invoicing-mcp/dist/index.js"],
      "env": {
        "INVOICING_BASE_URL": "https://invoicing.example.com",
        "INVOICING_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

## Available Tools

### Invoices

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_invoices` | List all invoices with optional filtering | `invoice_type?` ("sales"\|"purchase"), `skip?`, `limit?` |
| `get_invoice` | Get a single invoice by ID | `id` (number) |
| `create_invoice` | Create a new invoice | `data` (object) |
| `get_invoice_pdf` | Get the PDF for an invoice | `id` (number) |

### Products

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_products` | List all products | `skip?`, `limit?` |
| `get_product` | Get a single product by ID | `id` (number) |
| `create_product` | Create a new product | `data` (object) |

### Ledgers

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_ledgers` | List all ledgers | `skip?`, `limit?` |
| `get_ledger_statement` | Get the statement for a ledger | `id`, `start_date?`, `end_date?` |
| `get_day_book` | Get the day book entries | `start_date?`, `end_date?` |

### Inventory

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_inventory` | List all inventory items | `skip?`, `limit?` |

### Buyers

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_buyers` | List all buyers | `skip?`, `limit?` |
| `get_buyer` | Get a single buyer by ID | `id` (number) |

### Payments

| Tool | Description | Parameters |
|------|-------------|------------|
| `list_payments` | List all payments | `skip?`, `limit?` |
| `create_payment` | Create a new payment | `data` (object) |

## Development

```bash
npm install      # Install dependencies (set NODE_ENV=development for devDeps)
npm run build    # Compile TypeScript
npm test         # Run tests
```

## License

MIT
