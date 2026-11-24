import 'reflect-metadata';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configurePlatformApp } from '@solidvs/server';
import { FakeIdentityProvider, TestDataModule } from '@solidvs/server/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { configSchema } from './config.js';
import { TokenAuth } from './modules/github/infrastructure/github-auth.js';
import { GitHubClient } from './modules/github/infrastructure/github-client.js';
import { DEFINITION_REPOSITORY } from './modules/definitions/definitions.module.js';
import { InMemoryDefinitionRepository, UNUSED_DATABASE } from './testing.js';

const DIGEST = `sha256:${'b'.repeat(64)}`;
const API = 'https://api.github.com';

/** GitHub as the portal sees it, served from memory: one system with manifest, one legacy repo. */
const GITHUB: Record<string, unknown> = {
  '/orgs/example-org/repos?per_page=100&type=all': [
    { name: 'portal', html_url: 'https://github.com/example-org/portal', description: null, language: 'TypeScript', pushed_at: '2026-11-23T12:00:00Z', archived: false, is_template: false },
    { name: 'hr-portal', html_url: 'https://github.com/example-org/hr-portal', description: 'Portal do RH', language: 'TypeScript', pushed_at: '2026-09-30T12:00:00Z', archived: false, is_template: false },
    { name: 'system-template', html_url: 'https://github.com/example-org/system-template', description: null, language: 'TypeScript', pushed_at: null, archived: false, is_template: true },
  ],
  'raw:/repos/example-org/portal/contents/catalog-info.yaml':
    'apiVersion: solidvs/catalog/v1\nkind: System\nmetadata:\n  id: portal\n  name: Portal de TI\nspec:\n  type: web\n  lifecycle: development\n  owner: ti\n  dependsOn: [identity]\n',
  '/repos/example-org/platform/contents/environments/staging': [
    { name: 'portal.compose.yaml', path: 'environments/staging/portal.compose.yaml', type: 'file', html_url: 'x' },
  ],
  'raw:/repos/example-org/platform/contents/environments/staging/portal.compose.yaml': `services:\n  app:\n    image: ghcr.io/example-org/portal@${DIGEST}\n`,
  '/repos/example-org/platform/commits?path=environments%2Fstaging%2Fportal.compose.yaml&per_page=30': [
    { sha: 'c1', html_url: 'https://github.com/example-org/platform/commit/c1', commit: { message: 'Deploy portal to staging\n\nbody', author: { name: 'Ana', date: '2026-11-23T13:00:00Z' } }, author: { login: 'ana' } },
  ],
  '/repos/example-org/platform/commits?path=environments%2Fproduction%2Fportal.compose.yaml&per_page=30': [],
  '/repos/example-org/portal/contents/docs/decisions': [
    { name: 'README.md', path: 'docs/decisions/README.md', type: 'file', html_url: 'r' },
    { name: '0001-use-the-standard-stack.md', path: 'docs/decisions/0001-use-the-standard-stack.md', type: 'file', html_url: 'https://github.com/example-org/portal/blob/main/docs/decisions/0001-use-the-standard-stack.md' },
  ],
  'raw:/repos/example-org/portal/contents/docs/decisions/0001-use-the-standard-stack.md': '# 0001: Use the standard stack\n\n- **Status:** Accepted\n',
};

const fakeFetch: typeof fetch = async (input, init) => {
  const path = String(input).replace(API, '');
  const raw = String((init?.headers as Record<string, string> | undefined)?.accept).includes('raw');
  const body = GITHUB[raw ? `raw:${path}` : path];
  if (body === undefined) return new Response('{"message":"Not Found"}', { status: 404 });
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status: 200 });
};

/**
 * The portal over HTTP, with a fake identity provider and GitHub served from memory. Every route
 * has a test here.
 */
describe('portal over HTTP', () => {
  let app: INestApplication;
  let provider: FakeIdentityProvider;
  let session: string;

  async function sessionOf(claims: Record<string, unknown>): Promise<string | undefined> {
    provider.signInAs(claims);
    const login = await request(app.getHttpServer()).get('/api/auth/login');
    const loginCookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const callback = new URL(login.headers.location as string);
    const response = await request(app.getHttpServer()).get(`${callback.pathname}${callback.search}`).set('Cookie', loginCookie);
    return (response.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('__Host-session='))?.split(';')[0];
  }

  beforeEach(async () => {
    provider = new FakeIdentityProvider();
    const config = configSchema.parse({
      PUBLIC_URL: 'https://portal.test',
      GITHUB_ORG: 'example-org',
      OIDC_ISSUER: 'https://id.portal.test/realms/internal',
      OIDC_CLIENT_ID: 'portal',
      OIDC_CLIENT_SECRET: 'test-only',
      LOG_LEVEL: 'fatal',
      RELEASE: 'r-1',
      GITHUB_TOKEN: 'test-only',
      ...UNUSED_DATABASE,
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule.forRoot(config, { identityProvider: provider, database: TestDataModule.forRoot() })] })
      .overrideProvider(DEFINITION_REPOSITORY)
      .useValue(new InMemoryDefinitionRepository())
      .overrideProvider(GitHubClient)
      .useValue(new GitHubClient(new TokenAuth('test-only'), 60_000, fakeFetch))
      .compile();
    app = moduleRef.createNestApplication();
    configurePlatformApp(app);
    await app.init();
    session = (await sessionOf({ sub: 'u1', preferred_username: 'ana', department: 'TI', groups: [] }))!;
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (path: string) => request(app.getHttpServer()).get(path).set('Cookie', session);

  it('answers the platform healthcheck without a session and requires one elsewhere', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200);
    await request(app.getHttpServer()).get('/api/catalog').expect(401);
  });

  it('keeps people outside the IT department out', async () => {
    expect(await sessionOf({ sub: 'u2', preferred_username: 'bruno', department: 'Vendas', groups: [] })).toBeUndefined();
  });

  it('lists the catalog: manifest wins, repositories without one still appear, templates do not', async () => {
    const { body } = await get('/api/catalog').expect(200);
    expect(body.entries.map((e: { id: string; manifest: string }) => [e.id, e.manifest])).toEqual([
      ['hr-portal', 'none'],
      ['portal', 'repository'],
    ]);
    await get('/api/catalog/portal').expect(200);
    await get('/api/catalog/nothing').expect(404);
  });

  it('shows where a system runs and what changed', async () => {
    const environments = await get('/api/projects/portal/environments').expect(200);
    expect(environments.body.environments).toEqual([
      {
        environment: 'staging',
        image: `ghcr.io/example-org/portal@${DIGEST}`,
        digest: DIGEST,
        changedAt: '2026-11-23T13:00:00Z',
        changedBy: 'ana',
        url: 'https://github.com/example-org/platform/blob/main/environments/staging/portal.compose.yaml',
      },
      { environment: 'production', image: null, digest: null, changedAt: null, changedBy: null, url: null },
    ]);
    const deploys = await get('/api/projects/portal/deploys').expect(200);
    expect(deploys.body.deploys).toEqual([
      { system: 'portal', environment: 'staging', sha: 'c1', message: 'Deploy portal to staging', author: 'ana', date: '2026-11-23T13:00:00Z', url: 'https://github.com/example-org/platform/commit/c1' },
    ]);
  });

  it('lists decisions of a system and handles a missing procedures folder', async () => {
    const decisions = await get('/api/projects/portal/decisions').expect(200);
    expect(decisions.body.documents).toEqual([
      {
        file: '0001-use-the-standard-stack.md',
        title: '0001: Use the standard stack',
        status: 'Accepted',
        url: 'https://github.com/example-org/portal/blob/main/docs/decisions/0001-use-the-standard-stack.md',
      },
    ]);
    await get('/api/projects/portal/procedures').expect(200, { documents: [] });
  });

  it('summarizes for the start page', async () => {
    const { body } = await get('/api/overview').expect(200);
    expect(body).toMatchObject({ release: 'r-1', projects: 2, withManifest: 1, deployedToProduction: 0, latestDeploys: [{ sha: 'c1' }] });
  });
});
