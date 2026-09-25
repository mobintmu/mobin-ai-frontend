import type { Session } from './api';

const KEY = 'mobin-ai-session-v1';
export function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.access_token || !session.conversation_id || Date.parse(session.expires_at) <= Date.now()) { clearSession(); return null; }
    return session;
  } catch { clearSession(); return null; }
}
export function saveSession(session: Session): void { sessionStorage.setItem(KEY, JSON.stringify(session)); }
export function clearSession(): void { sessionStorage.removeItem(KEY); }
