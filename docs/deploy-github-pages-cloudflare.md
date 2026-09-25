# Build and deploy Mobin'AI with GitHub Pages and Cloudflare DNS

This repository is a Vite frontend. GitHub Actions builds it, GitHub Pages serves the built files, and Cloudflare manages DNS for `chat.mobinshaterian.com`. The main website loads `https://chat.mobinshaterian.com/embed/v1.js` to open the chat iframe.

**The important distinction:** the repository's `index.html` contains `/src/main.tsx` and cannot run directly on GitHub Pages. The **built** `dist/index.html` contains `/assets/...js`. GitHub Pages must publish `dist/` from the custom workflow. A blank white page with `/src/main.tsx` means Pages published the source branch instead.

## 1. Build and check locally

From `/home/mobin/Documents/mobin-ai-frontend`:

```bash
npm ci --include=dev
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run build` runs TypeScript and Vite. It creates `dist/index.html`, `dist/assets/`, and `dist/embed/v1.js`. Verify the result:

```bash
ls dist/index.html dist/embed/v1.js
rg '/assets/' dist/index.html
```

For a local production-build preview, run `npm run preview` and open the URL it prints. For a chat demonstration without the backend, run `npm run demo` instead. Demo mode is available only in the development server; it is not uploaded to Pages.

## 2. Configure the GitHub Pages publishing source

Open [`mobintmu/mobin-ai-frontend` → Settings → Pages](https://github.com/mobintmu/mobin-ai-frontend/settings/pages). Under **Build and deployment → Source**, select **GitHub Actions**. The repository already contains the custom [deployment workflow](../.github/workflows/deploy-pages.yml), so you do not need to add a suggested **Static HTML** or **Jekyll** workflow. GitHub documents this source setting in its [publishing-source guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

The workflow runs on pushes to `main` and can also be started manually. Its steps are:

| Step | What it does |
| --- | --- |
| Install dependencies | Runs `npm ci --include=dev` with Node.js 24. |
| Build frontend | Runs `npm run build`, producing `dist/`. |
| Add route fallback | Copies `dist/index.html` to `dist/404.html` for `/embed` and `/privacy`. |
| Configure and upload Pages | Uploads **`dist/`**, not the repository root. |
| Deploy site | Publishes the uploaded artifact. |

The workflow uses `actions/configure-pages`, `actions/upload-pages-artifact`, and `actions/deploy-pages` as described in [GitHub's custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

### First-time Pages initialization

If **Configure Pages** fails with `Get Pages site failed ... Not Found`, initialize the Pages site in **Settings → Pages**: temporarily select **Deploy from a branch**, choose `main` and `/(root)`, and save. **Immediately switch Source back to GitHub Actions** before running the custom workflow. The branch publisher is only a bootstrap step; it must not remain the publishing source.

If a later workflow named **pages build and deployment** runs after **Deploy chat frontend to GitHub Pages**, it can replace the built site with the raw branch `index.html`. The resulting page is white and `/embed/v1.js` returns 404. Set Source to **GitHub Actions** and rerun the custom deployment. A successful custom workflow run alone does not prove it is the version currently being served.

## 3. Set the custom domain and Cloudflare DNS

In **GitHub → Settings → Pages → Custom domain**, enter `chat.mobinshaterian.com` and save. An Actions deployment does not need a `CNAME` file in `dist/`; the domain is configured in the repository settings. [GitHub custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

In Cloudflare for `mobinshaterian.com`, use this DNS record:

| Type | Name | Target | Proxy status | TTL |
| --- | --- | --- | --- | --- |
| CNAME | `chat` | `mobintmu.github.io` | **DNS only** (gray cloud) | Auto |

Use the GitHub username's `github.io` host without the repository name. Leave the existing apex and `www` records for the main website alone. Do not add another `A`, `AAAA`, or `CNAME` record for `chat`. Check the result:

```bash
dig +short CNAME chat.mobinshaterian.com
```

It should print `mobintmu.github.io.`. If GitHub reports `InvalidDNSError`, check this public answer. A **Proxied** Cloudflare CNAME returns Cloudflare IPs rather than the visible CNAME; switch `chat` to DNS only. If the correct answer is public but GitHub still shows the old error, remove and re-add the custom domain in Pages settings to restart its check. [GitHub DNS troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages), [Cloudflare proxy behavior](https://developers.cloudflare.com/dns/proxy-status/).

When GitHub shows **DNS check successful** and the certificate is active, enable **Enforce HTTPS** in Pages settings. [GitHub HTTPS instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## 4. Run the deployment

1. Confirm **Settings → Pages → Source** says **GitHub Actions**.
2. Open [Actions → Deploy chat frontend to GitHub Pages](https://github.com/mobintmu/mobin-ai-frontend/actions/workflows/deploy-pages.yml).
3. Click **Run workflow**, select `main`, and wait for the **Deploy site** step to succeed. Future pushes to `main` run it automatically.
4. Check that no later **pages build and deployment** branch workflow replaced the custom deployment.

The repository's separate **Frontend checks** workflow runs lint, tests, and a build. It checks code quality but does not publish the site. Only the custom **Deploy chat frontend to GitHub Pages** workflow uploads `dist/`.

## 5. Verify what is live

Run:

```bash
curl -fsS https://chat.mobinshaterian.com/ | rg -o '/(assets/[^" ]+\.js|src/main\.tsx)'
curl -sS -o /dev/null -w '%{http_code} %{content_type}\n' https://chat.mobinshaterian.com/embed/v1.js
```

The first command should show `/assets/...js`, **not** `/src/main.tsx`. The second should show `200` and a JavaScript content type. Then open `https://chat.mobinshaterian.com/` and click the launcher on `https://mobinshaterian.com/`.

The workflow copies `index.html` to `404.html` because GitHub Pages has no SPA rewrite rule. Direct `/embed` and `/privacy` requests can display the app while returning **HTTP 404**. This is a GitHub Pages limitation of this fallback approach; use a host or edge rewrite if those paths must return HTTP 200. [GitHub custom 404 documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site).

## 6. Publish the main website integration

The main website repository has a loader reference in its root layout. Commit and deploy that website change separately. When the website is live, its **Ask Mobin'AI** button loads `/embed/v1.js` from the chat domain and opens `/embed` in an iframe. If the button appears but the iframe is blank, inspect the browser console and the `/embed` response headers for framing restrictions. The sample [Caddyfile](../deploy/Caddyfile) does **not** apply to GitHub Pages.

## Production configuration and Cloudflare proxy

The production build calls `https://api.mobinshaterian.com`. The backend has not been built yet, so the frontend may load but registration and answers will not work. When the backend is ready, it must allow CORS from `https://chat.mobinshaterian.com` and verify Turnstile with a private secret. Add only the **public** Turnstile site key as the repository Actions variable `VITE_TURNSTILE_SITE_KEY`; it is embedded in browser code. Finalize the privacy notice before accepting real users.

Keep the `chat` DNS record **DNS only** while setting up Pages. Proxying through Cloudflare is optional after the built site and HTTPS work. If you enable proxying later, use **Full (strict)** when GitHub presents a valid certificate, then recheck the homepage, loader, iframe, and GitHub DNS status. [Cloudflare proxy status](https://developers.cloudflare.com/dns/proxy-status/), [Full (strict) requirements](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/).
