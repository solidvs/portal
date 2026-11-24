import { describe, expect, it } from 'vitest';

import { countSince, imageOf, latest, systemOfFile, type DeployChange } from './operations.js';

const DIGEST = `sha256:${'a'.repeat(64)}`;

describe('imageOf', () => {
  it('reads the pinned image of the first service', () => {
    expect(imageOf(`services:\n  app:\n    image: ghcr.io/example-org/portal@${DIGEST}\n`)).toEqual({
      image: `ghcr.io/example-org/portal@${DIGEST}`,
      digest: DIGEST,
    });
  });

  it('reports no digest for an image pinned by tag', () => {
    expect(imageOf('services:\n  app:\n    image: nginx:1.27\n')?.digest).toBeNull();
  });

  it('ignores files that are not compose files', () => {
    expect(imageOf('just text')).toBeUndefined();
  });
});

describe('systemOfFile', () => {
  it('takes the system id from the platform file name', () => {
    expect(systemOfFile('portal.compose.yaml')).toBe('portal');
    expect(systemOfFile('.gitkeep')).toBeUndefined();
  });
});

describe('deploy lists', () => {
  const change = (date: string): DeployChange => ({ system: 's', environment: 'staging', sha: date, message: '', author: null, date, url: '' });

  it('orders newest first and counts a period', () => {
    const changes = [change('2026-11-01T00:00:00Z'), change('2026-11-22T00:00:00Z'), change('2026-11-20T00:00:00Z')];
    expect(latest(changes, 2).map((c) => c.date)).toEqual(['2026-11-22T00:00:00Z', '2026-11-20T00:00:00Z']);
    expect(countSince(changes, new Date('2026-11-16T00:00:00Z'))).toBe(2);
  });
});
