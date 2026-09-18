# Cloudflare frontend deployment

The frontend builds into `apps/web/dist`. `apps/web/wrangler.jsonc` tells
Wrangler to upload that directory and serve client-side navigation through
`index.html`. This configuration hosts the frontend only, not the Node API
or MySQL database.

## Build settings

For a Workers Builds project whose root directory is `apps/web`:

- Build command: `npm run build` (Cloudflare installs dependencies first).
- Non-production upload command: `npx wrangler versions upload`.
- Existing production deployment settings remain unchanged by this fix.

If running from the repository root, build with `npm run build:web` and pass
`--config apps/web/wrangler.jsonc` to Wrangler.

Preserve the existing production API URL and environment configuration.
`VITE_API_BASE_URL` is a public build-time value, not a secret. A working
landing page does not prove authenticated API or database availability.
Do not point a public build at a localhost API or place credentials in Vite
environment variables.

## Failure addressed

The September 18 build completed successfully, but `wrangler versions upload`
failed with "Missing entry-point to Worker script or to assets directory".
The missing assets configuration caused that upload error. The chunk-size
and install-script warnings did not fail the recorded build.

Uploading a version is separate from promoting it to production. This change
does not define DNS records, custom domains, routes, or a production promotion.
Keep the current live version serving traffic until its replacement is reviewed.

## Verification

From `apps/web`, after building:

```sh
npx wrangler deploy --dry-run
```

This validates the local upload configuration without deploying. The final
remote confirmation is a successful Workers Builds check on the new commit.

References: [SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
and [versions and deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/).
