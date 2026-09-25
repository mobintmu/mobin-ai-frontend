import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConversation, register, sendQuestion, streamQuestion, type Session } from '../src/lib/api';

const session: Session = { conversation_id: 'conversation-1', access_token: 'secret-token', expires_at: '2099-01-01T00:00:00Z', quota: { limit: 100, used: 0, remaining: 100 } };
const answer = { message_id: 'answer-1', conversation_id: 'conversation-1', answer: 'A sourced answer. [c1]', grounded: true, citations: [{ citation_id: 'c1', title: 'Article', url: 'https://mobinshaterian.com/blog/article' }], quota: { limit: 100, used: 1, remaining: 99 } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
afterEach(() => vi.unstubAllGlobals());

describe('provisional API adapter', () => {
  it('exchanges a one-time registration grant and sends a scoped bearer token with an idempotency key', async () => {
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init]);
      if (url.endsWith('/clients')) return json({ client_id: 'client-1', registration_grant: 'grant-1' });
      if (url.endsWith('/conversations')) return json(session);
      return json(answer);
    }));
    const created = await register({ given_name: 'Ada', family_name: 'Lovelace', email: 'ada@example.com', phone: null, privacy_accepted: true, privacy_policy_version: '2026-09-25', marketing_consent: false, turnstile_token: 'verified' });
    await sendQuestion(created, 'How does it work?', 'stable-key');
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ client_id: 'client-1', registration_grant: 'grant-1' });
    expect((calls[2][1].headers as Record<string, string>).Authorization).toBe('Bearer secret-token');
    expect((calls[2][1].headers as Record<string, string>)['Idempotency-Key']).toBe('stable-key');
  });

  it('uses authoritative quota from conversation response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ conversation_id: 'conversation-1', quota: { limit: 100, used: 100, remaining: 0 } })));
    expect((await getConversation(session)).remaining).toBe(0);
  });

  it('parses a POST SSE stream and requires complete', async () => {
    const encoder = new TextEncoder();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode('event: retrieving\ndata: {}\n\nevent: delta\ndata: {"text":"Hello"}\n\n')); controller.enqueue(encoder.encode(`event: complete\ndata: ${JSON.stringify(answer)}\n\n`)); controller.close(); } }), { headers: { 'Content-Type': 'text/event-stream' } })));
    const events: string[] = [];
    const result = await streamQuestion(session, 'Question', 'key', event => events.push(event.type), new AbortController().signal);
    expect(events).toEqual(['retrieving', 'delta', 'complete']);
    expect(result.quota.remaining).toBe(99);
  });

  it('does not treat an interrupted stream as an answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('event: delta\ndata: {"text":"Partial"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })));
    await expect(streamQuestion(session, 'Question', 'key', () => {}, new AbortController().signal)).rejects.toMatchObject({ code: 'interrupted_stream' });
  });
});
