# Prompt: integrate Mobin'AI into mobinshaterian.com

Use this prompt to implement and verify the website widget. Work in these local repositories:

- Main website: `../mobinshaterian.com`
- Chat frontend: `../mobin-ai-frontend`

The production origins are `https://mobinshaterian.com` and `https://chat.mobinshaterian.com`. The backend does not exist yet. Complete the website integration and verify it with the chat frontend's local demo mode; do not invent or deploy a backend.

## Start with the existing integration

Read the relevant project instructions, documentation, source, deployment workflow, and tests before editing. The main website's `src/routes/__root.tsx` already loads `https://chat.mobinshaterian.com/embed/v1.js` from its root layout, and the chat frontend already builds that loader from `src/embed/loader.ts`. Inspect both implementations and update them as needed. Ensure the root layout loads **one** widget on every page, including after client-side navigation. Do not add a second launcher or duplicate script.

## Widget behavior

1. Pin the widget to the bottom-right of every page. Keep it above site content with a sufficiently high `z-index` (at least `999999`). Its container must not change the page's layout, horizontal width, or normal scroll behavior.
2. Show only a circular chat-icon launcher when collapsed. Make its tappable area at least `56px × 56px`. The initial state is collapsed for a visitor without a saved preference.
3. On launcher activation, open a chat panel around `380px × 600px` on desktop. Provide a visible close/minimize button that returns to the launcher.
4. On viewports narrower than `480px`, size the panel to nearly the full available width and about `90%` of the viewport height. Respect safe-area insets and keep the panel usable with a mobile keyboard. Do not lock or disturb the host page's scroll when the panel is closed.
5. Save only the widget's open/closed preference in the **main site's** `localStorage`. Restore it across reloads and page navigations. Handle unavailable or disabled storage gracefully. Never put chat credentials, personal data, questions, or answers in this preference.
6. Load the chat iframe only on the first open, including when restoring a saved open state. Do not fetch the iframe or full chat application merely because the page loaded in the default collapsed state. Reuse the iframe after closing and reopening if practical.
7. Make repeated loader execution idempotent. Preserve a clean unmount/destroy path if the existing loader provides one. Isolate widget CSS from the host site, preferably with the existing Shadow DOM approach.

## Embedding and headers

Use the existing versioned loader at `https://chat.mobinshaterian.com/embed/v1.js` and its embeddable iframe route if they work. If they do not, repair them. A direct iframe wrapper is the fallback. Set `allow="microphone; clipboard-write"` and a descriptive `title` on the iframe. Keep its URL at the chat origin, with no token or personal information in the query string.

Check the actual response headers for the embeddable page. If `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` blocks the main website, update the server configuration under the team's control to allow `https://mobinshaterian.com` and, if needed, `https://www.mobinshaterian.com`. Do not remove a useful frame policy without replacing it with an appropriate allowlist. Check the main site's CSP too: it must allow the chat script in `script-src` and the iframe in `frame-src` if those directives are configured. Document any restriction imposed by GitHub Pages or Cloudflare that cannot be changed in this repository.

Distinguish iframe loading from cross-origin JavaScript requests: an iframe navigation and a classic script tag do not require CORS. Configure `Access-Control-Allow-Origin: https://mobinshaterian.com` only for chat-origin resources that the main-site JavaScript actually fetches with XHR/fetch, including preflight handling when required. Chat-iframe API requests originate from `https://chat.mobinshaterian.com`; document the separate backend CORS requirement for when the backend is created. Do not add unnecessary browser fetches between the two sites.

## Accessibility and interaction

- Use real buttons for launcher and close controls, each with a meaningful `aria-label`. Native button behavior must support Enter and Space.
- Expose the launcher state with `aria-expanded` and connect it to the panel with `aria-controls` where applicable.
- When opened, move focus into the iframe once it is ready, or to a usable control in the panel while it loads. When closed, return focus to the launcher. Support Escape to close when focus is in the parent widget and coordinate with the iframe for Escape inside it.
- Keep visible focus indicators and a clear accessible name for the iframe and panel. Do not create a keyboard trap.
- Accept cross-origin `postMessage` events only from the configured chat origin and the widget's iframe window. Never exchange credentials or chat content through these events.

## Files and handoff

Implement the smallest maintainable change across the two repositories. Keep the chat UI and loader in `mobin-ai-frontend`; the main website should contain only the global integration reference and any necessary site-side configuration. Provide a copy-paste HTML snippet for a plain HTML site, placed immediately before `</body>`, for example:

```html
<script defer src="https://chat.mobinshaterian.com/embed/v1.js"
        data-base-url="https://chat.mobinshaterian.com"></script>
```

Provide the actual CSS and JavaScript in repository files, or inline in the snippet if a standalone fallback is necessary. Explain the location of each file, how the website root layout loads it, how the iframe is loaded on first open, and how to configure the chat origin for local testing. Do not tell someone to embed a JSON file; the widget is a JavaScript loader and iframe.

## Verification and completion

Build and test both affected repositories. Use browser tests or an equivalent real-browser check for: default collapsed state; circular `56px` launcher; first-click lazy iframe creation; desktop and mobile panel dimensions; close/reopen; saved state across reload and navigation; Enter/Space, Escape, focus movement and return; iframe `allow` and `title`; duplicate-script safety; and no horizontal overflow or layout shift on the host site. Test with local demo mode because the production backend is not available.

Check the production chat page and loader URLs, iframe response status, and relevant frame/CORS headers. If a production deployment is required to make the live website match the local implementation, state the exact deployment steps and which repository needs deploying. Report changed files, verification results, and any hosting limitation that remains. Do not claim the live site is fixed until it has been deployed and checked.
