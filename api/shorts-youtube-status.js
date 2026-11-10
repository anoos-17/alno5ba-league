import { failMethod, getBody, isAdmin, sendJson } from './_shared.js';

function safeDiagnostic(value) {
  return String(value || '').replace(/[\r\n\t]+/g, ' ').slice(0, 300);
}

async function getAccessToken() {
  const form = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID || '',
    client_secret: process.env.YOUTUBE_CLIENT_SECRET || '',
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN || '',
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
    throw new Error(`OAuth ${safeDiagnostic(data.error || 'token_error')} (${response.status}): ${safeDiagnostic(data.error_description || 'Google لم يُرجع رمز دخول.')}`);
  }
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return failMethod(res);
  const body = getBody(req);
  if (!isAdmin(req, body)) return sendJson(res, 401, { error: 'مصادقة الأدمن غير صحيحة.' });

  const sessionUrl = String(body.sessionUrl || '');
  const size = Number(body.size) || 0;
  let parsedUrl;
  try { parsedUrl = new URL(sessionUrl); } catch (_) { parsedUrl = null; }
  if (!parsedUrl || parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'www.googleapis.com' || parsedUrl.pathname !== '/upload/youtube/v3/videos' || !parsedUrl.searchParams.has('upload_id') || !size) {
    return sendJson(res, 400, { error: 'بيانات جلسة YouTube غير صالحة.' });
  }
  if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REFRESH_TOKEN) {
    return sendJson(res, 503, { error: 'إعداد YouTube غير مكتمل.' });
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Range': `bytes */${size}`,
        'Content-Length': '0'
      },
      cache: 'no-store'
    });
    if (response.status === 308) {
      const range = response.headers.get('range') || '';
      const receivedBytes = Number(range.match(/bytes=0-(\d+)/i)?.[1]) + 1 || 0;
      return sendJson(res, 200, { complete: false, receivedBytes, totalBytes: size });
    }
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const videoId = String(data.id || '');
      if (/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return sendJson(res, 200, { complete: true, videoId });
      return sendJson(res, 502, { error: 'اكتمل الاتصال لكن YouTube لم يُرجع معرّف الفيديو.' });
    }
    const data = await response.json().catch(() => ({}));
    const reason = safeDiagnostic(data?.error?.errors?.[0]?.reason || data?.error?.status || 'youtube_status_error');
    const detail = safeDiagnostic(data?.error?.message || 'لم يُرجع YouTube تفاصيل إضافية.');
    console.error('[shorts-youtube-status] Status check rejected', { status: response.status, reason, detail });
    return sendJson(res, 502, { error: `تعذر تأكيد اكتمال YouTube (${response.status}، ${reason}): ${detail}` });
  } catch (error) {
    const detail = safeDiagnostic(error?.message || 'تعذر تأكيد اكتمال الرفع.');
    console.error('[shorts-youtube-status] Status check failed', { detail });
    return sendJson(res, 503, { error: detail });
  }
}
