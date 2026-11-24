import { DEFINITION_KINDS, isDefinitionKey, parseDefinitionValue } from '@solidvs/server';

import type { DefinitionKinds, KindInfo } from '../application/definitions.js';
import type { DefinitionScope } from '../domain/definition.js';

/** The kinds declared by the platform kit (`DEFINITION_KINDS` of @solidvs/server). */
export class PlatformDefinitionKinds implements DefinitionKinds {
  find(key: string): KindInfo | undefined {
    if (!isDefinitionKey(key)) return undefined;
    const kind = DEFINITION_KINDS[key];
    return { key: kind.key, scope: kind.scope, public: kind.public, label: kind.label, description: kind.description, default: kind.default };
  }

  list(scope: DefinitionScope): KindInfo[] {
    return Object.keys(DEFINITION_KINDS)
      .map((key) => this.find(key)!)
      .filter((kind) => kind.scope === scope);
  }

  validate(key: string, value: unknown): { ok: true; value: unknown } | { ok: false; problems: string[] } {
    if (!isDefinitionKey(key)) return { ok: false, problems: [`tipo de definição desconhecido: ${key}`] };
    const result = parseDefinitionValue(key, value);
    return result.success ? { ok: true, value: result.data } : { ok: false, problems: result.error.issues.map((issue) => issue.message) };
  }
}
