import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, RotateCcw, Square, ThumbsDown, ThumbsUp } from 'lucide-react';
import { ApiError, getConversation, getHistory, sendFeedback, sendQuestion, streamQuestion, type Answer, type Message, type Quota, type Session } from '../lib/api';
import { Markdown, safeUrl } from './Markdown';

const suggestions = [
  'How does Mobin approach scalable data pipelines?',
  'What has Mobin written about PostgreSQL performance?',
  'How should I design a reliable analytics stack?',
];

function Sources({ message }: { message: Message }) {
  const cited = message.citations ?? [];
  const ordered = [...cited].sort((a, b) => {
    const ai = message.content.indexOf(`[${a.citation_id}]`);
    const bi = message.content.indexOf(`[${b.citation_id}]`);
    return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
  });
  if (!ordered.length) return null;
  return <div className="sources"><div className="sources-label">SOURCES <span>{ordered.length.toString().padStart(2, '0')}</span></div><div className="source-grid">{ordered.map((source, index) => {
    const url = safeUrl(source.url);
    return url && <a className="source-card" key={source.citation_id} href={url} target="_blank" rel="noopener noreferrer"><span className="source-index">{String(index + 1).padStart(2, '0')} / ARTICLE <ExternalLink size={13} /></span><strong>{source.title}</strong>{source.snippet && <span className="source-snippet">{source.snippet}</span>}</a>;
  })}</div></div>;
}

export function Chat({ session, onExpired, onNewSession, initialQuota }: { session: Session; onExpired: () => void; onNewSession: () => void; initialQuota: Quota }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [quota, setQuota] = useState(initialQuota);
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<'loading-history' | 'ready' | 'sending' | 'streaming' | 'rate-limited' | 'quota-exhausted'>('loading-history');
  const [status, setStatus] = useState('Loading conversation…');
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ question: string; key: string } | null>(null);
  const [showJump, setShowJump] = useState(false);
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const composing = useRef(false);

  useEffect(() => {
    let active = true;
    Promise.all([getConversation(session), getHistory(session)]).then(([freshQuota, history]) => {
      if (!active) return;
      setQuota(freshQuota); setMessages(history); setPhase(freshQuota.remaining <= 0 ? 'quota-exhausted' : 'ready'); setStatus('Conversation ready');
    }).catch((caught: unknown) => {
      if (!active) return;
      if (caught instanceof ApiError && [401, 403].includes(caught.status ?? 0)) { onExpired(); return; }
      setError(caught instanceof ApiError ? caught.message : 'Could not load this conversation.'); setPhase('ready'); setStatus('Conversation could not be loaded');
    });
    return () => { active = false; abortRef.current?.abort(); };
  }, [session, onExpired]);

  useEffect(() => { if (nearBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); else setShowJump(true); }, [messages]);

  async function reconcile() {
    try {
      const [freshQuota, history] = await Promise.all([getConversation(session), getHistory(session)]);
      setQuota(freshQuota); setMessages(history); setPhase(freshQuota.remaining <= 0 ? 'quota-exhausted' : 'ready');
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status ?? 0)) onExpired();
      else setPhase('ready');
    }
  }

  function addAnswer(answer: Answer, userId: string) {
    setMessages(current => {
      const withoutPending = current.filter(item => item.id !== 'pending');
      if (withoutPending.some(item => item.id === answer.message_id)) return withoutPending;
      return withoutPending.map(item => item.id === userId ? { ...item, id: `${answer.message_id}-q` } : item).concat({ id: answer.message_id, role: 'assistant', content: answer.answer, citations: answer.citations, grounded: answer.grounded });
    });
    setQuota(answer.quota); setPhase(answer.quota.remaining <= 0 ? 'quota-exhausted' : 'ready'); setStatus('Answer complete'); setRetry(null);
  }

  async function submit(question: string, key: string = crypto.randomUUID(), fromRetry = false) {
    const trimmed = question.trim();
    if (!trimmed || trimmed.length > 2000 || phase === 'sending' || phase === 'streaming' || phase === 'rate-limited' || quota.remaining <= 0) return;
    const userId = fromRetry ? `retry-${key}` : crypto.randomUUID();
    if (!fromRetry) setMessages(current => current.concat({ id: userId, role: 'user', content: trimmed }));
    setDraft(''); setError(null); setReference(null); setRetry({ question: trimmed, key }); setPhase('sending'); setStatus('Finding relevant articles');
    setMessages(current => current.concat({ id: 'pending', role: 'assistant', content: '', pending: true }));
    const controller = new AbortController(); abortRef.current = controller;
    try {
      let answer: Answer;
      try {
        answer = await streamQuestion(session, trimmed, key, event => {
          if (event.type === 'delta') { setPhase('streaming'); setStatus('Writing an answer'); setMessages(current => current.map(item => item.id === 'pending' ? { ...item, content: item.content + event.text } : item)); }
          if (event.type === 'retrieving') setStatus('Finding relevant articles');
        }, controller.signal);
      } catch (caught) {
        if (caught instanceof ApiError && [404, 405, 501].includes(caught.status ?? 0)) answer = await sendQuestion(session, trimmed, key, controller.signal);
        else throw caught;
      }
      addAnswer(answer, userId);
    } catch (caught) {
      setMessages(current => current.filter(item => item.id !== 'pending'));
      if (controller.signal.aborted) { setStatus('Request cancelled; checking conversation'); await reconcile(); return; }
      const apiError = caught instanceof ApiError ? caught : new ApiError('interrupted_stream', 'The request was interrupted. Check the conversation before retrying.');
      if ([401, 403].includes(apiError.status ?? 0)) { onExpired(); return; }
      if (apiError.code === 'quota_exhausted') { await reconcile(); return; }
      if (apiError.code === 'rate_limited') { setPhase('rate-limited'); const seconds = apiError.retryAfter ?? 60; window.setTimeout(() => { setPhase(current => current === 'rate-limited' ? 'ready' : current); }, seconds * 1000); } else setPhase('ready');
      setError(apiError.message + (apiError.retryAfter ? ` Try again in ${apiError.retryAfter} seconds.` : ''));
      setReference(apiError.requestId ?? null);
      setStatus('Answer unavailable');
      if (['interrupted_stream', 'invalid_stream', 'network_error'].includes(apiError.code)) await reconcile();
    } finally { abortRef.current = null; }
  }

  async function vote(messageId: string, rating: 'helpful' | 'not_helpful') {
    try { await sendFeedback(session, messageId, rating); setFeedback(current => ({ ...current, [messageId]: rating })); }
    catch { setError('Feedback could not be saved. Please try again.'); }
  }

  const busy = phase === 'sending' || phase === 'streaming';
  const rateLimited = phase === 'rate-limited';
  return <div className="chat-content">
    <div className="chat-meta"><span className="eyebrow">CONVERSATION / 001</span><span className="quota-chip">{quota.remaining} of {quota.limit} questions remaining</span></div>
    <div className="transcript" ref={scrollRef} onScroll={event => { const target = event.currentTarget; nearBottom.current = target.scrollHeight - target.scrollTop - target.clientHeight < 100; if (nearBottom.current) setShowJump(false); }}>
      {phase === 'loading-history' && <div className="loading-history">Loading your conversation…</div>}
      {messages.length === 0 && phase !== 'loading-history' && <div className="empty-state"><div className="empty-glyph">✦</div><span className="eyebrow">A PLACE TO START</span><h2>Curiosity looks good on you.</h2><p>Ask about ideas from Mobin’s technical writing. Answers draw from published articles and link back to their sources.</p><div className="suggestions">{suggestions.map(item => <button key={item} onClick={() => setDraft(item)} type="button"><span>{item}</span><ArrowUp size={15} /></button>)}</div></div>}
      <div className="message-stack">{messages.map(message => <article className={`message ${message.role}`} key={message.id}>
        <div className="message-avatar" aria-hidden="true">{message.role === 'assistant' ? '✦' : 'Y'}</div>
        <div className="message-body"><div className="message-label">{message.role === 'assistant' ? "MOBIN'AI" : 'YOU'}</div>
          {message.pending && !message.content ? <p className="pending"><span className="pulse-dot" />{status}</p> : message.role === 'assistant' ? <Markdown content={message.content} citations={message.citations} /> : <p dir="auto" className="question-text">{message.content}</p>}
          {message.role === 'assistant' && !message.pending && <>{message.grounded === false && <p className="evidence-note">The available articles may not fully support this answer.</p>}<Sources message={message} /></>}
          {!message.pending && <div className="message-actions"><button type="button" onClick={() => navigator.clipboard.writeText(message.content)} aria-label={`Copy ${message.role === 'assistant' ? 'answer' : 'question'}`}><Copy size={14} /> Copy</button>{message.role === 'assistant' && <><button type="button" onClick={() => vote(message.id, 'helpful')} aria-label="Mark answer helpful" aria-pressed={feedback[message.id] === 'helpful'}><ThumbsUp size={14} /></button><button type="button" onClick={() => vote(message.id, 'not_helpful')} aria-label="Mark answer not helpful" aria-pressed={feedback[message.id] === 'not_helpful'}><ThumbsDown size={14} /></button>{feedback[message.id] && <span className="feedback-saved"><Check size={13} /> Saved</span>}</>}</div>}
        </div>
      </article>)}</div>
    </div>
    {showJump && <button className="jump-button" onClick={() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); setShowJump(false); }}><ArrowDown size={14} /> Jump to latest</button>}
    <div className="composer-area"><div className="sr-only" role="status" aria-live="polite">{status}</div>
      {error && <div className="chat-error" role="alert"><span>{error}{reference && ` Support reference: ${reference}`}</span>{retry && !busy && <button type="button" onClick={() => submit(retry.question, retry.key, true)}><RotateCcw size={14} /> Retry</button>}</div>}
      {rateLimited && <div className="chat-error">Temporary rate limit. You can try again shortly; this does not change your lifetime question quota.</div>}
      {phase === 'quota-exhausted' && <div className="chat-error">This conversation has reached its 100-question limit. <button onClick={onNewSession}>Start a new session</button></div>}
      <form className="composer" onSubmit={event => { event.preventDefault(); void submit(draft); }}><textarea aria-label="Ask a question" placeholder="Ask anything about Mobin’s writing…" value={draft} onChange={event => setDraft(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !composing.current) { event.preventDefault(); void submit(draft); } }} maxLength={2000} disabled={busy || phase === 'quota-exhausted' || phase === 'loading-history' || phase === 'rate-limited'} dir="auto" rows={2} /><div className="composer-bottom"><span>Enter to send · Shift+Enter for a new line <span className="char-count">{draft.length}/2000</span></span>{busy ? <button type="button" className="send-button cancel" onClick={() => abortRef.current?.abort()} aria-label="Cancel response"><Square size={15} /></button> : <button type="submit" className="send-button" disabled={!draft.trim() || phase === 'quota-exhausted' || phase === 'loading-history' || phase === 'rate-limited'} aria-label="Send question"><ArrowUp size={19} /></button>}</div></form>
      <p className="composer-disclaimer">AI answers may be incomplete. Check linked articles for context.</p>
    </div>
  </div>;
}
