# Instructions for AI coding agents

Read `README.md` first. This system follows the standard stack of `solidvs/standard`;
decisions there (`stack/decisions`) and in `docs/decisions` here are binding.

- **Module layout.** New features go in `apps/api/src/modules/<module>/` with `domain/`,
  `application/`, `infrastructure/` and `http/`. Domain code has no framework and no I/O;
  application code depends on the domain only. `pnpm lint` enforces it — never disable the rule.
- **Contracts first.** Add or change the response schema in `packages/contracts`, then the
  controller (`schema.parse(result)` before returning), then the web call (`api(schema, path)`).
- **Every route requires a session** unless it is `@Public()`, which needs a reason in a comment.
  Routes that change data use `@RequireRoles(...)` and are called with the CSRF header (the web
  `api()` helper sends it).
- **Access is declared, not coded:** `access` and `roles` in `app.module.ts`. Department never
  grants a role.
- **User interface:** only `@solidvs/ui`; spacing, colors and type through `token(...)` and the
  primitives (`Box`, `Stack`, `Inline`, `Text`), never raw values. User-facing text in Portuguese.
- **Tests:** one HTTP test per route in `apps/api/src/*.test.ts` style (fake identity provider from
  `@solidvs/server/testing`), unit tests for domain rules.
- **Definitions (ADR-0014).** The portal stores and serves them; it never holds credentials of
  other systems and never writes to their databases. Kinds live in `@solidvs/server`; never store
  a secret as a definition. Publishing needs `admin`; every change goes through the `Definitions`
  use cases, which audit it. Service routes (`@ServiceRoute()`) answer systems only, each with its
  own scope.
- **Data (ADR-0016).** Prisma only in `modules/<module>/infrastructure/` (lint enforces it).
  Change `apps/api/prisma/schema.prisma` with engine-neutral types, then `pnpm db:migration
  <name>`; commit both migrations and the derived SQL Server schema; never edit a merged
  migration. HTTP tests use `TestDataModule` and `InMemoryDefinitionRepository`; `pnpm test:db`
  covers the real database.
- **Configuration:** new keys go in `apps/api/src/config.ts` (schema) and in the platform's GitHub
  environment; never in code, never with values in the repository.
- **Dependencies:** exact versions; third-party releases at least 7 days old.
- Code, comments and technical documentation in English.
