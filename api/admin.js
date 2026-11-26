// Admin API (header x-admin-key = ADMIN_PASSWORD)
//   GET  /api/admin?action=list
//   GET  /api/admin?action=file&id=…&i=0..7|thumb
//   POST /api/admin { action:'code', id, code } | { action:'delete-files', id }
import { json, fail, isAdmin, listOrders, loadOrder, saveOrder, readPage, deleteOrderFiles, clean } from '../lib/shared.js';

export default async function handler(request) {
  if (!isAdmin(request)) return fail('密碼錯誤', 401);
  const q = new URL(request.url).searchParams;

  if (request.method === 'GET' && q.get('action') === 'list') {
    const paid = q.get('all') === '1';
    const orders = (await listOrders()).filter((o) => paid || o.status !== 'draft');
    return json(orders.map(({ token, ...o }) => o));
  }
  if (request.method === 'GET' && q.get('action') === 'file') {
    const id = q.get('id'), i = q.get('i');
    if (!(i === 'thumb' || /^\d$/.test(i))) return fail('頁碼錯誤');
    const r = await readPage(id, i);
    if (!r) return fail('檔案不存在', 404);
    return new Response(r.stream, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (request.method === 'POST') {
    let b; try { b = await request.json(); } catch { return fail('資料格式錯誤'); }
    const order = await loadOrder(b.id);
    if (!order) return fail('找不到訂單', 404);
    if (b.action === 'code') {
      order.ibonCode = clean(b.code, 40);
      if (order.status === 'paid' && order.ibonCode) order.status = 'sent';
      if (order.status === 'sent' && !order.ibonCode) order.status = 'paid';
      await saveOrder(order);
      const { token, ...o } = order; return json(o);
    }
    if (b.action === 'delete-files') {
      await deleteOrderFiles(order.id);
      order.filesDeletedAt = new Date().toISOString(); order.uploaded = [];
      await saveOrder(order);
      return json({ ok: true });
    }
  }
  return fail('不支援的操作', 400);
}
