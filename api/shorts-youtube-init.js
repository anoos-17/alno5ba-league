import { failMethod, getBody, isAdmin, sendJson } from './_shared.js';

function youtubeReady() {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
}
async function getAccessToken() {
  const form = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    cache: 'no-store'
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'تعذر تجديد صلاحية YouTube.');
  }
  return data.access_token;
}
export default async function handler(req, res) {
  if (req.method === 'GET') return sendJson(res, 200, { ready: youtubeReady() });
  if (req.method !== 'POST') return failMethod(res);
  const body = getBody(req);
  if (!isAdmin(req, body)) return sendJson(res, 401, { error: 'مصادقة الأدمن غير صحيحة.' });
  if (!youtubeReady()) return sendJson(res, 503, { error: 'إعداد YouTube غير مكتمل.' });
  const title = String(body.title || '').trim().slice(0, 100);
  const description = String(body.description || '').trim().slice(0, 5000);
  const size = Number(body.size) || 0;
  const contentType = String(body.contentType || '');
  if (!title || !size || !/^video\/(mp4|webm)$/.test(contentType)) {
    return sendJson(res, 400, { error: 'بيانات الفيديو غير صالحة.' });
  }
  try {
    const accessToken = await getAccessToken();
    const response = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': contentType
      },
      body: JSON.stringify({
        snippet: { title, description, categoryId: '17', tags: ['دوري النخبة', 'elno5ba-league', 'كرة القدم'] },
        status: { privacyStatus: 'unlisted', embeddable: true, selfDeclaredMadeForKids: false }
      }),
      cache: 'no-store'
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const reason = data?.error?.errors?.[0]?.reason || data?.error?.message || 'YouTube رفض بدء الرفع.';
      return sendJson(res, response.status === 403 ? 503 : response.status, { error: String(reason).slice(0, 220) });
    }
    const sessionUrl = response.headers.get('location');
    if (!sessionUrl) return sendJson(res, 502, { error: 'لم يُرجع YouTube رابط جلسة الرفع.' });
    return sendJson(res, 200, { ready: true, sessionUrl });
  } catch (error) {
    return sendJson(res, 503, { error: error?.message || 'تعذر بدء الرفع إلى YouTube.' });
  }
}
