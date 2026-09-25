import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { ArrowLeft, X } from 'lucide-react';
import { Registration } from './components/Registration';
import { Chat } from './components/Chat';
import { ApiError, getConversation, type Quota, type Session } from './lib/api';
import { clearSession, readSession, saveSession } from './lib/session';
import './styles.css';

const parentOrigin = (() => {
  try { return new URL(document.referrer).origin; }
  catch { return window.location.origin; }
})();
const approvedParent = ['https://mobinshaterian.com', 'https://www.mobinshaterian.com', window.location.origin].includes(parentOrigin)
  || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parentOrigin);
const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
const chatPath = currentPath === '/' || currentPath === '/embed';
if (chatPath) document.documentElement.classList.add('embed-document');

const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: ChatPage });
const embedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/embed', component: ChatPage });
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: Privacy });
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, embedRoute, privacyRoute]) });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

function ChatPage() {
  const embedded = currentPath === '/embed' && window.parent !== window;
  const [session, setSession] = useState<Session | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [checking, setChecking] = useState(() => !!readSession());
  const [notice, setNotice] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const expire = useCallback(() => {
    clearSession();
    setSession(null);
    setQuota(null);
    setNotice('Your previous session has expired. You can start a new conversation below.');
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('embed-document');
    return () => document.documentElement.classList.remove('embed-document');
  }, []);

  useEffect(() => {
    const stored = readSession();
    if (!stored) return;
    getConversation(stored).then(fresh => {
      setSession(stored);
      setQuota(fresh);
    }).catch((caught: unknown) => {
      if (caught instanceof ApiError && [401, 403].includes(caught.status ?? 0)) expire();
      else setNotice('Could not restore the previous session. Please check your connection and refresh.');
    }).finally(() => setChecking(false));
  }, [expire]);

  useEffect(() => {
    if (!embedded || !approvedParent) return;
    const sendClose = () => window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'close' }, parentOrigin);
    window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'ready' }, parentOrigin);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== parentOrigin || event.source !== window.parent) return;
      if (event.data?.source === 'mobin-ai-loader' && event.data?.version === 1 && event.data?.type === 'open') {
        document.querySelector<HTMLElement>('.chat-shell button, .chat-shell input, .chat-shell textarea')?.focus();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') sendClose();
      if (event.key !== 'Tab') return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('.chat-shell button:not([disabled]), .chat-shell a[href], .chat-shell input:not([disabled]), .chat-shell textarea:not([disabled])'))
        .filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('keydown', onKey);
    };
  }, [embedded]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function newSession() { clearSession(); setSession(null); setQuota(null); setNotice(null); }
  function complete(next: Session) { saveSession(next); setSession(next); setQuota(next.quota); setNotice(null); }
  function close() {
    if (approvedParent) window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'close' }, parentOrigin);
  }

  return <div className="app embed-app">
    <main className="embed-main">
      <section className="chat-shell" aria-label="Mobin'AI chat">
        <div className="chat-header">
          <div className="chat-header-brand"><span className="assistant-icon">✦</span><div><strong>Mobin'AI</strong><small>Answers from Mobin's technical writing</small></div></div>
          <div className="header-controls">
            <span className="online-status"><span /> READY TO EXPLORE</span>
            {session && <button className="new-session" onClick={newSession}>New session</button>}
            {embedded && <button className="embed-close" aria-label="Close chat" onClick={close}><X size={18} /></button>}
          </div>
        </div>
        {!online && <div className="session-notice" role="status">You appear to be offline. Your conversation will be available when your connection returns.</div>}
        {notice && <div className="session-notice" role="status">{notice}</div>}
        {checking ? <div className="loading-history">Checking your session…</div> : session && quota
          ? <Chat key={session.conversation_id} session={session} initialQuota={quota} onExpired={expire} onNewSession={newSession} />
          : <Registration onComplete={complete} />}
      </section>
    </main>
  </div>;
}

function Privacy() {
  return <div className="document-page"><header><a href="/">Mobin'AI</a><a href="/" className="back-link"><ArrowLeft size={16} /> Back to chat</a></header><main>
    <span className="eyebrow">MOBIN'AI / INFORMATION</span><h1>Privacy notice</h1>
    <p className="document-lead">This notice describes the planned Mobin'AI data practices. Final text and contact details require owner approval before launch.</p>
    <h2>What we collect</h2><p>We collect your given and family names, an email address or phone number, your privacy and optional marketing choices, and the questions and answers in your conversation. The backend may process your IP address for service security and abuse prevention.</p>
    <h2>Why we use it</h2><p>We use these details to provide the chat service, support service-related follow-up, protect the service, and improve answer quality. We send marketing updates only when you choose the separate optional consent box.</p>
    <h2>Retention</h2><p>The planned retention period is 12 months. The service owner must finalize and operate the deletion process before launch.</p>
    <h2>Access or deletion requests</h2><p className="launch-placeholder"><strong>Launch placeholder:</strong> Add the site owner's approved contact email or request page here before going live.</p>
    <h2>Session access</h2><p>Your conversation credential is kept in this browser tab's session storage. This MVP does not offer accounts or recovery on another device.</p>
    <p className="document-updated">Draft version: 2026-09-25</p>
  </main></div>;
}

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
