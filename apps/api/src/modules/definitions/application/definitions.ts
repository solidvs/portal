import {
  activeValue,
  DefinitionRuleError,
  publish,
  saveDraft,
  type DefinitionChange,
  type DefinitionRef,
  type DefinitionScope,
  type DefinitionState,
  type DefinitionVersion,
} from '../domain/definition.js';

/** A kind of definition as the use cases need it (ADR-0014, item 3). */
export type KindInfo = {
  readonly key: string;
  readonly scope: DefinitionScope;
  readonly public: boolean;
  readonly label: string;
  readonly description: string;
  readonly default: unknown;
};

/** The kinds of the platform kit; implemented in infrastructure. */
export interface DefinitionKinds {
  find(key: string): KindInfo | undefined;
  list(scope: DefinitionScope): KindInfo[];
  /** The value as the kind's schema accepts it, or the problems in Portuguese. */
  validate(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; problems: string[] };
}

export interface DefinitionRepository {
  find(ref: DefinitionRef): Promise<DefinitionState | undefined>;
  /** Every definition of a scope, with its versions. */
  list(scope: DefinitionScope, systemId: string | null): Promise<DefinitionState[]>;
  /** Applies a change at once; rejects with ConcurrentChange if the pointers moved meanwhile. */
  apply(change: DefinitionChange, updatedAt: Date): Promise<void>;
}

/** The audit trail as the use cases see it; the platform's AuditTrail fits it. */
export interface AuditRecorder {
  record(event: { actor: string; action: string; subjectType: string; subjectId?: string; details?: Record<string, unknown> }): Promise<void>;
}

export class UnknownDefinition extends Error {}
export class InvalidDefinitionValue extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join('; '));
  }
}
export class ConcurrentChange extends Error {}
export { DefinitionRuleError };

export type DefinitionSummary = {
  readonly kind: KindInfo;
  readonly systemId: string | null;
  readonly active: DefinitionVersion | null;
  readonly draft: DefinitionVersion | null;
};

function versionOf(state: DefinitionState | undefined, number: number | null | undefined): DefinitionVersion | null {
  return state?.versions.find((v) => v.number === number) ?? null;
}

const idOf = (ref: DefinitionRef) => (ref.scope === 'platform' ? ref.key : `${ref.systemId}/${ref.key}`);

/**
 * Application layer: the use cases of administered definitions. Every edit and publication is
 * validated against its kind and written to the audit trail (A.8.15, A.8.32).
 */
export class Definitions {
  constructor(
    private readonly kinds: DefinitionKinds,
    private readonly repository: DefinitionRepository,
    private readonly audit: AuditRecorder,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** Resolves a key and an optional system to a definition of a known kind. */
  ref(key: string, systemId: string | null): { ref: DefinitionRef; kind: KindInfo } {
    const kind = this.kinds.find(key);
    if (!kind) throw new UnknownDefinition(key);
    if (kind.scope === 'platform' && systemId !== null) throw new DefinitionRuleError(`${key} vale para a plataforma inteira, não para um sistema`);
    if (kind.scope === 'system' && systemId === null) throw new DefinitionRuleError(`${key} é definido por sistema: informe o sistema`);
    return { ref: { key, scope: kind.scope, systemId }, kind };
  }

  /** Every kind of a scope, with its active version and draft, for the administration screen. */
  async summaries(scope: DefinitionScope, systemId: string | null): Promise<DefinitionSummary[]> {
    const states = await this.repository.list(scope, systemId);
    return this.kinds.list(scope).map((kind) => {
      const state = states.find((s) => s.ref.key === kind.key);
      return { kind, systemId, active: versionOf(state, state?.activeVersion), draft: versionOf(state, state?.draftVersion) };
    });
  }

  async versions(key: string, systemId: string | null): Promise<{ state: DefinitionState | undefined; versions: DefinitionVersion[] }> {
    const { ref } = this.ref(key, systemId);
    const state = await this.repository.find(ref);
    return { state, versions: [...(state?.versions ?? [])].sort((a, b) => b.number - a.number) };
  }

  async saveDraft(key: string, systemId: string | null, input: { value: unknown; note: string }, actor: string): Promise<DefinitionVersion> {
    const { ref } = this.ref(key, systemId);
    const checked = this.kinds.validate(key, input.value);
    if (!checked.ok) throw new InvalidDefinitionValue(checked.problems);
    const now = this.now();
    const change = saveDraft(ref, await this.repository.find(ref), { value: checked.value, note: input.note }, actor, now);
    await this.repository.apply(change, now);
    await this.audit.record({
      actor,
      action: 'definition.draft_saved',
      subjectType: 'definition',
      subjectId: idOf(ref),
      details: { version: change.newVersion!.number, basedOn: change.newVersion!.basedOn },
    });
    return change.newVersion!;
  }

  async publish(key: string, systemId: string | null, version: number, actor: string): Promise<number> {
    const { ref } = this.ref(key, systemId);
    const state = await this.repository.find(ref);
    const now = this.now();
    const change = publish(state, version, actor, now);
    // A kind's schema may have tightened since the version was written: never publish a value
    // that systems would refuse.
    const value = state!.versions.find((v) => v.number === version)!.value;
    const checked = this.kinds.validate(key, value);
    if (!checked.ok) throw new InvalidDefinitionValue(checked.problems);
    await this.repository.apply(change, now);
    const active = change.next.activeVersion!;
    await this.audit.record({
      actor,
      action: change.newVersion ? 'definition.republished' : 'definition.published',
      subjectType: 'definition',
      subjectId: idOf(ref),
      details: { version: active, previous: change.expected.activeVersion, ...(change.newVersion ? { republishedFrom: version } : {}) },
    });
    return active;
  }

  /**
   * Active values of a scope, by key: what systems read. A kind never published gets its
   * default; `onlyPublic` keeps the kinds that may be served without authentication.
   */
  async activeValues(scope: DefinitionScope, systemId: string | null, options: { onlyPublic?: boolean } = {}): Promise<Record<string, unknown>> {
    const states = await this.repository.list(scope, systemId);
    const values: Record<string, unknown> = {};
    for (const kind of this.kinds.list(scope)) {
      if (options.onlyPublic && !kind.public) continue;
      const active = activeValue(states.find((s) => s.ref.key === kind.key));
      values[kind.key] = active ? active.value : kind.default;
    }
    return values;
  }
}
