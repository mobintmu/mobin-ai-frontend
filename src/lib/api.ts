import { z } from 'zod';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://api.mobinshaterian.com').replace(/\/$/, '');
const api = `${API_BASE}/api/v1`;

const quotaSchema = z.object({ limit: z.number().int(), used: z.number().int(), remaining: z.number().int() });
const citationSchema = z.object({ citation_id: z.string(), title: z.string(), url: z.string(), snippet: z.string().optional().nullable() });
const answerSchema = z.object({ message_id: z.string(), conversation_id: z.string(), answer: z.string(), grounded: z.boolean(), citations: z.array(citationSchema), quota: quotaSchema, request_id: z.string().optional() });
const sessionSchema = z.object({ conversation_id: z.string(), access_token: z.string(), expires_at: z.string(), quota: quotaSchema });
const historySchema = z.union([z.array(answerSchema.extend({ question: z.string() })), z.object({ messages: z.array(z.object({ id: z.string(), role: z.enum(['user', 'assistant']), content: z.string(), created_at: z.string().optional(), citations: z.array(citationSchema).optional(), grounded: z.boolean().optional() })) })]);

export type Quota = z.infer<typeof quotaSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Answer = z.infer<typeof answerSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Message = { id: string; role: 'user' | 'assistant'; content: string; citations?: Citation[]; grounded?: boolean; pending?: boolean };

export class ApiError extends Error {
  constructor(public code: string, message: string, public requestId?: string, public retryAfter?: number, public status?: number) { super(message); }
}

async function request<T>(path: string, init: RequestInit, schema: z.ZodSchema<T>, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${api}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  } catch {
    throw new ApiError('network_error', navigator.onLine ? 'Could not reach Mobin\'AI. Please try again.' : 'You appear to be offline. Check your connection and try again.');
  }
  if (!response.ok) throw await readError(response);
  if (response.status === 204) return schema.parse(undefined);
  try { return schema.parse(await response.json()); }
  catch { throw new ApiError('invalid_response', 'The service returned an unexpected response. Please try again.'); }
}

export async function readError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({}));
  const parsed = z.object({ code: z.string(), message: z.string().optional(), request_id: z.string().optional() }).safeParse(body);
  const code = parsed.success ? parsed.data.code : `http_${response.status}`;
  const messages: Record<string, string> = {
    turnstile_expired: 'Verification expired. Please complete it again.', turnstile_invalid: 'Verification failed. Please try again.',
    quota_exhausted: 'This conversation has reached its question limit.', rate_limited: 'Too many requests right now. Please wait before trying again.',
    token_expired: 'This session has expired. Start a new conversation to continue.', unauthorized: 'This session is no longer available. Start a new conversation.',
    provider_unavailable: 'The answer service is temporarily unavailable. Your question was not completed.', generation_failed: 'The answer could not be completed. Please try again.',
  };
  const retryHeader = response.headers.get('Retry-After');
  const retryAfter = retryHeader ? (/^\d+$/.test(retryHeader) ? Number(retryHeader) : Math.max(0, Math.ceil((Date.parse(retryHeader) - Date.now()) / 1000))) : undefined;
  return new ApiError(code, messages[code] ?? (response.status >= 500 ? 'The service is unavailable right now. Please try again.' : 'The request could not be completed. Please check your details.'), parsed.success ? parsed.data.request_id : undefined, Number.isFinite(retryAfter) ? retryAfter : undefined, response.status);
}

export type Registration = { given_name: string; family_name: string; email: string | null; phone: string | null; privacy_accepted: true; privacy_policy_version: string; marketing_consent: boolean; turnstile_token: string };
export async function register(data: Registration): Promise<Session> {
  const client = await request('/clients', { method: 'POST', body: JSON.stringify(data) }, z.object({ client_id: z.string(), registration_grant: z.string() }));
  return request('/conversations', { method: 'POST', body: JSON.stringify({ client_id: client.client_id, registration_grant: client.registration_grant }) }, sessionSchema);
}

export async function getConversation(session: Session): Promise<Quota> {
  const result = await request(`/conversations/${encodeURIComponent(session.conversation_id)}`, { method: 'GET' }, z.object({ conversation_id: z.string(), quota: quotaSchema }), session.access_token);
  return result.quota;
}

export async function getHistory(session: Session): Promise<Message[]> {
  const result = await request(`/conversations/${encodeURIComponent(session.conversation_id)}/messages`, { method: 'GET' }, historySchema, session.access_token);
  if (Array.isArray(result)) return result.flatMap(item => [{ id: `${item.message_id}-q`, role: 'user' as const, content: item.question }, { id: item.message_id, role: 'assistant' as const, content: item.answer, citations: item.citations, grounded: item.grounded }]);
  return result.messages.map(item => ({ id: item.id, role: item.role, content: item.content, citations: item.citations, grounded: item.grounded }));
}

export async function sendQuestion(session: Session, question: string, key: string, signal?: AbortSignal): Promise<Answer> {
  return request(`/conversations/${encodeURIComponent(session.conversation_id)}/messages`, { method: 'POST', body: JSON.stringify({ question }), headers: { 'Idempotency-Key': key }, signal }, answerSchema, session.access_token);
}

export type StreamEvent = { type: 'retrieving' } | { type: 'citation'; citation: Citation } | { type: 'delta'; text: string } | { type: 'complete'; answer: Answer };

export async function streamQuestion(session: Session, question: string, key: string, onEvent: (event: StreamEvent) => void, signal: AbortSignal): Promise<Answer> {
  let response: Response;
  try {
    response = await fetch(`${api}/conversations/${encodeURIComponent(session.conversation_id)}/messages:stream`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, 'Idempotency-Key': key }, body: JSON.stringify({ question }), signal });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError('network_error', 'Could not reach Mobin\'AI. Please try again.');
  }
  if (!response.ok) throw await readError(response);
  if (!response.body) throw new ApiError('stream_unavailable', 'Streaming is unavailable. Please try again.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed: Answer | undefined;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
        const event = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
        const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!event || !data) continue;
        let json: unknown;
        try { json = JSON.parse(data); } catch { throw new ApiError('invalid_stream', 'The answer stream was interrupted.'); }
        if (event === 'retrieving') onEvent({ type: 'retrieving' });
        if (event === 'citation') onEvent({ type: 'citation', citation: citationSchema.parse(json) });
        if (event === 'delta') onEvent({ type: 'delta', text: z.object({ text: z.string() }).parse(json).text });
        if (event === 'complete') { completed = answerSchema.parse(json); onEvent({ type: 'complete', answer: completed }); }
        if (event === 'error') {
          const error = z.object({ code: z.string(), request_id: z.string().optional() }).parse(json);
          throw new ApiError(error.code, 'The answer could not be completed. Please try again.', error.request_id);
        }
      }
    }
  } finally { reader.releaseLock(); }
  if (!completed) throw new ApiError('interrupted_stream', 'The answer stream ended early. Conversation history will be checked.');
  return completed;
}

export async function sendFeedback(session: Session, messageId: string, rating: 'helpful' | 'not_helpful'): Promise<void> {
  await request(`/messages/${encodeURIComponent(messageId)}/feedback`, { method: 'POST', body: JSON.stringify({ rating }) }, z.unknown(), session.access_token);
}
