// POST /api/order-page?id=…&i=0..7|thumb&token=… — body is the JPEG bytes of one print page (A4 @300dpi) or the thumbnail.
import { json, fail, loadOrder, saveOrder, savePage } from '../lib/shared.js';

const MAX_BYTES = 4_300_000; // Vercel Functions accept request bodies up to 4.5 MB

export default async function handler(request) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  const q = new URL(request.url).searchParams, id = q.get('id'), i = q.get('i'), token = q.get('token');
  const order = await loadOrder(id);
  if (!order || order.token !== token) return fail('找不到訂單', 404);
  if (order.status !== 'draft') return fail('訂單已送出，不能再修改', 409);
  if (!(i === 'thumb' || (/^\d$/.test(i) && +i < order.rcp.length))) return fail('頁碼錯誤');

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_BYTES) return fail('檔案大小不符', 413);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return fail('只接受 JPEG', 415);

  await savePage(order.id, i, bytes);
  if (!order.uploaded.includes(i)) { order.uploaded.push(i); await saveOrder(order); }
  return json({ ok: true });
}
