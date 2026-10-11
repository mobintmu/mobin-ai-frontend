import { ArrowUpRight, BookOpen, CircleHelp, Database, GraduationCap, Lightbulb, Menu, MessagesSquare, Sparkles, TrendingUp, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, getConversation, type Quota, type Session } from '../lib/api';
import { clearSession, readSession, saveSession } from '../lib/session';
import { Chat } from './Chat';
import { Registration } from './Registration';

const capabilities = [
  { icon: Lightbulb, title: 'Explain your idea', body: 'Describe a rough idea and get it clarified, challenged, and shaped into something concrete you can act on.' },
  { icon: TrendingUp, title: 'Grow a billion-dollar idea', body: 'Pressure-test the market, sharpen the positioning, and map a path from concept to company.' },
  { icon: MessagesSquare, title: 'Hold unlimited meetings', body: 'Talk through architecture, planning, and reviews for as long as you need — no calendar required.' },
  { icon: GraduationCap, title: 'Ask university-level questions', body: 'Get clear, structured answers to deep computer-science and software-engineering questions.' },
  { icon: Database, title: 'Interview my knowledge base', body: 'Query everything I have gathered about designing systems and building software.' },
];

function Brand() {
  return <span className="brand"><span className="brand-mark">M<span>✦</span></span><span>Mobin<span className="brand-accent">less</span></span></span>;
}

function ChatSurface() {
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

  return <section className="chat-shell" aria-label="Mobinless chat">
    <div className="chat-header">
      <div className="chat-header-brand"><span className="assistant-icon">✦</span><div><strong>Mobinless</strong><small>Answers from Mobin's knowledge base</small></div></div>
      <div className="header-controls">
        <span className="online-status"><span /> READY TO EXPLORE</span>
        {session && <button type="button" className="new-session" onClick={newSession}>New session</button>}
      </div>
    </div>
    {!online && <div className="session-notice" role="status">You appear to be offline. Your conversation will be available when your connection returns.</div>}
    {notice && <div className="session-notice" role="status">{notice}</div>}
    {checking ? <div className="loading-history">Checking your session…</div> : session && quota
      ? <Chat key={session.conversation_id} session={session} initialQuota={quota} onExpired={expire} onNewSession={newSession} />
      : <Registration onComplete={complete} />}
  </section>;
}

export function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);
  const goToSection = (id: string) => {
    closeMenu();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return <div className="app home-app">
    <header className="site-header">
      <a href="/" aria-label="Mobinless home"><Brand /></a>
      <nav className={menuOpen ? 'nav-open' : ''}>
        <button type="button" onClick={() => goToSection('capabilities')}>What it does</button>
        <button type="button" onClick={() => goToSection('conversation')}>Chat</button>
        <a href="/privacy" onClick={closeMenu}>Privacy</a>
        <a href="https://mobinshaterian.com" target="_blank" rel="noopener noreferrer" onClick={closeMenu}>Mobin's writing <ArrowUpRight size={14} /></a>
      </nav>
      <button type="button" className="mobile-menu" aria-label="Toggle menu" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X /> : <Menu />}</button>
      <a className="header-cta" href="#conversation">Start chatting <ArrowUpRight size={15} /></a>
    </header>

    <section className="hero">
      <div className="hero-inner">
        <div className="hero-copy">
          <div className="availability"><span className="availability-dot" /> MY AI VERSION OF MYSELF</div>
          <h1>Meet<br /><em>Mobinless.</em></h1>
          <p>This is my AI version of myself — I call it “Mobinless.” Explain your idea, get help turning it into a billion-dollar idea, hold unlimited meetings, ask university-level questions and get answers, and even interview my knowledge base.</p>
          <div className="hero-actions">
            <a className="hero-primary" href="#conversation">Start chatting <ArrowUpRight size={18} /></a>
            <a className="hero-secondary" href="#capabilities">See what it can do <span>↗</span></a>
          </div>
          <div className="hero-note"><span>✦</span> Built on everything I’ve gathered about designing systems and software engineering.</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="art-core">M<span>✦</span></div>
          <div className="art-label art-label-one">EXPLAIN</div>
          <div className="art-label art-label-two">BUILD</div>
          <div className="art-label art-label-three">INTERVIEW</div>
        </div>
      </div>
    </section>

    <section className="capabilities" id="capabilities">
      <div className="capabilities-head">
        <span className="eyebrow">ONE ASSISTANT, MANY JOBS</span>
        <h2>Everything you’d bring to a <span>meeting with me.</span></h2>
      </div>
      <div className="capability-grid">
        {capabilities.map(({ icon: Icon, title, body }) => <article className="capability-card" key={title}>
          <span className="capability-icon"><Icon size={20} /></span>
          <h3>{title}</h3>
          <p>{body}</p>
        </article>)}
      </div>
    </section>

    <main id="conversation" className="main-section">
      <div className="section-intro">
        <span className="eyebrow">TALK TO MOBINLESS</span>
        <h2>Ask the work.<br /><span>Follow the thread.</span></h2>
        <p>Explain an idea, plan a system, or ask a university-level question. Every answer is grounded in my writing, with source links to explore further.</p>
        <div className="section-benefits">
          <span><BookOpen size={17} /> Cited articles</span>
          <span><Sparkles size={17} /> Thoughtful answers</span>
          <span><CircleHelp size={17} /> Follow-up questions</span>
        </div>
      </div>
      <ChatSurface />
      <div className="below-chat">
        <span>GOOD TO KNOW</span>
        <p>Mobinless can help navigate published ideas. It may miss context or make mistakes, so use the source articles to verify important details.</p>
      </div>
    </main>

    <footer className="site-footer">
      <div><Brand /><p>A conversational version of how I think.</p></div>
      <div className="footer-links">
        <a href="#capabilities">What it does</a>
        <a href="/privacy">Privacy</a>
        <a href="https://mobinshaterian.com" target="_blank" rel="noopener noreferrer">Mobin's writing</a>
      </div>
      <span>© {new Date().getFullYear()} Mobinless</span>
    </footer>
  </div>;
}
