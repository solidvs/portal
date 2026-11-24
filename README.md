# Portal de TI

The IT administration environment: every system of the organization, where and which version it
runs, its decisions and its procedures. System 1 of the standard stack, created from
`solidvs/template` (the rest of this README is the template's and still applies).

Open to the IT department. Most of its data comes from GitHub: each repository's
`catalog-info.yaml`, the central catalog repository, the platform repository (environments and
their history) and `docs/` folders. Modules: `catalog`, `operations`, `knowledge`, `overview`, over
a read-only GitHub client (`github`).

It is also the platform's control plane (ADR-0014): the `definitions` module keeps, in the
portal's own database (ADR-0016), the definitions maintainers administer for every system, with
versions, publication and the audit trail.

## Administered definitions

| Route | Who | What |
|---|---|---|
| `GET /api/admin/definitions[?systemId=]` | IT department | Kinds of a scope with their active version and draft |
| `GET /api/admin/definitions/:key/versions[?systemId=]` | IT department | History, newest first |
| `POST /api/admin/definitions/:key/drafts` | `editor` or `admin` | New draft `{ value, note, systemId? }`, validated against the kind |
| `POST /api/admin/definitions/:key/publish` | `admin` | `{ version, systemId? }`: the current draft, or an earlier published version (rollback, written as a new version) |
| `GET /api/definitions/platform` | Any system (client credentials token for `portal`) | Active values of the platform scope; `ETag` and `304` |
| `GET /api/definitions/systems/:id` | The system `:id` only | Active values of its own scope |
| `GET /api/public/definitions` | Anyone | Active values of public kinds; cross-origin reads from the identity provider's origin only; cached 60 s |

- **Kinds** come from `DEFINITION_KINDS` of `@solidvs/server` (a new kind is a platform kit
  change). A kind never published is served with its default (`null`: not set).
- **Roles** come from directory groups: `GRP-Portal-Editors` (editor) and `GRP-Portal-Admins`
  (admin).
- **Every draft and publication** goes to `audit_event`. Versions are never changed or deleted;
  two people editing at once cannot overwrite each other (the second gets 409).
- **A system reading definitions** needs its own client at the identity provider with the client
  credentials grant and an audience mapper for `portal`; by convention its client id is its
  catalog id.

## Database

Data layer of the standard stack (ADR-0016): PostgreSQL or SQL Server, one database and two logins
per environment, migrations applied only by the migration image. Procedures:
[`docs/procedures/database.md`](docs/procedures/database.md). For local development,
`pnpm --filter @portal/api db:lab` starts a laboratory database and adds its keys to
`config.local.json`; then `db:deploy` and `db:seed`.

| Path | What it is |
|---|---|
| `apps/api` | NestJS API. Serves `/api` and the web app on the same origin, in one image |
| `apps/api/src/modules/<module>/` | `domain/` (plain rules), `application/` (use cases), `infrastructure/` (I/O), `http/` (controllers); dependencies point inwards, enforced by lint |
| `apps/web` | React web app on `@solidvs/ui` (platform components, ADR-0011): shell, "Projetos", project pages with tabs as URLs; the build publishes `THIRD-PARTY-NOTICES.txt` |
| `packages/contracts` | Schemas of every API response; the API validates what it sends, the web app what it receives |
| `catalog-info.yaml` | How the system appears in the IT portal |
| `docs/decisions` | Decisions of this system on top of the stack |
| `docs/procedures` | How to operate it |
| `apps/api/prisma/` | Data model (PostgreSQL reference, SQL Server derived) and one migrations folder per engine (ADR-0016) |
| `apps/migrate` | Dependencies of the migration image |
| `Dockerfile` | Two images per release: the application and the migration step (`--target migrate`) |
| `.github/workflows/ci.yaml` | Audit, model and migrations in sync, lint, build, type check, tests, the database on PostgreSQL and SQL Server, secret scan, both images built, scanned and published by digest |

What every system gets from `@solidvs/server` without writing it: sign-in through the
organization's identity provider (Keycloak federated to Active Directory, ADR-0009), server-side
sessions, the access rule, roles from directory groups, CSRF protection, rate limiting, security
headers, structured audit logs and `/api/health`.

## Creating a system from this template

1. **Repository:** GitHub → `solidvs/template` → *Use this template* → private
   repository named after the system id (lowercase, hyphens: `portal`, `pedidos`).
2. **Rename:** replace `example` with the system id and "Sistema de exemplo" with its name in
   `apps/api/src/system.ts`, `catalog-info.yaml`, the `name` fields of the three `package.json`
   files (`@example/…` → `@<id>/…`), imports of `@example/contracts`, `apps/web/index.html`, and
   the role group `GRP-Example-Admins` in `apps/api/src/app.module.ts`.
3. **Access rule:** in `apps/api/src/app.module.ts`, who enters (`access`) and the roles (`roles`).
   Department may open the door; roles that change data come from directory groups only.
4. **Packages:** the platform packages are private. In GitHub → solidvs → Packages →
   `server` and `ui` → *Package settings* → *Manage Actions access*, add the new repository with
   *Read*. Without it, CI cannot install them.
5. **Identity provider:** register the system as a client in Keycloak (realm as code in
   `<organization>/platform`) with redirect URI `https://<host>/api/auth/callback`.
6. **Platform:** create the GitHub environments `<id>-staging` and `<id>-production` in
   `<organization>/platform` with the configuration keys (`PUBLIC_URL`, `OIDC_ISSUER`,
   `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and the system's own), then follow
   `docs/procedures/deploy.md`.
7. **Decisions:** date `docs/decisions/0001-use-the-standard-stack.md`; record what this system
   decides on top of the stack.

## Developing

Node.js 24 and pnpm (`corepack enable`). Reading the platform packages needs a GitHub token with
`read:packages` in the user-level `~/.npmrc` (pnpm ignores tokens in the project's `.npmrc`):

```sh
gh auth refresh -h github.com -s read:packages      # once
echo "//npm.pkg.github.com/:_authToken=$(gh auth token)" >> ~/.npmrc
pnpm install
pnpm lint && pnpm build && pnpm typecheck && pnpm test
```

Local run, against the identity laboratory of `solidvs/kit` (Keycloak + LDAP) or any
OIDC provider: copy `config.example.json` to `config.local.json` (never committed), fill the client
secret, then:

```sh
pnpm --filter @portal/api dev      # API on :3000, reads config.local.json (with the database keys)
pnpm --filter @portal/web dev     # web on :5173, /api proxied to the API
```

## Rules

- Every API response has a schema in `packages/contracts`; validate before sending.
- The web app imports the design system only from `@solidvs/ui` (lint enforces it).
- No secret in the repository, image, logs or `config.example.json`. The platform delivers
  configuration as a file at deploy time.
- Third-party releases must be at least 7 days old (`pnpm-workspace.yaml`); platform packages are
  exempt.
