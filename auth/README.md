[OAuth Setup](oauth-setup.md) | [API Route](../app/api/auth/README.md) | [Auth Instance](../lib/auth/instance.ts)

---

# Auth

The chat repo is the **canonical host for all shared sign-in UI and auth API logic** across the webroot. Any site that includes `localsite.js` gets auth by pointing at the two JS files below.

## Files

| File | Purpose |
|---|---|
| `js/auth-plugin.js` | Drop-in script for host pages. Injects provider buttons inline into `#accountPanelInserts`, or a floating Sign In button + popup fallback if the panel isn't present. |
| `js/auth-modal.js` | Popup overlay. Lazy-loaded by `auth-plugin.js` only when a popup is needed. Pages with `#accountPanelInserts` never load this file. |
| `css/auth.css` | Styles for `index.html` (standalone auth page). |
| `index.html` | Standalone sign-in page served at `/auth/` or `/chat/auth/`. |
| `oauth-setup.md` | Step-by-step OAuth provider registration guide (all 6 providers). |

## How host pages load the auth plugin

Drop one script tag into any host page:

```html
<!-- webroot mode (chat lives under /chat/) -->
<script src="/chat/auth/js/auth-plugin.js" defer></script>

<!-- chat-repo-only deploy (chat is at the site root) -->
<script src="/auth/js/auth-plugin.js" defer></script>
```

`localsite.js` resolves the correct URL automatically using `docker/webroot.yaml`
(see the `auth:` block). Resolution order:

1. `window.webrootAuth` — injected by the host page or server if overriding defaults
2. `auth:` block in `docker/webroot.yaml`, fetched at runtime
3. Built-in defaults (assumes chat repo at the site root)

## URL resolution — the `/chat` prefix

When the webroot is the deploy root, the chat app lives under `/chat/`. URLs in
`webroot.yaml` therefore start with `/chat`:

```yaml
modal_url_development:  /chat/auth/js/auth-modal.js
plugin_url_development: /chat/auth/js/auth-plugin.js
api_url_development:    http://localhost:3700/api
```

When the deploy root **is** the chat repo itself (some Vercel deployments), the
`/chat` prefix is dropped. The `api_url_*` always points directly at the Node
server (port 3700 locally, `https://modelearth.vercel.app` in production) — never at
a static file server port.

## API

The auth API is served by the Next.js app at `/api/auth/**` (handled by
`app/api/auth/[...all]/route.ts` via better-auth). See
[`app/api/auth/README.md`](../app/api/auth/README.md) for the full architecture.

OAuth provider buttons call `/api/oauth/:provider` which uses top-level navigation
(not `fetch`) to avoid third-party cookie restrictions in incognito/Firefox.

## First-time setup

`BETTER_AUTH_SECRET` is required before any provider will work — without it the
server won't start.

**Local** (`docker/.env`): any strong random value works. Sessions stay local
because `api_url_development` in `docker/webroot.yaml` always points to
`localhost:3700`, never to Vercel.

```
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
```

**Vercel** (Settings → [choose Production] → Environment Variables): set its own
independent `BETTER_AUTH_SECRET` (generate a separate value). Also set:
- `BETTER_AUTH_BASE_URL` → `https://modelearth.vercel.app`
- each provider's `CLIENT_ID` / `CLIENT_SECRET` pair

The two secrets do not need to match — local and Vercel are separate deployments
with separate sessions. Vercel cannot generate this value automatically: it only
stores env vars and has no knowledge of what they mean. better-auth requires the
secret to exist at startup and has no persistent store to save a generated value
between serverless deployments.

See [oauth-setup.md — Environment Variables](oauth-setup.md#env-vars) for the
full variable list.

## Adding a provider

1. Register the OAuth app and get credentials — see [oauth-setup.md](oauth-setup.md).
2. Add `PROVIDER_CLIENT_ID` and `PROVIDER_CLIENT_SECRET` to `docker/.env`.
3. The provider auto-enables in `lib/auth/instance.ts` when both vars are present.
