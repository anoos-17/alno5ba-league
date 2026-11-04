import { handleUpload } from '@vercel/blob/client';
import { timingSafeEqual } from 'node:crypto';

function safePasswordMatch(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'GET') {
    const ready = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    return res.status(ready ? 200 : 503).json({ ready, error: ready ? undefined : 'اربط Vercel Blob بهذا المشروع أولاً.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'طريقة الطلب غير مدعومة.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'اربط Vercel Blob بهذا المشروع أولاً.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const expected = '121212';
        let payload = {};
        try { payload = JSON.parse(clientPayload || '{}'); } catch (_) {}
        if (!expected || !safePasswordMatch(payload.adminPassword, expected)) {
          throw new Error('مصادقة الأدمن غير صحيحة.');
        }
        if (!/^league-shorts\/[a-z0-9._-]+\.(mp4|webm)$/i.test(pathname)) {
          throw new Error('اسم أو نوع الملف غير مسموح.');
        }
        return {
          allowedContentTypes: ['video/mp4', 'video/webm'],
          maximumSizeInBytes: 1024 * 1024 * 1024,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 30,
          validUntil: Date.now() + 2 * 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ purpose: 'elite-league-shorts' })
        };
      },
      onUploadCompleted: async () => {}
    });
    return res.status(200).json(result);
  } catch (error) {
    const message = error?.message || 'تعذر تجهيز رفع الفيديو.';
    return res.status(/مصادقة الأدمن/.test(message) ? 401 : 400).json({ error: message });
  }
}
