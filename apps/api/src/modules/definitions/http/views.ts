import type { DefinitionSummary as SummaryView, DefinitionVersion as VersionView } from '@portal/contracts';

import type { DefinitionSummary } from '../application/definitions.js';
import type { DefinitionVersion } from '../domain/definition.js';

export function versionView(version: DefinitionVersion): VersionView {
  return {
    number: version.number,
    value: version.value,
    note: version.note,
    basedOn: version.basedOn,
    createdBy: version.createdBy,
    createdAt: version.createdAt.toISOString(),
    publishedBy: version.publishedBy,
    publishedAt: version.publishedAt?.toISOString() ?? null,
  };
}

export function summaryView(summary: DefinitionSummary): SummaryView {
  const { kind } = summary;
  return {
    key: kind.key,
    scope: kind.scope,
    systemId: summary.systemId,
    public: kind.public,
    label: kind.label,
    description: kind.description,
    default: kind.default,
    active: summary.active ? versionView(summary.active) : null,
    draft: summary.draft ? versionView(summary.draft) : null,
  };
}
