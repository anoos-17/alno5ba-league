import { del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

function safePasswordMatch(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' });
  const expected = '121212';
  const authorization = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !safePasswordMatch(supplied, expected)) return res.status(401).json({ error: 'مصادقة الأدمن غير صحيحة.' });

  const pathname = typeof req.body?.pathname === 'string' ? req.body.pathname : '';
  if (!/^league-shorts\/[a-z0-9._-]+\.(mp4|webm)(-[a-z0-9]+)?$/i.test(pathname)) {
    return res.status(400).json({ error: 'مسار الملف غير صالح.' });
  }
  try {
    await del(pathname);
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'تعذر حذف الفيديو.' });
  }
}
