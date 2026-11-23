"use client";
export type Hello = { name: string; version: string; protected: boolean; hasUsername: boolean };
export type Connection = { url: string; name: string; accessToken: string; refreshToken: string; expiresAt: number };
const KEY = 'vibeghost-lite-auth';
let current: Connection | null = null;
let refreshing: Promise<void> | null = null;
export function validateHost(value: string) {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Enter only the VibeGhost origin, without a path or credentials.');
  const ip = url.hostname.split('.').map(Number);
  const tailnet = ip.length === 4 && ip.every(n => Number.isInteger(n) && n >= 0 && n <= 255) && ip[0] === 100 && ip[1] >= 64 && ip[1] <= 127;
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && tailnet)) throw new Error('Use HTTPS, or HTTP on a Tailscale 100.64–100.127 address. Public HTTP is not safe.');
  return url.origin;
}
export function connection() { return current; }
export function restoreConnection() {
  try { const value = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (value && typeof value.accessToken === 'string' && typeof value.refreshToken === 'string' && validateHost(value.url)) current = value; } catch { sessionStorage.removeItem(KEY); }
  return current;
}
export function setConnection(value: Connection | null) {
  current = value;
  if (value) sessionStorage.setItem(KEY, JSON.stringify(value)); else sessionStorage.removeItem(KEY);
}
export async function publicRequest(url: string, path: string, body?: unknown) {
  const response = await fetch(`${url}/api/lite/${path}`, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || `VibeGhost returned ${response.status}`);
  return value;
}
export async function liteFetch(path: string, init: RequestInit = {}) {
  const owner = current;
  if (!owner) throw new Error('Connect to VibeGhost first');
  async function refresh() {
    const latest = current;
    if (!latest || latest.url !== owner!.url) throw new Error('VibeGhost connection changed');
    if (!refreshing) refreshing = publicRequest(latest.url, 'refresh', { refreshToken: latest.refreshToken }).then(pair => {
      if (current === latest) setConnection({ ...latest, ...pair });
    }).catch(error => { if (current === owner) { setConnection(null); window.dispatchEvent(new Event('lite-auth-expired')); } throw error; }).finally(() => { refreshing = null; });
    await refreshing;
  }
  if (owner.expiresAt - Date.now() < 30_000) await refresh();
  if (current?.url !== owner.url) throw new Error('VibeGhost connection changed');
  const request = () => fetch(`${owner.url}${path}`, { ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${current!.accessToken}` }, credentials: 'omit', redirect: 'error', cache: 'no-store' });
  let response = await request();
  if (response.status === 401) { await refresh(); response = await request(); }
  return response;
}
