# Better Auth setup

The Next.js app owns normal application authentication through Better Auth.
Payload remains responsible for CMS content and administrator access. The
legacy Payload `users` collection remains registered for data preservation,
and public creation through it is disabled. Its local auth strategy remains
available temporarily for legacy identity verification until an approved data
linking and retirement process is completed. No frontend app flow uses Payload
auth. The Better Auth endpoints are mounted at `/auth/api/*` because Payload
owns `/api/*`.

## Environment variables

Configure these as server-only variables in each environment. Use the Figma
Make environment-variable card for a Figma deployment; use the deployment
provider's secret manager elsewhere. Never add real values to this file or Git.

Next.js:

- `DATABASE_URL`: connection string for the dedicated Better Auth PostgreSQL
  database.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `BETTER_AUTH_URL`: canonical public origin of the Next.js app, with no path.
- `BETTER_AUTH_TRUSTED_ORIGINS`: optional comma-separated app origins used by
  preview environments.
- `AUTH_SMTP_HOST`, `AUTH_SMTP_PORT`, `AUTH_SMTP_USERNAME`,
  `AUTH_SMTP_PASSWORD`, `AUTH_SMTP_FROM_EMAIL`, and optional
  `AUTH_SMTP_FROM_NAME`: transactional email settings for verification and
  password reset.
- `BACKEND_URL`: server-side FastAPI origin.

FastAPI:

- `BETTER_AUTH_URL`: the same canonical public issuer origin. FastAPI obtains
  public keys from `BETTER_AUTH_URL/auth/api/jwks` and does not need the Better
  Auth signing secret.

## Railway PostgreSQL

1. Create a Railway project environment for staging, add a PostgreSQL service,
   and wait until Railway reports it healthy. Create a separate production
   environment/database before production use.
2. If the Next.js app runs in the same Railway environment, configure
   `DATABASE_URL` as a Railway service reference to the PostgreSQL service's
   private `DATABASE_URL` variable.
3. This project currently uses Figma Make's Payload runtime. If Next.js stays
   on Figma Make or Vercel, Railway private networking is unavailable to it.
   Enable the Railway TCP proxy and configure the external database URL as the
   server-only `DATABASE_URL`; Railway may charge egress for that connection.
   Require TLS and restrict who can read that variable. Do not move the Next.js
   app to Railway until the Figma-managed Payload runtime has been separately
   verified there.
4. For local development, use a separate development database and an ignored
   root `.env` file. Do not point local development at production. The
   repository ignores `.env*` files.
5. Generate and review the initial Prisma migration against the development
   database with `pnpm prisma:migrate:dev -- --name better-auth-init`. Commit
   the migration directory. Apply it to staging, verify the app and backend,
   take a production backup, then run `pnpm prisma:migrate:deploy` against
   production during a controlled deployment window. Do not run `migrate dev`
   against production or use `db push` for production schema changes.

## Identity transition

The additive backend migration adds a nullable unique `better_auth_user_id` to
`user_profiles`. Existing `payload_user_id` values remain the stable owner keys
for all existing app data. Migrated identities must be explicitly verified and
linked by setting `better_auth_user_id`; never match accounts by email alone.
New app users use their Better Auth ID for both keys. No Payload account data or
backend user data is copied by the source-code migration.

Do not remove the Payload `users` collection or legacy credential data as part
of this rollout. Retire those records only after an approved identity import,
relationship audit, backup, and rollback plan.

## Email behavior

Signup requires a verified email before login. Reset links expire according to
Better Auth's configured defaults. The UI uses generic recovery responses to
avoid account enumeration. Signup and reset delivery are unavailable until the
SMTP variables are configured in the deployment environment.
