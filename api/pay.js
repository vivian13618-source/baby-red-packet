// POST /api/pay { id, token } — calls LINE Pay Request API and returns the payment page URL.
import { json, fail, loadOrder, saveOrder, linePayPost, originOf } from '../lib/shared.js';

async function handler(request) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);
  let b; try { b = await request.json(); } catch { return fail('資料格式錯誤'); }
  const order = await loadOrder(b.id);
  if (!order || order.token !== b.token) return fail('找不到訂單', 404);
  if (order.status === 'paid' || order.status === 'sent') return fail('這筆訂單已付款', 409);
  const need = ['thumb', ...order.rcp.map((_, i) => String(i))];
  if (!need.every((k) => order.uploaded.includes(k))) return fail('印刷檔還沒上傳完成，請再試一次', 409);

  const base = originOf(request);
  const r = await linePayPost('/v3/payments/request', {
    amount: order.amount,
    currency: 'TWD',
    orderId: order.id,
    packages: [{
      id: 'set', amount: order.amount, name: '寶寶紅包袋',
      products: [{ name: `專屬寶寶紅包袋一組（${order.rcp.length} 張）`, quantity: 1, price: order.amount }],
    }],
    redirectUrls: {
      confirmUrl: `${base}/api/linepay-confirm`,
      cancelUrl: `${base}/api/linepay-cancel?orderId=${order.id}`,
    },
  });
  if (r.returnCode !== '0000') {
    console.error('LINE Pay request failed', order.id, r.returnCode, r.returnMessage);
    return fail(`LINE Pay 建立付款失敗（${r.returnCode}）`, 502);
  }
  order.status = 'pending_payment';
  order.transactionId = r.info.transactionId; // kept as a string (see parseLinePay)
  await saveOrder(order);
  return json({ paymentUrl: r.info.paymentUrl.web });
}

export const GET = handler;
export const POST = handler;
