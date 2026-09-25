(() => {
  type Options = {
    baseUrl?: string;
    launcherLabel?: string;
    offsetRight?: number;
    offsetBottom?: number;
    initialOpen?: boolean;
  };
  type Instance = { open: () => void; close: () => void; destroy: () => void };

  const SCRIPT_VERSION = 1;
  const STORAGE_KEY = 'mobin-ai-widget-open-v1';
  const DEFAULT_ORIGIN = 'https://chat.mobinshaterian.com';
  let active: Instance | null = null;

  function normalizeOptions(options: Options = {}) {
    const url = new URL(options.baseUrl || DEFAULT_ORIGIN);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('MobinAI baseUrl must use HTTPS.');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('MobinAI baseUrl must be an origin.');
    }
    const label = options.launcherLabel || "Ask Mobin'AI";
    if (typeof label !== 'string' || label.length > 60) throw new Error('Invalid launcherLabel.');
    const right = options.offsetRight ?? 24;
    const bottom = options.offsetBottom ?? 24;
    if (![right, bottom].every(value => Number.isFinite(value) && value >= 0 && value <= 200)) {
      throw new Error('Offsets must be between 0 and 200 pixels.');
    }
    return { origin: url.origin, label, right, bottom, initialOpen: options.initialOpen === true };
  }

  function savedOpen(): boolean | null {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      return value === null ? null : value === 'open';
    } catch {
      return null;
    }
  }

  function saveOpen(open: boolean) {
    try { window.localStorage.setItem(STORAGE_KEY, open ? 'open' : 'closed'); }
    catch { /* The widget still works when storage is unavailable. */ }
  }

  function init(options?: Options): Instance {
    if (active) return active;
    const config = normalizeOptions(options);
    const host = document.createElement('div');
    host.id = 'mobin-ai-widget';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none}
      *,*::before,*::after{box-sizing:border-box}
      .launcher,.panel{position:fixed;pointer-events:auto;font-family:system-ui,sans-serif}
      .launcher{right:calc(${config.right}px + env(safe-area-inset-right));bottom:calc(${config.bottom}px + env(safe-area-inset-bottom));width:56px;height:56px;min-width:56px;min-height:56px;padding:0;display:grid;place-items:center;border:1px solid #e5b98b;border-radius:50%;background:#17191b;color:#f8f1e9;box-shadow:0 12px 35px #0008;cursor:pointer}
      .launcher[hidden]{display:none}
      .launcher svg{width:27px;height:27px;stroke:#f0b77c}
      .launcher:hover{background:#282326}
      .launcher:focus-visible,.close:focus-visible{outline:3px solid #f0b77c;outline-offset:3px}
      .panel{right:calc(${config.right}px + env(safe-area-inset-right));bottom:calc(${config.bottom + 72}px + env(safe-area-inset-bottom));width:min(380px,calc(100vw - 24px));height:min(600px,calc(100dvh - 112px));min-height:0;display:none;overflow:hidden;border:1px solid #414145;border-radius:18px;background:#101114;box-shadow:0 28px 90px #0009}
      .panel.open{display:block}
      .panel iframe{display:block;width:100%;height:100%;border:0}
      .close{position:absolute;z-index:2;top:10px;right:10px;width:36px;height:36px;display:grid;place-items:center;border:1px solid #666;border-radius:50%;background:#27292b;color:white;font-size:25px;line-height:1;cursor:pointer}
      @media(max-width:479px){
        .launcher{right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom))}
        .panel{right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));width:calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right));height:min(90dvh,calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)));border-radius:14px}
      }
    `;

    const launcher = document.createElement('button');
    launcher.className = 'launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', config.label);
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'mobin-ai-panel');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l.9-4.5a9 9 0 0 1-.9-4A8.5 8.5 0 0 1 11.5 3H12a8 8 0 0 1 8 8v.5Z"/><path d="M8 11.5h8M8 15h5"/></svg>';

    const panel = document.createElement('div');
    panel.id = 'mobin-ai-panel';
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', "Mobin'AI chat");

    const closeButton = document.createElement('button');
    closeButton.className = 'close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close chat');
    closeButton.textContent = '×';
    panel.append(closeButton);

    let frame: HTMLIFrameElement | null = null;
    let frameReady = false;
    const sendOpen = () => frame?.contentWindow?.postMessage(
      { source: 'mobin-ai-loader', version: SCRIPT_VERSION, type: 'open' }, config.origin,
    );
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== config.origin || event.source !== frame?.contentWindow
        || event.data?.source !== 'mobin-ai-embed' || event.data?.version !== SCRIPT_VERSION) return;
      if (event.data.type === 'ready') {
        frameReady = true;
        if (panel.classList.contains('open')) { frame?.focus(); sendOpen(); }
      } else if (event.data.type === 'close') close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && panel.classList.contains('open')) close();
    };

    function open() {
      if (!frame) {
        frame = document.createElement('iframe');
        frame.src = `${config.origin}/embed`;
        frame.title = "Mobin'AI chat with article citations";
        frame.setAttribute('allow', 'microphone; clipboard-write');
        frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
        panel.append(frame);
      }
      panel.classList.add('open');
      launcher.setAttribute('aria-expanded', 'true');
      launcher.hidden = true;
      saveOpen(true);
      closeButton.focus();
      if (frameReady) { frame.focus(); sendOpen(); }
    }

    function close() {
      panel.classList.remove('open');
      launcher.hidden = false;
      launcher.setAttribute('aria-expanded', 'false');
      saveOpen(false);
      launcher.focus();
    }

    function destroy() {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('keydown', onKey);
      launcher.removeEventListener('click', open);
      closeButton.removeEventListener('click', close);
      host.remove();
      active = null;
    }

    launcher.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    window.addEventListener('message', onMessage);
    document.addEventListener('keydown', onKey);
    shadow.append(style, launcher, panel);
    document.body.append(host);
    active = { open, close, destroy };
    if (savedOpen() ?? config.initialOpen) open();
    return active;
  }

  window.MobinAI ||= { init, destroy: () => active?.destroy() };
  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.dataset.mobinAiAuto !== 'false') {
    const start = () => window.MobinAI!.init({
      baseUrl: script?.dataset.baseUrl,
      launcherLabel: script?.dataset.launcherLabel,
      offsetRight: script?.dataset.offsetRight ? Number(script.dataset.offsetRight) : undefined,
      offsetBottom: script?.dataset.offsetBottom ? Number(script.dataset.offsetBottom) : undefined,
      initialOpen: script?.dataset.initialOpen === 'true',
    });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
  }
})();
