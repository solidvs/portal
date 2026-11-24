import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CLIENT } from '@solidvs/server';

import type { PrismaClient } from '../../../generated/prisma/client.js';
import { ConcurrentChange, type DefinitionRepository } from '../application/definitions.js';
import { definitionId, type DefinitionChange, type DefinitionRef, type DefinitionScope, type DefinitionState } from '../domain/definition.js';

type Row = Awaited<ReturnType<PrismaClient['definition']['findMany']>>[number] & {
  versions: Awaited<ReturnType<PrismaClient['definitionVersion']['findMany']>>;
};

function toState(row: Row): DefinitionState {
  return {
    ref: { key: row.key, scope: row.scope as DefinitionScope, systemId: row.systemId },
    activeVersion: row.activeVersion,
    draftVersion: row.draftVersion,
    versions: row.versions.map((v) => ({
      number: v.number,
      value: JSON.parse(v.value) as unknown,
      note: v.note,
      basedOn: v.basedOn,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
      publishedBy: v.publishedBy,
      publishedAt: v.publishedAt,
    })),
  };
}

/**
 * Infrastructure layer: definitions in the portal's database (ADR-0014, ADR-0016), with the
 * application login. A change is one transaction, guarded by the pointers it was computed from,
 * so two maintainers editing at once cannot overwrite each other.
 */
@Injectable()
export class PrismaDefinitionRepository implements DefinitionRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: PrismaClient) {}

  async find(ref: DefinitionRef): Promise<DefinitionState | undefined> {
    const row = await this.db.definition.findUnique({ where: { id: definitionId(ref) }, include: { versions: true } });
    return row ? toState(row) : undefined;
  }

  async list(scope: DefinitionScope, systemId: string | null): Promise<DefinitionState[]> {
    const rows = await this.db.definition.findMany({ where: { scope, systemId }, include: { versions: true } });
    return rows.map(toState);
  }

  async apply(change: DefinitionChange, updatedAt: Date): Promise<void> {
    const id = definitionId(change.ref);
    try {
      await this.db.$transaction(async (tx) => {
        const isNew = change.expected.activeVersion === null && change.expected.draftVersion === null && !(await tx.definition.findUnique({ where: { id } }));
        if (isNew) {
          await tx.definition.create({
            data: { id, key: change.ref.key, scope: change.ref.scope, systemId: change.ref.systemId, ...change.next, updatedAt },
          });
        } else {
          const moved = await tx.definition.updateMany({
            where: { id, activeVersion: change.expected.activeVersion, draftVersion: change.expected.draftVersion },
            data: { ...change.next, updatedAt },
          });
          if (moved.count !== 1) throw new ConcurrentChange(id);
        }
        if (change.newVersion) {
          await tx.definitionVersion.create({
            data: { definitionId: id, ...change.newVersion, value: JSON.stringify(change.newVersion.value) },
          });
        }
        if (change.publication) {
          const stamped = await tx.definitionVersion.updateMany({
            where: { definitionId: id, number: change.publication.number, publishedAt: null },
            data: { publishedBy: change.publication.by, publishedAt: change.publication.at },
          });
          if (stamped.count !== 1) throw new ConcurrentChange(id);
        }
      });
    } catch (error) {
      // Two first drafts at once: the second creation collides on the primary key.
      if ((error as { code?: string }).code === 'P2002') throw new ConcurrentChange(id);
      throw error;
    }
  }
}
