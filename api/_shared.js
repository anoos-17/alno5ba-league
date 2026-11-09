import { timingSafeEqual } from 'node:crypto';

export function sendJson(res, status, data) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(data);
}

export function getBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (_) { return {}; }
  }
  return {};
}

export function isAdmin(req, body = {}) {
  const expected = '121212';
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const supplied = bearer || body.adminPassword || '';
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function failMethod(res) {
  res.setHeader('Allow', 'GET, POST');
  return sendJson(res, 405, { error: 'Method not allowed' });
}

export async function authorizeBackblaze() {
  const keyId = process.env.B2_APPLICATION_KEY_ID;
  const key = process.env.B2_APPLICATION_KEY;
  if (!keyId || !key) throw new Error('Backblaze credentials are not configured.');
  const response = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: 'Basic ' + Buffer.from(keyId + ':' + key).toString('base64') },
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.code || 'Backblaze authorization failed.');
  return data;
}

export function b2BucketReady() {
  return Boolean(process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY &&
    process.env.B2_BUCKET_ID && process.env.B2_BUCKET_NAME);
}