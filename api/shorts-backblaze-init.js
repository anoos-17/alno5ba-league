import { authorizeBackblaze, b2BucketReady, failMethod, getBody, isAdmin, sendJson } from './_shared.js';
function safeSegment(value) {
  return encodeURIComponent(String(value)).replace(/%2F/gi, '/');
}
export default async function handler(req, res) {
  if (req.method === 'GET') return sendJson(res, 200, { ready: b2BucketReady() });
  if (req.method !== 'POST') return failMethod(res);
  const body = getBody(req);
  if (!isAdmin(req, body)) return sendJson(res, 401, { error: 'مصادقة الأدمن غير صحيحة.' });
  if (!b2BucketReady()) return sendJson(res, 503, { error: 'إعداد Backblaze B2 غير مكتمل.' });
  const id = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60);
  const contentType = String(body.contentType || '');
  const ext = contentType === 'video/webm' ? 'webm' : 'mp4';
  if (!id || !/^video\/(mp4|webm)$/.test(contentType)) return sendJson(res, 400, { error: 'بيانات الفيديو غير صالحة.' });
  try {
    const auth = await authorizeBackblaze();
    const response = await fetch(auth.apiUrl.replace(/\/$/, '') + '/b2api/v3/b2_get_upload_url', {
      method: 'POST',
      headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucketId: process.env.B2_BUCKET_ID }),
      cache: 'no-store'
    });
    const upload = await response.json().catch(() => ({}));
    if (!response.ok || !upload.uploadUrl || !upload.authorizationToken) {
      throw new Error(upload.message || upload.code || 'تعذر تجهيز الرفع إلى Backblaze.');
    }
    const fileName = 'league-shorts/' + id + '.' + ext;
    const bucketName = process.env.B2_BUCKET_NAME;
    const publicBase = (process.env.B2_PUBLIC_BASE_URL || auth.downloadUrl).replace(/\/$/, '');
    const publicUrl = publicBase + '/file/' + encodeURIComponent(bucketName) + '/' + safeSegment(fileName);
    return sendJson(res, 200, { ready: true, uploadUrl: upload.uploadUrl, authorizationToken: upload.authorizationToken, fileName, publicUrl });
  } catch (error) {
    return sendJson(res, 503, { error: error?.message || 'تعذر بدء الرفع إلى Backblaze.' });
  }
}
