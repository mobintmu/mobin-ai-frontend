# Configure Turnstile for GitHub Pages

If `https://chat.mobinshaterian.com/` shows **“Verification is not configured. Add a public Turnstile site key to enable registration.”**, the deployed frontend was built without a valid `VITE_TURNSTILE_SITE_KEY`. The message comes from `src/components/Turnstile.tsx`. The GitHub Pages workflow passes the GitHub Actions variable into the Vite build; Vite embeds it in the generated JavaScript.

## 1. Create a Cloudflare Turnstile widget

1. Open the [Cloudflare dashboard's Turnstile page](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Select **Add widget**.
3. Give it a name such as `Mobin AI Chat`.
4. Add `chat.mobinshaterian.com` as an allowed hostname. The registration form runs on the chat origin even when shown inside the main website's iframe.
5. Choose a widget mode and create the widget.
6. Copy the **site key**. It is public and belongs in the frontend build. Keep the **secret key** private for the future backend; never put it in a `VITE_` variable or commit it to Git.

See [Cloudflare's widget setup guide](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/).

## 2. Add the GitHub Actions variable

In the `mobintmu/mobin-ai-frontend` repository, open **Settings → Secrets and variables → Actions → Variables → New repository variable** and enter:

```text
Name:  VITE_TURNSTILE_SITE_KEY
Value: <your public Turnstile site key>
```

The workflow's `Build frontend` step reads `${{ vars.VITE_TURNSTILE_SITE_KEY }}`. If you manage this variable on the **github-pages environment** instead, use the same name there and ensure the deployment job can access that environment. See [GitHub's variables guide](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-variables).

Do not paste the placeholder value from `.env.example`; it intentionally does not enable verification. Changing your local `.env.local` does not change the GitHub Pages build.

## 3. Rebuild and deploy

Open **Actions → Deploy chat frontend to GitHub Pages → Run workflow**, select `main`, and wait for the deploy job to succeed. A new push to `main` also runs this workflow. Refresh `https://chat.mobinshaterian.com/` after deployment; if an old page is cached, try a hard refresh or a private window.

The build must run **after** adding the variable because Vite places the site key into the generated browser JavaScript at build time. Changing Cloudflare DNS or the variable alone cannot update an already deployed build.

## 4. Check the result

1. Open `https://chat.mobinshaterian.com/` and confirm the missing-key message is gone and the Turnstile widget appears.
2. If the widget says the hostname is invalid, check that its allowed hostname is `chat.mobinshaterian.com` in Cloudflare Turnstile.
3. If the widget fails to load, inspect the browser console and network panel for blocked requests to `https://challenges.cloudflare.com/turnstile/v0/api.js`.
4. If the missing-key message remains, confirm the variable name is exact, the new workflow run succeeded, and the deployed run used the new build. Do not print the key in workflow logs to debug it.

## Backend status

This change only enables the browser verification widget. Registration and chat still require the planned backend at `https://api.mobinshaterian.com`. That backend must validate each Turnstile token with Cloudflare using the **private secret key**; a visible widget alone does not complete or secure registration. See [Cloudflare's server-side validation guide](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

For a local demonstration before the backend exists, run `npm ci` and `npm run demo`, then open `http://127.0.0.1:5173/`. Demo mode uses local fixtures and does not need a production Turnstile key or backend.
