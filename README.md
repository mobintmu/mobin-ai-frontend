# Mobin'AI frontend

Independent React/TypeScript chat frontend for Mobin Shaterian's writing. Both `/` and `/embed` show only the chat shell; `/embed` is designed for the website iframe. The framework-agnostic popup loader is published at `/embed/v1.js`. The browser calls the separate API directly. No backend, article corpus, or provider secret is included here.

**Integration status:** the backend has not been built. The API adapter follows the [provisional contract](contracts/README.md); production integration must be checked against a pinned backend OpenAPI artifact. The privacy page contains an explicit launch placeholder for the owner's access/deletion contact route and needs approved legal copy before release.

## Try it without a backend

```bash
npm ci
npm run demo
```

Open `http://127.0.0.1:5173/`. Use any test name and email or phone, accept the privacy notice, and ask a question. Turnstile is replaced by a local verification stub. Answers are clearly labeled demo fixtures; they do not search articles or call an AI model. The mock API runs only in the Vite development server, keeps conversations in process memory, and resets when you stop/restart it. Stop with Ctrl+C.

For the iframe page, open `http://127.0.0.1:5173/embed`. To preview it inside the website, run the website with `VITE_MOBIN_AI_ORIGIN=http://127.0.0.1:5173 bun run dev` in a second terminal. The production build does not include the demo API or verification stub.

## Local setup

Node 24+ and npm 11+ are recommended. From this repository:

```bash
npm ci
cp .env.example .env.local
# Set VITE_API_BASE_URL and a public VITE_TURNSTILE_SITE_KEY in .env.local
npm run dev
```

Open `http://localhost:5173`. The app cannot complete registration until a backend and Turnstile public site key are available. For local Turnstile testing, use Cloudflare's official test site key with the matching backend test secret. `VITE_` variables are visible in the browser; never put a private key in them.

```bash
npm run lint
npm run typecheck
npm test
npm run test:browser
npm run test:e2e
npm run build
npm run preview
```

The unit and browser tests use mocked API/Turnstile responses. Playwright needs Chromium installed first: `npx playwright install chromium`. The browser test builds with a test-only public site key, serves the Vite preview, and intercepts the API; it does not contact a model or production backend. The mock is test-only and is not included in the production build.

### Full local end-to-end test

From this repository, run:

```bash
npm ci
npx playwright install chromium
npm run test:e2e
```

The e2e command starts and stops its own demo server on `http://127.0.0.1:5187/`. Do not start that server separately. It uses the real frontend and the local demo API to test registration, a streamed answer, quota changes, refresh recovery, the embedded loader, and mobile layout. It needs no production backend, Turnstile key, or AI model. The answers are demo fixtures, so this test does **not** prove the future production API integration.

To watch the browser run, use `npm run test:e2e -- --headed`. To inspect a failed run, use `npx playwright show-report`. If Playwright Chromium cannot be installed but system Chrome is available, run `PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e` (adjust the path for your machine). The separate `npm run test:browser` suite tests the production build with intercepted API and Turnstile requests.

## Public configuration

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Backend origin, for example `https://api.mobinshaterian.com` |
| `VITE_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key |
| `VITE_CHAT_PUBLIC_URL` | Public chat origin, for documentation/integration |

Only HTTPS origins should be used in production. The backend must allow CORS from `https://chat.mobinshaterian.com` and local development origins, verify Turnstile with its private secret, and authorize every scoped request with the bearer token. See [integration assumptions](contracts/README.md).

## Embed in mobinshaterian.com

The `mobinshaterian.com` root layout now includes this script once, near the closing `</body>` tag:

```html
<script defer src="https://chat.mobinshaterian.com/embed/v1.js"
        data-base-url="https://chat.mobinshaterian.com"></script>
```

The script creates a launcher. It creates the iframe only on first open and keeps all registration, API, and session logic inside the chat origin. It does not read the conversation credential. The website needs no React dependency or backend access. If its CSP is restrictive, allow `script-src https://chat.mobinshaterian.com`, `frame-src https://chat.mobinshaterian.com`, and styles injected by the loader. The sample [Caddyfile](deploy/Caddyfile) allows framing from those two website origins when self-hosting; GitHub Pages does not use that file.

A plain HTML site uses the same script:

```html
<script defer src="https://chat.mobinshaterian.com/embed/v1.js"
        data-launcher-label="Ask Mobin'AI" data-offset-right="24" data-offset-bottom="24"></script>
```

For client-side navigation or manual control:

```html
<script defer src="https://chat.mobinshaterian.com/embed/v1.js" data-mobin-ai-auto="false"></script>
<script>
  // Run after the loader has loaded.
  const widget = window.MobinAI.init({ launcherLabel: "Ask Mobin'AI", initialOpen: false });
  // On app teardown: widget.destroy();
</script>
```

Options: `baseUrl` (HTTPS origin; HTTP localhost for tests), `launcherLabel` (plain text up to 60 characters), `offsetRight` and `offsetBottom` (0–200 pixels), and `initialOpen`. Repeated initialization returns the existing widget. `destroy()` removes listeners and host elements. The loader and iframe exchange only versioned `ready`, `open`, and `close` messages, with an exact origin check; no contact, token, question, or answer crosses `postMessage`.

For a page section or a site-owned popup wrapper, use a plain iframe:

```html
<iframe title="Mobin'AI chat about Mobin's articles"
        src="https://chat.mobinshaterian.com/embed"
        allow="clipboard-write" referrerpolicy="strict-origin-when-cross-origin"
        style="width:100%;min-height:680px;border:0;border-radius:14px"></iframe>
```

Never add tokens, contact details, or questions to the iframe URL. For local cross-origin embed testing, serve a host page at `http://localhost:4173` and the chat build at `http://127.0.0.1:4173` as in the Playwright test, or use two local ports. The production `frame-ancestors` allowlist is stricter than this development arrangement.

## Deployment

For GitHub Pages with Cloudflare DNS, follow [the deployment guide](docs/deploy-github-pages-cloudflare.md).

Build with `npm ci && npm run build` and publish **only** `dist/` to static hosting at `chat.mobinshaterian.com`. [Caddyfile](deploy/Caddyfile) shows TLS hosting, SPA route fallback, separate `/embed` framing policy, CSP, and cache headers for self-hosting. GitHub Pages needs the route fallback described in the deployment guide. Point DNS for `chat.mobinshaterian.com` to the static host and issue TLS there. Do not set `X-Frame-Options: DENY` on `/embed`. Review CSP behavior with Turnstile on the chosen host; the main website's CSP must allow the loader and iframe. Keep the last known-good `dist/` artifact for rollback. The API remains a separately deployed service at `api.mobinshaterian.com`.

The versioned loader URL is a public API. Keep its option names and message protocol compatible within v1; publish `/embed/v2.js` for breaking changes. The loader has a one-hour cache header, while hashed app assets may be cached immutably. HTML is served with `no-cache` so rollbacks are visible promptly.

## Session and privacy model

After registration, the backend returns an opaque scoped bearer token. The iframe keeps it in memory and `sessionStorage` on the chat origin for same-tab refresh recovery. It is cleared on a new session, expiry, or unauthorized response. The quota shown is only from API responses. A different device cannot recover this session. Contact fields are not placed in storage after registration. The frontend does not cache transcripts in a service worker or send personal data to analytics.

Privacy text is a draft. Before launch, approve the content, supply the access/deletion contact route, confirm backend retention operations, and publish the matching policy version.


# Run

npm ci
npm run demo


## Tests

npm ci
npx playwright install chromium
npm run test:e2e