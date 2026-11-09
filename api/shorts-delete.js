import { del } from '@vercel/blob';
import { authorizeBackblaze, getBody, isAdmin, sendJson } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'طريقة الطلب غير مدعومة.' });
  const body = getBody(req);
  if (!isAdmin(req, body)) return sendJson(res, 401, { error: 'مصادقة الأدمن غير صحيحة.' });

  try {
    if (body.provider === 'backblaze-b2') {
      const fileId = String(body.fileId || '');
      const fileName = String(body.fileName || '');
      if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId) || !/^league-shorts\/[a-z0-9._-]+\.(mp4|webm)$/i.test(fileName)) {
        return sendJson(res, 400, { error: 'بيانات ملف Backblaze غير صالحة.' });
      }
      const auth = await authorizeBackblaze();
      const response = await fetch(auth.apiUrl.replace(/\/$/, '') + '/b2api/v3/b2_delete_file_version', {
        method: 'POST',
        headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId, fileName }),
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.code || 'تعذر حذف ملف Backblaze.');
      return sendJson(res, 200, { ok: true });
    }

    const pathname = typeof body.pathname === 'string' ? body.pathname : '';
    if (!/^league-shorts\/[a-z0-9._-]+\.(mp4|webm)(-[a-z0-9]+)?$/i.test(pathname)) {
      return sendJson(res, 400, { error: 'مسار الملف غير صالح.' });
    }
    await del(pathname);
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { error: error?.message || 'تعذر حذف الفيديو.' });
  }
}