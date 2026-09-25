import { beforeEach, describe, expect, it } from 'vitest';
import { clearSession, readSession, saveSession } from '../src/lib/session';
import type { Session } from '../src/lib/api';

const session: Session = { conversation_id: 'conversation-1', access_token: 'secret-token', expires_at: '2099-01-01T00:00:00Z', quota: { limit: 100, used: 0, remaining: 100 } };
beforeEach(() => sessionStorage.clear());

describe('chat-origin session storage', () => {
  it('recovers an unexpired credential in the same tab', () => {
    saveSession(session);
    expect(readSession()).toEqual(session);
    clearSession();
    expect(readSession()).toBeNull();
  });
  it('removes an expired credential', () => {
    saveSession({ ...session, expires_at: '2000-01-01T00:00:00Z' });
    expect(readSession()).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
