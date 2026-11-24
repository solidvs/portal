import type { DocumentSummary } from '@portal/contracts';
import { Lozenge } from '@solidvs/ui';

import { DataTable } from './DataTable';

function statusAppearance(status: string): 'success' | 'inprogress' | 'removed' | 'moved' | 'default' {
  const value = status.toLowerCase();
  if (value.startsWith('accepted') || value.startsWith('aceit')) return 'success';
  if (value.startsWith('proposed') || value.startsWith('propost')) return 'inprogress';
  if (value.startsWith('superseded') || value.startsWith('substitu')) return 'moved';
  if (value.startsWith('deprecated') || value.startsWith('obsolet')) return 'removed';
  return 'default';
}

const STATUS_LABEL: Record<string, string> = { accepted: 'Aceita', proposed: 'Proposta', superseded: 'Substituída', deprecated: 'Obsoleta' };

function statusLabel(status: string): string {
  const key = status.toLowerCase().split(/[\s(]/)[0] ?? '';
  return STATUS_LABEL[key] ?? status;
}

/** Decision records or procedures, with their status when they have one. */
export function DocumentTable({ documents, empty }: { documents: DocumentSummary[]; empty: string }) {
  return (
    <DataTable
      rows={documents}
      rowKey={(d) => d.file}
      empty={empty}
      columns={[
        { id: 'title', header: 'Documento', cell: (d) => <a href={d.url}>{d.title}</a> },
        {
          id: 'status',
          header: 'Situação',
          cell: (d) => (d.status ? <Lozenge appearance={statusAppearance(d.status)}>{statusLabel(d.status)}</Lozenge> : '—'),
          width: '160px',
        },
      ]}
    />
  );
}
