import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: { render: (element: HTMLElement, options: Record<string, unknown>) => string; reset: (id: string) => void; remove: (id: string) => void };
  }
}

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true';

export function Turnstile({ onToken, resetSignal }: { onToken: (token: string | null) => void; resetSignal: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (demoMode) { onToken('local-demo-verification'); return; }
    if (!siteKey || siteKey.startsWith('replace-')) return;
    let active = true;
    const mount = () => {
      if (!active || !ref.current || !window.turnstile || widget.current) return;
      widget.current = window.turnstile.render(ref.current, {
        sitekey: siteKey, action: 'client_register', theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => { onToken(null); if (widget.current) window.turnstile?.reset(widget.current); },
        'error-callback': () => { onToken(null); setFailed(true); },
      });
    };
    if (window.turnstile) mount();
    else {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true; script.defer = true; script.onload = mount;
      script.onerror = () => setFailed(true);
      document.head.appendChild(script);
    }
    return () => { active = false; if (widget.current && window.turnstile) window.turnstile.remove(widget.current); widget.current = null; };
  }, [onToken]);

  useEffect(() => { if (demoMode) { onToken('local-demo-verification'); return; } if (widget.current && window.turnstile) { window.turnstile.reset(widget.current); onToken(null); } }, [resetSignal, onToken]);

  if (demoMode) return <p className="verification-note">Local demo verification is active. No data leaves this device.</p>;
  if (!siteKey || siteKey.startsWith('replace-')) return <p className="verification-note">Verification is not configured. Add a public Turnstile site key to enable registration.</p>;
  return <div className="verification"><div ref={ref} />{failed && <p role="alert">Verification could not load. Refresh the page to try again.</p>}</div>;
}
