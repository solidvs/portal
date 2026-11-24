import { describe, expect, it } from 'vitest';

import { activeValue, definitionId, DefinitionRuleError, publish, saveDraft, type DefinitionChange, type DefinitionState } from './definition.js';

const REF = { key: 'identity.forgotPasswordUrl', scope: 'platform' as const, systemId: null };
const at = (minute: number) => new Date(Date.UTC(2026, 10, 24, 12, minute));

/** Applies a change the way the repository does. */
function apply(state: DefinitionState | undefined, change: DefinitionChange): DefinitionState {
  let versions = [...(state?.versions ?? [])];
  if (change.newVersion) versions.push(change.newVersion);
  if (change.publication) {
    const { number, by, at: when } = change.publication;
    versions = versions.map((v) => (v.number === number ? { ...v, publishedBy: by, publishedAt: when } : v));
  }
  return { ref: change.ref, ...change.next, versions };
}

describe('administered definitions (ADR-0014)', () => {
  it('names definitions by scope', () => {
    expect(definitionId(REF)).toBe('platform/identity.forgotPasswordUrl');
    expect(definitionId({ key: 'automation.rules', scope: 'system', systemId: 'orders' })).toBe('system/orders/automation.rules');
  });

  it('draft, publish, then a new draft based on the active version', () => {
    let state = apply(undefined, saveDraft(REF, undefined, { value: 'https://a.example', note: ' Primeiro link ' }, 'ana', at(1)));
    expect(state).toMatchObject({ activeVersion: null, draftVersion: 1 });
    expect(state.versions[0]).toMatchObject({ number: 1, note: 'Primeiro link', basedOn: null, createdBy: 'ana', publishedAt: null });
    expect(activeValue(state)).toBeUndefined();

    state = apply(state, publish(state, 1, 'carla', at(2)));
    expect(state).toMatchObject({ activeVersion: 1, draftVersion: null });
    expect(state.versions[0]).toMatchObject({ publishedBy: 'carla', publishedAt: at(2) });
    expect(activeValue(state)).toEqual({ value: 'https://a.example' });

    state = apply(state, saveDraft(REF, state, { value: 'https://b.example', note: 'Novo portal' }, 'ana', at(3)));
    expect(state.versions[1]).toMatchObject({ number: 2, basedOn: 1 });
    expect(activeValue(state)).toEqual({ value: 'https://a.example' });
  });

  it('a new draft replaces the previous one, which can no longer be published', () => {
    let state = apply(undefined, saveDraft(REF, undefined, { value: 'https://a.example', note: 'a' }, 'ana', at(1)));
    state = apply(state, saveDraft(REF, state, { value: 'https://b.example', note: 'b' }, 'ana', at(2)));
    expect(state.draftVersion).toBe(2);
    expect(() => publish(state, 1, 'carla', at(3))).toThrow(DefinitionRuleError);
  });

  it('rolls back by republishing an earlier value as a new version', () => {
    let state = apply(undefined, saveDraft(REF, undefined, { value: 'https://a.example', note: 'a' }, 'ana', at(1)));
    state = apply(state, publish(state, 1, 'carla', at(2)));
    state = apply(state, saveDraft(REF, state, { value: 'https://b.example', note: 'b' }, 'ana', at(3)));
    state = apply(state, publish(state, 2, 'carla', at(4)));

    state = apply(state, publish(state, 1, 'carla', at(5)));
    expect(state).toMatchObject({ activeVersion: 3, draftVersion: null });
    expect(state.versions[2]).toMatchObject({ number: 3, value: 'https://a.example', basedOn: 2, note: 'Republicação da versão 1', publishedBy: 'carla' });
    expect(state.versions.map((v) => v.number)).toEqual([1, 2, 3]);
  });

  it('refuses an empty note, an unknown version and the active one', () => {
    expect(() => saveDraft(REF, undefined, { value: null, note: '   ' }, 'ana', at(1))).toThrow(DefinitionRuleError);
    let state = apply(undefined, saveDraft(REF, undefined, { value: null, note: 'Sem link' }, 'ana', at(1)));
    expect(() => publish(state, 9, 'carla', at(2))).toThrow('não existe');
    state = apply(state, publish(state, 1, 'carla', at(2)));
    expect(() => publish(state, 1, 'carla', at(3))).toThrow('já é a ativa');
  });

  it('every change carries the pointers it was computed from', () => {
    const state = apply(undefined, saveDraft(REF, undefined, { value: null, note: 'a' }, 'ana', at(1)));
    expect(publish(state, 1, 'carla', at(2)).expected).toEqual({ activeVersion: null, draftVersion: 1 });
  });
});
