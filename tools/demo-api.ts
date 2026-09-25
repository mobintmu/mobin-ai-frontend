import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

type DemoMessage = { id: string; role: 'user' | 'assistant'; content: string; citations?: Array<{ citation_id: string; title: string; url: string; snippet: string }>; grounded?: boolean };
type DemoConversation = { token: string; used: number; messages: DemoMessage[]; answers: Map<string, Record<string, unknown>> };

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function bodyOf(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (Buffer.concat(chunks).length > 16_384) throw new Error('Request too large');
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

export function demoApiPlugin(): Plugin {
  const grants = new Map<string, string>();
  const conversations = new Map<string, DemoConversation>();
  return {
    name: 'mobin-ai-local-demo-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/v1', async (request, response, next) => {
        const path = (request.url ?? '').split('?')[0];
        const method = request.method ?? 'GET';
        const id = path.match(/^\/conversations\/([^/]+)(?:\/(messages(?::stream)?))?$/)?.[1];
        const conversation = id ? conversations.get(id) : undefined;
        const authorized = conversation && request.headers.authorization === `Bearer ${conversation.token}`;
        try {
          if (method === 'POST' && path === '/clients') {
            const data = await bodyOf(request);
            if (!data.given_name || !data.family_name || (!data.email && !data.phone) || data.privacy_accepted !== true || data.turnstile_token !== 'local-demo-verification') return send(response, 422, { code: 'validation_error', message: 'Invalid demo registration.' });
            const clientId = crypto.randomUUID(), grant = crypto.randomUUID();
            grants.set(clientId, grant);
            return send(response, 200, { client_id: clientId, registration_grant: grant });
          }
          if (method === 'POST' && path === '/conversations') {
            const data = await bodyOf(request);
            const clientId = String(data.client_id ?? '');
            if (!grants.has(clientId) || grants.get(clientId) !== data.registration_grant) return send(response, 403, { code: 'invalid_grant', message: 'The demo registration grant is invalid.' });
            grants.delete(clientId);
            const conversationId = crypto.randomUUID(), token = `local-demo-${crypto.randomUUID()}`;
            conversations.set(conversationId, { token, used: 0, messages: [], answers: new Map() });
            return send(response, 200, { conversation_id: conversationId, access_token: token, expires_at: new Date(Date.now() + 86_400_000).toISOString(), quota: { limit: 100, used: 0, remaining: 100 } });
          }
          if (id && !authorized) return send(response, 401, { code: 'unauthorized', message: 'Demo session unavailable.' });
          if (id && conversation && method === 'GET' && path === `/conversations/${id}`) return send(response, 200, { conversation_id: id, quota: { limit: 100, used: conversation.used, remaining: 100 - conversation.used } });
          if (id && conversation && method === 'GET' && path === `/conversations/${id}/messages`) return send(response, 200, { messages: conversation.messages });
          if (id && conversation && method === 'POST' && (path.endsWith('/messages') || path.endsWith('/messages:stream'))) {
            const data = await bodyOf(request);
            const question = String(data.question ?? '').trim();
            if (!question || question.length > 2000) return send(response, 422, { code: 'validation_error', message: 'Enter a question up to 2,000 characters.' });
            if (conversation.used >= 100) return send(response, 429, { code: 'quota_exhausted', message: 'Demo quota exhausted.' });
            const key = String(request.headers['idempotency-key'] ?? crypto.randomUUID());
            let answer = conversation.answers.get(key);
            if (!answer) {
              const messageId = crypto.randomUUID();
              const text = `### Local demo answer\n\nYou asked: **${question.replace(/[*_`]/g, '')}**\n\nThis response comes from a local test fixture. It does not search Mobin's articles or call an AI model. The real backend will provide grounded answers and article citations.\n\n1. Try a follow-up question.\n2. Refresh to see same-session recovery while this demo server is running.`;
              answer = { message_id: messageId, conversation_id: id, answer: text, grounded: false, citations: [], quota: { limit: 100, used: ++conversation.used, remaining: 100 - conversation.used }, request_id: crypto.randomUUID() };
              conversation.answers.set(key, answer);
              conversation.messages.push({ id: `${messageId}-q`, role: 'user', content: question }, { id: messageId, role: 'assistant', content: text, citations: [], grounded: false });
            }
            if (path.endsWith(':stream')) {
              response.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
              response.write('event: retrieving\ndata: {}\n\n');
              response.write(`event: delta\ndata: ${JSON.stringify({ text: answer.answer })}\n\n`);
              response.end(`event: complete\ndata: ${JSON.stringify(answer)}\n\n`);
              return;
            }
            return send(response, 200, answer);
          }
          if (method === 'POST' && /^\/messages\/[^/]+\/feedback$/.test(path)) { response.writeHead(204); response.end(); return; }
          next();
        } catch { send(response, 400, { code: 'bad_request', message: 'Invalid demo request.' }); }
      });
    },
  };
}
