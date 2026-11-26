// Shared helpers: LINE Pay v3 client, order storage on Vercel Blob (private), responses, admin auth.
import { createHmac, randomUUID, timingSafeEqual, randomBytes } from 'node:crypto';
import { put, get, list, del } from '@vercel/blob';

export const PRICE = 199;            // NT$ per set — the server decides the amount, never the browser
export const MAX_PAGES = 8;

/* ---------------- responses ---------------- */
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
export const fail = (message, status = 400) => json({ error: message }, status);
export const redirect = (url) => new Response(null, { status: 302, headers: { Location: url } });
export const originOf = (request) => {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const u = new URL(request.url);
  return `${request.headers.get('x-forwarded-proto') || u.protocol.replace(':', '')}://${request.headers.get('x-forwarded-host') || u.host}`;
};

/* ---------------- LINE Pay v3 ---------------- */
const lpHost = () => (process.env.LINE_PAY_ENV === 'production' ? 'https://api-pay.line.me' : 'https://sandbox-api-pay.line.me');

// Signature = Base64(HMAC-SHA256(ChannelSecret, ChannelSecret + URI + RequestBody + nonce))
export function lineSign(secret, uri, body, nonce) {
  return createHmac('sha256', secret).update(secret + uri + body + nonce).digest('base64');
}

// LINE Pay transactionId is 19 digits — larger than JS can hold exactly. Quote it before JSON.parse.
export function parseLinePay(text) {
  return JSON.parse(text.replace(/"(transactionId|refundTransactionId)"\s*:\s*(\d+)/g, '"$1":"$2"'));
}

export async function linePayPost(uri, payload) {
  const id = process.env.LINE_PAY_CHANNEL_ID, secret = process.env.LINE_PAY_CHANNEL_SECRET;
  if (!id || !secret) throw new Error('LINE_PAY_CHANNEL_ID / LINE_PAY_CHANNEL_SECRET 尚未設定');
  const body = JSON.stringify(payload), nonce = randomUUID();
  const res = await fetch(lpHost() + uri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': id,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': lineSign(secret, uri, body, nonce),
    },
    body,
  });
  const text = await res.text();
  let data;
  try { data = parseLinePay(text); } catch { throw new Error(`LINE Pay 回應無法解析（HTTP ${res.status}）`); }
  return data; // { returnCode, returnMessage, info }
}

/* ---------------- order storage ---------------- */
const orderPath = (id) => `orders/${id}.json`;
export const pagePath = (id, i) => `pages/${id}/${i}.jpg`;
export const validId = (id) => typeof id === 'string' && /^BRP\d{6}-[A-Z0-9]{6}$/.test(id);

export function newOrderId() {
  const d = new Date(Date.now() + 8 * 3600e3); // Taiwan date
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const tail = randomBytes(6).toString('base64').replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(6, 'X').slice(0, 6);
  return `BRP${ymd}-${tail}`;
}
export const newToken = () => randomBytes(24).toString('hex');

export async function saveOrder(order) {
  order.updatedAt = new Date().toISOString();
  await put(orderPath(order.id), JSON.stringify(order), {
    access: 'private', contentType: 'application/json', allowOverwrite: true, addRandomSuffix: false,
  });
  return order;
}

export async function loadOrder(id) {
  if (!validId(id)) return null;
  const r = await get(orderPath(id), { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}

export async function listOrders() {
  const out = []; let cursor;
  do {
    const page = await list({ prefix: 'orders/', cursor, limit: 1000 });
    out.push(...page.blobs); cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  const orders = await Promise.all(out.map((b) => loadOrder(b.pathname.slice(7, -5)).catch(() => null)));
  return orders.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function savePage(id, i, bytes) {
  await put(pagePath(id, i), bytes, { access: 'private', contentType: 'image/jpeg', allowOverwrite: true, addRandomSuffix: false });
}
export async function readPage(id, i) {
  const r = await get(pagePath(id, i), { access: 'private' });
  return r && r.statusCode === 200 ? r : null;
}
export async function deleteOrderFiles(id) {
  const { blobs } = await list({ prefix: `pages/${id}/` });
  if (blobs.length) await del(blobs.map((b) => b.url));
}

/* ---------------- admin auth ---------------- */
export function isAdmin(request) {
  const want = process.env.ADMIN_PASSWORD || '', got = request.headers.get('x-admin-key') || '';
  if (want.length < 8 || got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/* ---------------- input cleaning ---------------- */
export const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
