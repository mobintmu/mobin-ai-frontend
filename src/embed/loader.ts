(() => {
type Options = { baseUrl?: string; launcherLabel?: string; offsetRight?: number; offsetBottom?: number; initialOpen?: boolean };
type Instance = { open: () => void; close: () => void; destroy: () => void };

const SCRIPT_VERSION = 1;
const DEFAULT_ORIGIN = 'https://chat.mobinshaterian.com';
let active: Instance | null = null;

function normalizeOptions(options: Options = {}) {
  const origin = new URL(options.baseUrl || DEFAULT_ORIGIN);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(origin.hostname))) throw new Error('MobinAI baseUrl must use HTTPS.');
  if (origin.username || origin.password || origin.search || origin.hash) throw new Error('MobinAI baseUrl must be an origin.');
  const label = options.launcherLabel || 'Ask Mobin\'AI';
  if (typeof label !== 'string' || label.length > 60) throw new Error('Invalid launcherLabel.');
  const right = options.offsetRight ?? 24;
  const bottom = options.offsetBottom ?? 24;
  if (![right, bottom].every(value => Number.isFinite(value) && value >= 0 && value <= 200)) throw new Error('Offsets must be between 0 and 200 pixels.');
  return { origin: origin.origin, label, right, bottom, initialOpen: options.initialOpen === true };
}

function init(options?: Options): Instance {
  if (active) return active;
  const config = normalizeOptions(options);
  const host = document.createElement('div'); host.id = 'mobin-ai-widget';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host{all:initial}.launcher{position:fixed;z-index:2147483646;right:calc(${config.right}px + env(safe-area-inset-right));bottom:calc(${config.bottom}px + env(safe-area-inset-bottom));border:1px solid #e5b98b;background:#17191b;color:#f8f1e9;border-radius:99px;min-height:56px;padding:0 19px;display:flex;align-items:center;gap:11px;font:600 14px system-ui,sans-serif;box-shadow:0 12px 35px #0005;cursor:pointer}.launcher:focus-visible,.close:focus-visible{outline:3px solid #f0b77c;outline-offset:3px}.spark{font-size:24px;color:#f0b77c}.panel{position:fixed;z-index:2147483647;right:calc(${config.right}px + env(safe-area-inset-right));bottom:calc(${config.bottom + 72}px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 32px));height:min(690px,calc(100dvh - 112px));min-height:350px;border:1px solid #414145;border-radius:18px;background:#101114;box-shadow:0 28px 90px #0009;overflow:hidden;display:none}.panel.open{display:block}.panel iframe{border:0;width:100%;height:100%;display:block}.close{position:absolute;right:10px;top:10px;z-index:2;border:0;border-radius:50%;background:#27292b;color:white;width:30px;height:30px;cursor:pointer}@media(max-width:600px){.launcher{right:calc(16px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom))}.panel{inset:0;width:100vw;height:100dvh;min-height:0;border:0;border-radius:0}}`;
  const launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button'; launcher.setAttribute('aria-label', config.label); launcher.setAttribute('aria-expanded', 'false');
  const spark = document.createElement('span'); spark.className = 'spark'; spark.setAttribute('aria-hidden', 'true'); spark.textContent = '✦';
  const label = document.createElement('span'); label.textContent = config.label;
  launcher.append(spark, label);
  const panel = document.createElement('div'); panel.className = 'panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', "Mobin'AI chat");
  const closeButton = document.createElement('button'); closeButton.className = 'close'; closeButton.type = 'button'; closeButton.setAttribute('aria-label', 'Close chat'); closeButton.textContent = '×'; panel.append(closeButton);
  let frame: HTMLIFrameElement | null = null;
  const onMessage = (event: MessageEvent) => { if (event.origin !== config.origin || event.source !== frame?.contentWindow || event.data?.source !== 'mobin-ai-embed' || event.data?.version !== SCRIPT_VERSION) return; if (event.data.type === 'close') close(); };
  const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && panel.classList.contains('open')) close(); };
  function open() {
    if (!frame) { frame = document.createElement('iframe'); frame.src = `${config.origin}/embed`; frame.title = "Mobin'AI chat with article citations"; frame.setAttribute('allow', 'clipboard-write'); frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin'); panel.append(frame); }
    panel.classList.add('open'); launcher.setAttribute('aria-expanded', 'true'); launcher.style.display = 'none'; frame.addEventListener('load', () => frame?.contentWindow?.postMessage({ source: 'mobin-ai-loader', version: SCRIPT_VERSION, type: 'open' }, config.origin), { once: true }); frame.focus();
  }
  function close() { panel.classList.remove('open'); launcher.style.display = ''; launcher.setAttribute('aria-expanded', 'false'); launcher.focus(); }
  function destroy() { window.removeEventListener('message', onMessage); document.removeEventListener('keydown', onKey); host.remove(); active = null; }
  launcher.addEventListener('click', open); closeButton.addEventListener('click', close); window.addEventListener('message', onMessage); document.addEventListener('keydown', onKey);
  shadow.append(style, launcher, panel); document.body.append(host);
  active = { open, close, destroy };
  if (config.initialOpen) open();
  return active;
}

window.MobinAI ||= { init, destroy: () => active?.destroy() };
const script = document.currentScript as HTMLScriptElement | null;
if (script?.dataset.mobinAiAuto !== 'false') {
  const start = () => window.MobinAI!.init({ baseUrl: script?.dataset.baseUrl, launcherLabel: script?.dataset.launcherLabel, offsetRight: script?.dataset.offsetRight ? Number(script.dataset.offsetRight) : undefined, offsetBottom: script?.dataset.offsetBottom ? Number(script.dataset.offsetBottom) : undefined, initialOpen: script?.dataset.initialOpen === 'true' });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
}


})();
