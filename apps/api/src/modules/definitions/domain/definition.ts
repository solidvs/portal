/**
 * Domain layer: administered definitions and their versions (ADR-0014, items 2 and 4). Plain
 * TypeScript: no framework, no I/O.
 *
 * - Editing writes a new draft version; publishing makes it the active one.
 * - Versions never change: value, note, author and origin are written once; publication is
 *   stamped once.
 * - Rolling back republishes an earlier value as a new version, so history only grows.
 */
export type DefinitionScope = 'platform' | 'system';

export type DefinitionRef = {
  readonly key: string;
  readonly scope: DefinitionScope;
  /** Catalog id, for the system scope only. */
  readonly systemId: string | null;
};

export type DefinitionVersion = {
  readonly number: number;
  readonly value: unknown;
  readonly note: string;
  /** The active version when this one was written. */
  readonly basedOn: number | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly publishedBy: string | null;
  readonly publishedAt: Date | null;
};

export type Pointers = { readonly activeVersion: number | null; readonly draftVersion: number | null };

export type DefinitionState = Pointers & {
  readonly ref: DefinitionRef;
  readonly versions: readonly DefinitionVersion[];
};

/** What one edit or publication changes, applied at once by the repository. */
export type DefinitionChange = {
  readonly ref: DefinitionRef;
  /** The pointers the change was computed from: the repository refuses it if they moved. */
  readonly expected: Pointers;
  readonly next: Pointers;
  readonly newVersion?: DefinitionVersion;
  readonly publication?: { readonly number: number; readonly by: string; readonly at: Date };
};

export class DefinitionRuleError extends Error {}

export function definitionId(ref: DefinitionRef): string {
  return ref.scope === 'platform' ? `platform/${ref.key}` : `system/${ref.systemId}/${ref.key}`;
}

const NO_POINTERS: Pointers = { activeVersion: null, draftVersion: null };

function pointersOf(state: DefinitionState | undefined): Pointers {
  return state ? { activeVersion: state.activeVersion, draftVersion: state.draftVersion } : NO_POINTERS;
}

function nextNumber(state: DefinitionState | undefined): number {
  return Math.max(0, ...(state?.versions ?? []).map((v) => v.number)) + 1;
}

function cleanNote(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length === 0 || trimmed.length > 500) throw new DefinitionRuleError('a nota da mudança tem de 1 a 500 caracteres');
  return trimmed;
}

/** A new draft, already validated against its kind; it replaces any previous unpublished draft. */
export function saveDraft(
  ref: DefinitionRef,
  state: DefinitionState | undefined,
  input: { value: unknown; note: string },
  author: string,
  now: Date,
): DefinitionChange {
  const expected = pointersOf(state);
  const version: DefinitionVersion = {
    number: nextNumber(state),
    value: input.value,
    note: cleanNote(input.note),
    basedOn: expected.activeVersion,
    createdBy: author,
    createdAt: now,
    publishedBy: null,
    publishedAt: null,
  };
  return { ref, expected, next: { activeVersion: expected.activeVersion, draftVersion: version.number }, newVersion: version };
}

/**
 * Publishes a version: the current draft becomes active; an earlier published version comes back
 * as a new version (rollback). Older drafts that were never published cannot be published.
 */
export function publish(state: DefinitionState | undefined, number: number, publisher: string, now: Date): DefinitionChange {
  const version = state?.versions.find((v) => v.number === number);
  if (!state || !version) throw new DefinitionRuleError(`a versão ${number} não existe`);
  const expected = pointersOf(state);
  if (number === state.activeVersion) throw new DefinitionRuleError(`a versão ${number} já é a ativa`);

  if (version.publishedAt === null) {
    if (number !== state.draftVersion) throw new DefinitionRuleError(`a versão ${number} é um rascunho substituído; só o rascunho atual pode ser publicado`);
    return {
      ref: state.ref,
      expected,
      next: { activeVersion: number, draftVersion: null },
      publication: { number, by: publisher, at: now },
    };
  }

  const republished: DefinitionVersion = {
    number: nextNumber(state),
    value: version.value,
    note: `Republicação da versão ${number}`,
    basedOn: state.activeVersion,
    createdBy: publisher,
    createdAt: now,
    publishedBy: publisher,
    publishedAt: now,
  };
  return { ref: state.ref, expected, next: { activeVersion: republished.number, draftVersion: state.draftVersion }, newVersion: republished };
}

/** The active value, or undefined when the definition was never published. */
export function activeValue(state: DefinitionState | undefined): { value: unknown } | undefined {
  const active = state?.versions.find((v) => v.number === state.activeVersion);
  return active ? { value: active.value } : undefined;
}
