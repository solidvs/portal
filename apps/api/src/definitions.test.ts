import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configurePlatformApp } from '@solidvs/server';
import { FakeIdentityProvider, FakeServiceTokenVerifier, RecordingAuditTrail, TestDataModule } from '@solidvs/server/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { configSchema } from './config.js';
import { DEFINITION_REPOSITORY } from './modules/definitions/definitions.module.js';
import { InMemoryDefinitionRepository, UNUSED_DATABASE } from './testing.js';

const KEY = 'identity.forgotPasswordUrl';
const MEMBER = { sub: 'u1', preferred_username: 'ana', department: 'TI', groups: [] };
const EDITOR = { sub: 'u2', preferred_username: 'davi', department: 'TI', groups: ['GRP-Portal-Editors'] };
const ADMIN = { sub: 'u3', preferred_username: 'carla', department: 'TI', groups: ['GRP-Portal-Admins'] };

/** Administered definitions over HTTP (ADR-0014): administration, systems and the public endpoint. */
describe('definitions over HTTP', () => {
  let app: INestApplication;
  let provider: FakeIdentityProvider;
  let services: FakeServiceTokenVerifier;
  let audit: RecordingAuditTrail;

  beforeEach(async () => {
    provider = new FakeIdentityProvider();
    services = new FakeServiceTokenVerifier();
    audit = new RecordingAuditTrail();
    const config = configSchema.parse({
      PUBLIC_URL: 'https://portal.test',
      GITHUB_ORG: 'example-org',
      OIDC_ISSUER: 'https://id.portal.test/realms/internal',
      OIDC_CLIENT_ID: 'portal',
      OIDC_CLIENT_SECRET: 'test-only',
      LOG_LEVEL: 'fatal',
      GITHUB_TOKEN: 'test-only',
      ...UNUSED_DATABASE,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.forRoot(config, { identityProvider: provider, serviceTokenVerifier: services, database: TestDataModule.forRoot(audit) })],
    })
      .overrideProvider(DEFINITION_REPOSITORY)
      .useValue(new InMemoryDefinitionRepository())
      .compile();
    app = moduleRef.createNestApplication();
    configurePlatformApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function as(claims: Record<string, unknown>) {
    provider.signInAs(claims);
    const login = await request(app.getHttpServer()).get('/api/auth/login');
    const loginCookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const callback = new URL(login.headers.location as string);
    const response = await request(app.getHttpServer()).get(`${callback.pathname}${callback.search}`).set('Cookie', loginCookie);
    const cookie = (response.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('__Host-session='))!.split(';')[0]!;
    const csrf = (await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookie)).body.csrfToken as string;
    const server = app.getHttpServer();
    return {
      get: (path: string) => request(server).get(path).set('Cookie', cookie),
      post: (path: string, body: unknown) => request(server).post(path).set('Cookie', cookie).set('x-csrf-token', csrf).send(body as object),
    };
  }

  it('lists the platform kinds, never published yet, with their labels and defaults', async () => {
    const member = await as(MEMBER);
    const { body } = await member.get('/api/admin/definitions').expect(200);
    expect(body.definitions).toEqual([
      expect.objectContaining({ key: KEY, scope: 'platform', systemId: null, public: true, default: null, active: null, draft: null }),
    ]);
    await member.get('/api/admin/definitions?systemId=Not_An_Id').expect(400);
  });

  it('drafts by editors, publication by administrators, every step audited', async () => {
    const member = await as(MEMBER);
    const editor = await as(EDITOR);
    const admin = await as(ADMIN);

    await member.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://senha.example.com', note: 'Novo link' }).expect(403);
    await editor.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'http://senha.example.com', note: 'Sem https' }).expect(422);
    await editor.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://senha.example.com', note: '' }).expect(422);
    await editor.post('/api/admin/definitions/identity.unknown/drafts', { value: null, note: 'x' }).expect(404);
    await editor.post(`/api/admin/definitions/${KEY}/drafts`, { systemId: 'orders', value: null, note: 'x' }).expect(422);
    const draft = await editor.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://senha.example.com', note: 'Novo link' }).expect(201);
    expect(draft.body).toMatchObject({ number: 1, value: 'https://senha.example.com', note: 'Novo link', createdBy: 'davi', publishedAt: null });

    await editor.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(403);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(200, { activeVersion: 1 });
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(422);

    const { body } = await member.get('/api/admin/definitions').expect(200);
    expect(body.definitions[0]).toMatchObject({ active: { number: 1, publishedBy: 'carla' }, draft: null });
    expect(audit.events.map((e) => [e.actor, e.action, e.subjectId])).toEqual([
      ['davi', 'definition.draft_saved', KEY],
      ['carla', 'definition.published', KEY],
    ]);
  });

  it('rolls back by republishing an earlier version; history only grows', async () => {
    const admin = await as(ADMIN);
    await admin.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://a.example.com', note: 'a' }).expect(201);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(200);
    await admin.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://b.example.com', note: 'b' }).expect(201);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 2 }).expect(200);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(200, { activeVersion: 3 });

    const { body } = await admin.get(`/api/admin/definitions/${KEY}/versions`).expect(200);
    expect(body.activeVersion).toBe(3);
    expect(body.versions.map((v: { number: number; value: string; basedOn: number | null }) => [v.number, v.value, v.basedOn])).toEqual([
      [3, 'https://a.example.com', 2],
      [2, 'https://b.example.com', 1],
      [1, 'https://a.example.com', null],
    ]);
    expect(audit.events.at(-1)).toMatchObject({ action: 'definition.republished', details: { version: 3, previous: 2, republishedFrom: 1 } });
  });

  it('systems read active values with a client credentials token, never a session', async () => {
    const admin = await as(ADMIN);
    const token = services.issue('orders');
    const server = app.getHttpServer();

    const before = await request(server).get('/api/definitions/platform').set('Authorization', `Bearer ${token}`).expect(200);
    expect(before.body).toEqual({ definitions: { [KEY]: null } });

    await admin.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://senha.example.com', note: 'x' }).expect(201);
    // A draft is not served.
    await request(server).get('/api/definitions/platform').set('Authorization', `Bearer ${token}`).expect(200, before.body);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(200);
    const after = await request(server).get('/api/definitions/platform').set('Authorization', `Bearer ${token}`).expect(200);
    expect(after.body).toEqual({ definitions: { [KEY]: 'https://senha.example.com' } });

    // Polling with the ETag costs nothing when nothing changed.
    await request(server).get('/api/definitions/platform').set('Authorization', `Bearer ${token}`).set('If-None-Match', after.headers.etag as string).expect(304);

    await request(server).get('/api/definitions/systems/orders').set('Authorization', `Bearer ${token}`).expect(200, { definitions: {} });
    await request(server).get('/api/definitions/systems/billing').set('Authorization', `Bearer ${token}`).expect(403);
    await request(server).get('/api/definitions/platform').expect(401);
    await admin.get('/api/definitions/platform').expect(401);
  });

  it('serves public kinds without authentication, readable from the identity provider only', async () => {
    const admin = await as(ADMIN);
    await admin.post(`/api/admin/definitions/${KEY}/drafts`, { value: 'https://senha.example.com', note: 'x' }).expect(201);
    await admin.post(`/api/admin/definitions/${KEY}/publish`, { version: 1 }).expect(200);

    const response = await request(app.getHttpServer()).get('/api/public/definitions').set('Origin', 'https://id.portal.test').expect(200);
    expect(response.body).toEqual({ definitions: { [KEY]: 'https://senha.example.com' } });
    expect(response.headers['access-control-allow-origin']).toBe('https://id.portal.test');
    expect(response.headers['cache-control']).toBe('public, max-age=60');
    expect(response.headers['access-control-allow-credentials']).toBeUndefined();
    await request(app.getHttpServer()).post('/api/public/definitions').expect(404);
  });
});
