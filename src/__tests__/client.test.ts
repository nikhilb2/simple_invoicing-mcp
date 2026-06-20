import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

// We test the client module in isolation by setting env vars before import
describe('client', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    vi.resetModules();
    // Delete env vars to force re-evaluation
    delete process.env.INVOICING_BASE_URL;
    delete process.env.INVOICING_API_TOKEN;
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('should throw if INVOICING_BASE_URL is not set', async () => {
    delete process.env.INVOICING_BASE_URL;
    process.env.INVOICING_API_TOKEN = 'test-token';
    await expect(import('../client')).rejects.toThrow('INVOICING_BASE_URL is required');
  });

  it('should throw if INVOICING_API_TOKEN is not set', async () => {
    process.env.INVOICING_BASE_URL = 'https://api.example.com';
    delete process.env.INVOICING_API_TOKEN;
    await expect(import('../client')).rejects.toThrow('INVOICING_API_TOKEN is required');
  });

  it('should create client with auth header when env vars are set', async () => {
    mock.onGet('/api/invoices/').reply(200, [{ id: 1, number: 'INV-001' }]);

    process.env.INVOICING_BASE_URL = 'https://api.example.com';
    process.env.INVOICING_API_TOKEN = 'test-bearer-token';

    const { client } = await import('../client');

    const response = await client.get('/api/invoices/');
    expect(response.status).toBe(200);
    expect(response.data).toEqual([{ id: 1, number: 'INV-001' }]);

    const lastRequest = mock.history.get[0];
    expect(lastRequest.headers?.Authorization).toBe('Bearer test-bearer-token');
    expect(lastRequest.headers?.['Content-Type']).toBe('application/json');
  });
});
