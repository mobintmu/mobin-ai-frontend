import React, { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { ArrowLeft, ArrowUpRight, BookOpen, CircleHelp, Menu, Sparkles, X } from 'lucide-react';
import { Registration } from './components/Registration';
import { Chat } from './components/Chat';
import { ApiError, getConversation, type Quota, type Session } from './lib/api';
import { clearSession, readSession, saveSession } from './lib/session';
import './styles.css';

const isEmbed = window.location.pathname === '/embed';
const parentOrigin = (() => { try { return new URL(document.referrer).origin; } catch { return window.location.origin; } })();
const approvedParent = ['https://mobinshaterian.com', 'https://www.mobinshaterian.com', window.location.origin].includes(parentOrigin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(parentOrigin);
const rootRoute = createRootRoute({ component: () => <Outlet /> });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <Page /> });
const embedRoute = createRoute({ getParentRoute: () => rootRoute, path: '/embed', component: () => <Page embed /> });
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: Privacy });
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/about', component: About });
const router = createRouter({ routeTree: rootRoute.addChildren([indexRoute, embedRoute, privacyRoute, aboutRoute]) });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }

function Brand() { return <span className="brand"><span className="brand-mark">M<span>✦</span></span><span>Mobin<span className="brand-accent">'AI</span></span></span>; }

function Page({ embed = false }: { embed?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [checking, setChecking] = useState(() => !!readSession());
  const [notice, setNotice] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const expire = useCallback(() => { clearSession(); setSession(null); setQuota(null); setNotice('Your previous session has expired. You can start a new conversation below.'); }, []);

  useEffect(() => {
    const stored = readSession();
    if (!stored) return;
    getConversation(stored).then(fresh => { setSession(stored); setQuota(fresh); }).catch((caught: unknown) => {
      if (caught instanceof ApiError && [401, 403].includes(caught.status ?? 0)) expire();
      else setNotice('Could not restore the previous session. Please check your connection and refresh.');
    }).finally(() => setChecking(false));
  }, [expire]);

  useEffect(() => {
    if (!embed) return;
    window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'ready' }, approvedParent ? parentOrigin : window.location.origin);
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== parentOrigin || event.source !== window.parent) return;
      if (event.data?.source === 'mobin-ai-loader' && event.data?.version === 1 && event.data?.type === 'open') document.querySelector<HTMLElement>('.chat-shell button, .chat-shell input, .chat-shell textarea')?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'close' }, approvedParent ? parentOrigin : window.location.origin);
      if (event.key !== 'Tab') return;
      const focusable = Array.from(document.querySelectorAll<HTMLElement>('.chat-shell button:not([disabled]), .chat-shell a[href], .chat-shell input:not([disabled]), .chat-shell textarea:not([disabled])')).filter(element => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('message', onMessage); document.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('message', onMessage); document.removeEventListener('keydown', onKey); };
  }, [embed]);

  useEffect(() => { const update = () => setOnline(navigator.onLine); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);

  function newSession() { clearSession(); setSession(null); setQuota(null); setNotice(null); }
  function complete(next: Session) { saveSession(next); setSession(next); setQuota(next.quota); setNotice(null); }

  return <div className={embed ? 'app embed-app' : 'app standalone-app'}>
    {!embed && <header className="site-header"><a href="/" aria-label="Mobin'AI home"><Brand /></a><nav className={mobileMenu ? 'nav-open' : ''}><a href="/about">About</a><a href="/privacy">Privacy</a><a href="https://mobinshaterian.com" target="_blank" rel="noopener noreferrer">Mobin's writing <ArrowUpRight size={14} /></a></nav><button className="mobile-menu" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button><a className="header-cta" href="#conversation">Open chat <ArrowUpRight size={15} /></a></header>}
    {!embed && <section className="hero"><div className="hero-inner"><div className="hero-copy"><div className="availability"><span className="availability-dot" /> AN INTERACTIVE GUIDE TO MOBIN’S WRITING</div><h1>Good questions<br /><em>go deeper.</em></h1><p>Explore ideas from Mobin Shaterian’s technical articles, one conversation at a time. Ask, follow up, and trace answers back to the source.</p><div className="hero-actions"><a className="hero-primary" href="#conversation">Start a conversation <ArrowUpRight size={18} /></a><a className="hero-secondary" href="/about">How it works <span>↗</span></a></div><div className="hero-note"><span>✦</span> Rooted in published work. Designed for curiosity.</div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="art-core">M<span>✦</span></div><div className="art-label art-label-one">EXPLORE</div><div className="art-label art-label-two">CONNECT</div><div className="art-label art-label-three">DISCOVER</div></div></div></section>}
    <main id="conversation" className={embed ? 'embed-main' : 'main-section'}>
      {!embed && <div className="section-intro"><span className="eyebrow">YOUR CONVERSATION STARTS HERE</span><h2>Ask the work.<br /><span>Follow the thread.</span></h2><p>Get an answer grounded in Mobin's articles, with source links to explore further.</p><div className="section-benefits"><span><BookOpen size={17} /> Cited articles</span><span><Sparkles size={17} /> Thoughtful answers</span><span><CircleHelp size={17} /> Follow-up questions</span></div></div>}
      <section className="chat-shell" aria-label="Mobin'AI chat"><div className="chat-header"><div className="chat-header-brand"><span className="assistant-icon">✦</span><div><strong>Mobin'AI</strong><small>Answers from Mobin's technical writing</small></div></div><div className="header-controls"><span className="online-status"><span /> READY TO EXPLORE</span>{session && <button className="new-session" onClick={newSession}>New session</button>}{embed && <button className="embed-close" aria-label="Close chat" onClick={() => window.parent.postMessage({ source: 'mobin-ai-embed', version: 1, type: 'close' }, approvedParent ? parentOrigin : window.location.origin)}><X size={18} /></button>}</div></div>
        {!online && <div className="session-notice" role="status">You appear to be offline. Your conversation will be available when your connection returns.</div>}
        {notice && <div className="session-notice" role="status">{notice}</div>}
        {checking ? <div className="loading-history">Checking your session…</div> : session && quota ? <Chat key={session.conversation_id} session={session} initialQuota={quota} onExpired={expire} onNewSession={newSession} /> : <Registration onComplete={complete} />}
      </section>
      {!embed && <div className="below-chat"><span>GOOD TO KNOW</span><p>Mobin'AI can help navigate published ideas. It may miss context or make mistakes, so use source articles to verify important details.</p></div>}
    </main>
    {!embed && <footer className="site-footer"><div><Brand /><p>A thoughtful way to explore technical writing.</p></div><div className="footer-links"><a href="/about">About</a><a href="/privacy">Privacy</a><a href="https://mobinshaterian.com" target="_blank" rel="noopener noreferrer">Mobin's website</a></div><span>© {new Date().getFullYear()} Mobin'AI</span></footer>}
  </div>;
}

function DocumentPage({ title, children }: { title: string; children: React.ReactNode }) { return <div className="document-page"><header><a href="/"><Brand /></a><a href="/" className="back-link"><ArrowLeft size={16} /> Back to chat</a></header><main><span className="eyebrow">MOBIN'AI / INFORMATION</span><h1>{title}</h1>{children}</main></div>; }
function Privacy() { return <DocumentPage title="Privacy notice"><p className="document-lead">This notice describes the planned Mobin'AI data practices. Final text and contact details require owner approval before launch.</p><h2>What we collect</h2><p>We collect your given and family names, an email address or phone number, your privacy and optional marketing choices, and the questions and answers in your conversation. The backend may process your IP address for service security and abuse prevention.</p><h2>Why we use it</h2><p>We use these details to provide the chat service, support service-related follow-up, protect the service, and improve answer quality. We send marketing updates only when you choose the separate optional consent box.</p><h2>Retention</h2><p>The planned retention period is 12 months. The service owner must finalize and operate the deletion process before launch.</p><h2>Access or deletion requests</h2><p className="launch-placeholder"><strong>Launch placeholder:</strong> Add the site owner's approved contact email or request page here before going live.</p><h2>Session access</h2><p>Your conversation credential is kept in this browser tab's session storage. This MVP does not offer accounts or recovery on another device.</p><p className="document-updated">Draft version: 2026-09-25</p></DocumentPage>; }
function About() { return <DocumentPage title="About Mobin'AI"><p className="document-lead">A conversational guide to Mobin Shaterian's published technical writing.</p><h2>How it works</h2><p>Ask a question in English or Persian. The separate Mobin'AI backend retrieves relevant material from Mobin's articles and generates an English answer. When sources support an answer, their article links appear alongside it.</p><h2>What to expect</h2><p>Answers are generated and may be incomplete or wrong. Follow the linked articles for full context. If the available writing does not support a confident answer, Mobin'AI should say so.</p><h2>Conversation limit</h2><p>A conversation credential permits up to 100 accepted questions. The backend reports the authoritative remaining count and any additional temporary rate limits.</p><a className="hero-primary" href="/">Start a conversation <ArrowUpRight size={16} /></a></DocumentPage>; }

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>);
if (isEmbed) document.documentElement.classList.add('embed-document');
