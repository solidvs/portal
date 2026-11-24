import { describe, expect, it } from 'vitest';

import { buildCatalog, parseManifest, type RepositoryFacts } from './catalog.js';

const repo = (name: string, extra: Partial<RepositoryFacts> = {}): RepositoryFacts => ({
  name,
  url: `https://github.com/example-org/${name}`,
  description: null,
  language: 'TypeScript',
  pushedAt: '2026-11-20T10:00:00Z',
  archived: false,
  ...extra,
});

const manifest = (id: string, spec = ''): string =>
  `apiVersion: solidvs/catalog/v1\nkind: System\nmetadata:\n  id: ${id}\n  name: Sistema ${id}\nspec:\n  type: web\n  lifecycle: production\n${spec}`;

describe('parseManifest', () => {
  it('reads a valid manifest', () => {
    expect(parseManifest(manifest('portal'))?.metadata.id).toBe('portal');
  });

  it('rejects other formats instead of guessing', () => {
    expect(parseManifest('name: portal')).toBeUndefined();
    expect(parseManifest(': not yaml :')).toBeUndefined();
    expect(parseManifest(manifest('Portal Com Espaço'))).toBeUndefined();
  });
});

describe('buildCatalog', () => {
  it('prefers the repository manifest, then the central entry, then the bare repository', () => {
    const central = [parseManifest(manifest('legado', '  repository: hr-portal\n'))!];
    const entries = buildCatalog(
      [
        { facts: repo('portal'), manifest: parseManifest(manifest('portal')) },
        { facts: repo('hr-portal'), manifest: undefined },
        { facts: repo('skills', { archived: true }), manifest: undefined },
      ],
      central,
    );
    // Sorted by display name: "Sistema legado", "Sistema portal", "skills".
    expect(entries.map((e) => [e.id, e.manifest])).toEqual([
      ['legado', 'central'],
      ['portal', 'repository'],
      ['skills', 'none'],
    ]);
    expect(entries.find((e) => e.id === 'skills')?.lifecycle).toBe('deprecated');
  });

  it('keeps central entries that have no repository (servers, databases)', () => {
    const entries = buildCatalog([], [parseManifest(manifest('sqlserver-maindb'))!]);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.repository).toBeNull();
  });
});
