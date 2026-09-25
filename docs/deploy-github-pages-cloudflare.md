# Deploy Mobin'AI on GitHub Pages with Cloudflare DNS

This guide publishes this repository's static Vite build on **GitHub Pages** at `https://chat.mobinshaterian.com`. Cloudflare manages the DNS record. The main website already loads `https://chat.mobinshaterian.com/embed/v1.js` and opens the chat in an iframe.

GitHub Pages serves the frontend files only. It does not run the future API at `api.mobinshaterian.com`, the local demo server, or the sample [Caddy configuration](../deploy/Caddyfile). Until the backend exists, the page can load but registration and chat cannot work. The production build also needs a public Turnstile site key before registration can be enabled.

## 1. Prepare the GitHub repository

Use [`mobintmu/mobin-ai-frontend`](https://github.com/mobintmu/mobin-ai-frontend) on the `main` branch. Commit and push the frontend source, including `package-lock.json`. Do not commit `node_modules/`, `dist/`, `.env.local`, or a Turnstile **secret** key. The build uses Node.js 24 and `npm ci --include=dev`.

If a production Turnstile site key is available, add it at **Repository → Settings → Secrets and variables → Actions → Variables** as `VITE_TURNSTILE_SITE_KEY`. Add `chat.mobinshaterian.com` to that Turnstile widget's allowed hostnames. `VITE_` values are included in browser code, so this variable must contain only the **public** site key. The backend will need its separate private secret later.

## 2. Add a GitHub Pages workflow

The ready-to-use [Pages workflow](../.github/workflows/deploy-pages.yml) builds `dist/` on every push to `main` (or when run manually) and publishes it through GitHub Actions. Push this file with the frontend source.

The `404.html` copy is needed because this React app has `/embed` and `/privacy` routes, while GitHub Pages has no SPA rewrite rule. Those direct URLs will display the app but **return HTTP 404**. The iframe can still render the chat; check it in a browser after deployment. If you require HTTP 200 for every app route, use a host with rewrite rules or add an edge rewrite in front of GitHub Pages. [GitHub documents custom 404 pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site).

In **Repository → Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. After pushing to `main`, check **Actions → Deploy chat frontend to GitHub Pages** for a successful run. GitHub's [custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes the required artifact and deploy actions.

## 3. Set the custom domain in GitHub

In **Repository → Settings → Pages → Custom domain**, enter `chat.mobinshaterian.com` and save. For an Actions deployment, GitHub stores this setting itself; a `CNAME` file in `dist/` is **not required**. [GitHub custom domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## 4. Add the Cloudflare DNS record

In the Cloudflare zone for `mobinshaterian.com`, open **DNS → Records → Add record**:

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name | `chat` |
| Target | `mobintmu.github.io` |
| Proxy status | **DNS only** (gray cloud) for initial setup |
| TTL | Auto |

Point the record to `mobintmu.github.io`, **without** `/mobin-ai-frontend` or a URL scheme. Do not point `chat` to the apex `mobinshaterian.com`. Remove any conflicting `A`, `AAAA`, or other `CNAME` record for `chat`. The DNS-only setting lets GitHub receive the hostname directly while it checks DNS and provisions HTTPS. [GitHub's subdomain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site), [Cloudflare DNS record instructions](https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/).

Check DNS with:

```bash
dig +short CNAME chat.mobinshaterian.com
```

The result should be `mobintmu.github.io.` while the record is DNS only. Return to **GitHub → Settings → Pages**, wait for the DNS check and certificate, then enable **Enforce HTTPS**. GitHub says the HTTPS option can take up to 24 hours to become available. [GitHub HTTPS instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## 5. Verify the deployment

Open these URLs:

- `https://chat.mobinshaterian.com/` — the chat shell loads.
- `https://chat.mobinshaterian.com/embed/v1.js` — JavaScript loads, rather than an HTML 404 page.
- `https://chat.mobinshaterian.com/embed` — the chat shell loads through the 404 fallback.
- `https://chat.mobinshaterian.com/privacy` — the privacy draft loads through the 404 fallback.
- `https://mobinshaterian.com/` — **Ask Mobin'AI** opens the chat iframe.

If the launcher appears but the iframe is blank, inspect the browser console and the response headers for `/embed`. A restrictive `X-Frame-Options` or `Content-Security-Policy: frame-ancestors` header can prevent framing. The Caddyfile in this repo is **not** applied by GitHub Pages. Also verify that the main website's CSP, if one is configured, permits the chat origin in `script-src` and `frame-src`.

## Cloudflare proxy after the initial setup

You may switch the `chat` CNAME to **Proxied** after GitHub HTTPS works if you need Cloudflare traffic features or response-header rules. This changes where HTTP traffic flows; DNS-only uses GitHub directly. Keep Cloudflare SSL/TLS at **Full (strict)** when GitHub presents a valid certificate for the hostname. A proxied hostname can use a [Cloudflare Response Header Transform Rule](https://developers.cloudflare.com/rules/transform/response-header-modification/) to manage framing headers if needed. Test `/embed` inside the main website after changing proxy or header settings. [Cloudflare proxy status](https://developers.cloudflare.com/dns/proxy-status/), [Full (strict) requirements](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).

## When the backend is ready

Deploy the API separately at `https://api.mobinshaterian.com`. It must allow CORS from `https://chat.mobinshaterian.com` and verify Turnstile with its private secret. Set the public `VITE_TURNSTILE_SITE_KEY` repository variable and rerun the Pages workflow. Finalize the privacy notice's contact placeholder and backend retention process before accepting real users. The local `npm run demo` mock is development-only and is not part of the Pages build.
