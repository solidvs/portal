import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configurePlatformApp, DATABASE_CLIENT, databaseConfigSchema, loadConfig } from '@solidvs/server';
import { FakeIdentityProvider, FakeServiceTokenVerifier } from '@solidvs/server/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { configSchema } from './config.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { ConcurrentChange } from './modules/definitions/application/definitions.js';
import { DEFINITION_REPOSITORY } from './modules/definitions/definitions.module.js';
import type { PrismaDefinitionRepository } from './modules/definitions/infrastructure/prisma-definition-repository.js';

const KEY = 'identity.forgotPasswordUrl';

/**
 * The portal against a real database (ADR-0014, ADR-0016), with the application login of
 * CONFIG_FILE: `pnpm db:lab && pnpm db:deploy && pnpm test:db`. Works on a fresh or seeded database.
 */
describe('definitions, real database', () => {
  let app: INestApplication;
  let provider: FakeIdentityProvider;
  let services: FakeServiceTokenVerifier;

  beforeAll(async () => {
    provider = new FakeIdentityProvider();
    services = new FakeServiceTokenVerifier();
    const config = configSchema.parse({
      PUBLIC_URL: 'https://portal.test',
      GITHUB_ORG: 'example-org',
      OIDC_ISSUER: 'https://id.portal.test/realms/internal',
      OIDC_CLIENT_ID: 'portal',
      OIDC_CLIENT_SECRET: 'test-only',
      LOG_LEVEL: 'fatal',
      GITHUB_TOKEN: 'test-only',
      ...loadConfig(databaseConfigSchema),
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config, { identityProvider: provider, serviceTokenVerifier: services })] }).compile();
    app = moduleRef.createNestApplication();
    configurePlatformApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  async function admin() {
    provider.signInAs({ sub: 'u3', preferred_username: 'carla', department: 'TI', groups: ['GRP-Portal-Admins'] });
    const login = await request(app.getHttpServer()).get('/api/auth/login');
    const loginCookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const callback = new URL(login.headers.location as string);
    const response = await request(app.getHttpServer()).get(`${callback.pathname}${callback.search}`).set('Cookie', loginCookie);
    const cookie = (response.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('__Host-session='))!.split(';')[0]!;
    const csrf = (await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie)).body.csrfToken as string;
    return (path: string, body: unknown) => request(app.getHttpServer()).post(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body as object);
  }

  it('drafts, publishes, rolls back and serves the active value, with the audit trail', async () => {
    const post = await admin();
    const db = app.get<PrismaClient>(DATABASE_CLIENT);
    const lastBefore = (await db.auditEvent.findFirst({ orderBy: { id: 'desc' } }))?.id ?? 0n;
    const first = await post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://a.example.com', note: 'Primeiro' }).expect(201);
    const base = first.body.number as number;
    await post(`/api/admin/definitions/${KEY}/publish`, { version: base }).expect(200);
    await post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://b.example.com', note: 'Segundo' }).expect(201);
    await post(`/api/admin/definitions/${KEY}/publish`, { version: base + 1 }).expect(200);
    await post(`/api/admin/definitions/${KEY}/publish`, { version: base }).expect(200, { activeVersion: base + 2 });

    const token = services.issue('orders');
    await request(app.getHttpServer()).get('/api/definitions/platform').set('Authorization', `Bearer ${token}`).expect(200, { definitions: { [KEY]: 'https://a.example.com' } });
    await request(app.getHttpServer()).get('/api/public/definitions').expect(200, { definitions: { [KEY]: 'https://a.example.com' } });

    const events = await db.auditEvent.findMany({ where: { subjectType: 'definition', id: { gt: lastBefore } }, orderBy: { id: 'asc' } });
    expect(events.map((e) => e.action)).toEqual(['definition.draft_saved', 'definition.published', 'definition.draft_saved', 'definition.published', 'definition.republished']);
  });

  it('refuses a change computed from pointers that moved meanwhile', async () => {
    const repository = app.get<PrismaDefinitionRepository>(DEFINITION_REPOSITORY);
    const ref = { key: KEY, scope: 'platform' as const, systemId: null };
    const state = (await repository.find(ref))!;
    const stale = {
      ref,
      expected: { activeVersion: state.activeVersion! - 1, draftVersion: null },
      next: { activeVersion: state.activeVersion, draftVersion: null },
    };
    await expect(repository.apply(stale, new Date())).rejects.toBeInstanceOf(ConcurrentChange);
  });

  it('versions are never deleted by the running service', async () => {
    const db = app.get<PrismaClient>(DATABASE_CLIENT);
    await expect(db.auditEvent.deleteMany({})).rejects.toThrow();
  });
});
