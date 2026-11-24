import { ConcurrentChange, type DefinitionRepository } from './modules/definitions/application/definitions.js';
import { definitionId, type DefinitionChange, type DefinitionRef, type DefinitionScope, type DefinitionState } from './modules/definitions/domain/definition.js';

/** Database keys of HTTP tests: the database itself is replaced (TestDataModule). */
export const UNUSED_DATABASE = {
  DATABASE_HOST: 'unused.test',
  DATABASE_NAME: 'portal_test',
  DATABASE_USER: 'unused',
  DATABASE_PASSWORD: 'unused',
};

/** Definitions in memory, with the same rules as the database: pointers guard every change. */
export class InMemoryDefinitionRepository implements DefinitionRepository {
  readonly rows = new Map<string, DefinitionState>();

  async find(ref: DefinitionRef): Promise<DefinitionState | undefined> {
    return this.rows.get(definitionId(ref));
  }

  async list(scope: DefinitionScope, systemId: string | null): Promise<DefinitionState[]> {
    return [...this.rows.values()].filter((s) => s.ref.scope === scope && s.ref.systemId === systemId);
  }

  async apply(change: DefinitionChange): Promise<void> {
    const id = definitionId(change.ref);
    const current = this.rows.get(id);
    if ((current?.activeVersion ?? null) !== change.expected.activeVersion || (current?.draftVersion ?? null) !== change.expected.draftVersion) {
      throw new ConcurrentChange(id);
    }
    let versions = [...(current?.versions ?? [])];
    if (change.newVersion) versions.push(change.newVersion);
    if (change.publication) {
      const { number, by, at } = change.publication;
      versions = versions.map((v) => (v.number === number ? { ...v, publishedBy: by, publishedAt: at } : v));
    }
    this.rows.set(id, { ref: change.ref, ...change.next, versions });
  }
}
