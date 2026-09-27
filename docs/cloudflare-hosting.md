# Cloudflare Workers preview hosting

Lanternmere has a non-production vinext configuration for evaluating Cloudflare Workers while preserving the normal Next.js development and build paths.

## Current boundary

- `npm run dev` and `npm run build` continue to use Next.js directly.
- `npm run dev:vinext` starts the vinext development server on port 3001.
- `npm run build:vinext` produces the ignored `dist/` Workers bundle.
- `npm run start:vinext` runs that bundle in the local Workers runtime.
- `npm run deploy:vinext` exists for a future approved deployment. Do not run it until the Cloudflare project, secrets, preview workflow, and target branch are approved.
- The preview uses no CDN cache, data cache, KV, R2, D1, Durable Objects, Workers AI, or Cloudflare Images. Remote images pass through without Workers-side optimization.

The generated Workers configuration is in `wrangler.jsonc`; the vinext/Vite integration is in `vite.config.ts`. Generated output and local Wrangler state are ignored by Git. A local build may create `dist/server/.dev.vars` from `.env.local`; it stays ignored and must never be committed.

## Required environment configuration

The local preview reads the existing private `.env.local`. A future Cloudflare preview or production environment must configure these separately in Cloudflare:

- Public build/runtime values: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Private secret: `SUPABASE_SERVICE_ROLE_KEY`.
- Blizzard integration secrets when enabled: `BLIZZARD_CLIENT_ID`, `BLIZZARD_CLIENT_SECRET`.
- Blizzard configuration: `BLIZZARD_REGION`; `BLIZZARD_REDIRECT_URI` only if the application begins using that flow.

Never expose the Supabase service-role key or Blizzard credentials through a `NEXT_PUBLIC_` variable or commit them to Git.

## Preview validation

Run:

```sh
npm ci
npm run build:vinext
npm run start:vinext
```

The local Worker listens on the URL reported by Wrangler, normally `http://127.0.0.1:8787`. Before promotion, verify sign-in, sign-out, session persistence, protected routes, RLS-sensitive features, external integrations, images, and responsive layouts against a Cloudflare preview deployment.

vinext remains beta. Its compatibility check currently reports partial support for `next/font/google` and `next/image`. Google fonts are loaded from their CDN in the vinext path, and image optimization remains passthrough because Cloudflare Images is intentionally disabled.
