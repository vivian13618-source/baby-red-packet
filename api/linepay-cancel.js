// GET /api/linepay-cancel?orderId=… — buyer cancelled on the LINE Pay page.
import { redirect, loadOrder, saveOrder, originOf } from '../lib/shared.js';

async function handler(request) {
  const base = originOf(request), order = await loadOrder(new URL(request.url).searchParams.get('orderId'));
  if (order && order.status === 'pending_payment') { order.status = 'draft'; await saveOrder(order); }
  return redirect(`${base}/?cancel=1`);
}

export const GET = handler;
export const POST = handler;
