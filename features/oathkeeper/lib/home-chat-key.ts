export const HOME_CHAT_KEY_PREFIX = 'oathkeeper_chat_access:';

export function homeChatKey(id: string, create = false): string | null {
  let key = localStorage.getItem(HOME_CHAT_KEY_PREFIX + id);
  if (!key && create) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(HOME_CHAT_KEY_PREFIX + id, key);
  }
  return key;
}

export async function ensureHomeChatKey(id: string) {
  return navigator.locks
    ? navigator.locks.request(HOME_CHAT_KEY_PREFIX + id, () => homeChatKey(id, true)!)
    : homeChatKey(id, true)!;
}
