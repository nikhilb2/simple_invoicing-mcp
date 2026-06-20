import axios from 'axios';

const baseURL = process.env.INVOICING_BASE_URL;
const apiToken = process.env.INVOICING_API_TOKEN;

if (!baseURL) throw new Error('INVOICING_BASE_URL is required');
if (!apiToken) throw new Error('INVOICING_API_TOKEN is required');

export const client = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  },
});
