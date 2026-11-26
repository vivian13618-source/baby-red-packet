// POST /api/orders — create a draft order. Returns { id, token, pages } for uploading print pages.
import { json, fail, clean, newOrderId, newToken, saveOrder, PRICE, MAX_PAGES } from '../lib/shared.js';

const FRONTS = ['yy', 'sy', 'jy', 'xq', 'xdy', 'orange', 'firework', 'packets', 'flower', 'heart'];
const BACKS = ['knot', 'lantern', 'fu', 'crackers', 'ingot'];

export default async function handler(request) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let b; try { b = await request.json(); } catch { return fail('資料格式錯誤'); }

  const rcp = Array.isArray(b.rcp) ? b.rcp.map((r) => clean(r, 6)).filter(Boolean).slice(0, MAX_PAGES) : [];
  const order = {
    id: newOrderId(),
    token: newToken(),
    status: 'draft',                 // draft → pending_payment → paid → sent (or cancelled)
    createdAt: new Date().toISOString(),
    amount: PRICE,
    baby: clean(b.baby, 6),
    rcp,
    tpl: FRONTS.includes(b.tpl) ? b.tpl : 'yy',
    back: BACKS.includes(b.back) ? b.back : 'knot',
    cname: clean(b.cname, 20),
    phone: clean(b.phone, 10).replace(/\D/g, ''),
    line: clean(b.line, 40),
    uploaded: [],
    ibonCode: '',
  };
  if (!order.baby) return fail('請填寫寶寶名字');
  if (!rcp.length) return fail('請至少加入一位收件人');
  if (!order.cname) return fail('請填寫稱呼');
  if (!/^09\d{8}$/.test(order.phone)) return fail('手機號碼格式錯誤');
  if (!order.line) return fail('請填寫 LINE ID');
  if (b.agree !== true) return fail('請同意照片使用方式');

  await saveOrder(order);
  return json({ id: order.id, token: order.token, pages: rcp.length });
}
