import { AngleBracketsIcon, Inline, Lozenge, Text } from '@solidvs/ui';
import { Link } from 'react-router';

import { DataTable } from '../components/DataTable';
import { Loading, PageShell } from '../components/PageShell';
import { useCatalog } from '../data/catalog';
import { formatDate, LIFECYCLE, MANIFEST_LABEL, TYPE_LABEL } from '../data/labels';

/** "Mais projetos": every system of the organization. */
export function Projects() {
  const catalog = useCatalog();
  return (
    <PageShell title="Projetos" description="Cada repositório da organização e cada entrada do catálogo central.">
      {!catalog ? (
        <Loading />
      ) : (
        <DataTable
          rows={catalog}
          rowKey={(entry) => entry.id}
          empty="Nenhum projeto encontrado."
          columns={[
            {
              id: 'name',
              header: 'Projeto',
              cell: (entry) => (
                <Inline space="space.8" alignBlock="center">
                  <AngleBracketsIcon label="" />
                  <Link to={`/projetos/${entry.id}`}>{entry.name}</Link>
                </Inline>
              ),
            },
            { id: 'type', header: 'Tipo', cell: (entry) => TYPE_LABEL[entry.type], width: '110px' },
            {
              id: 'lifecycle',
              header: 'Ciclo de vida',
              cell: (entry) => <Lozenge appearance={LIFECYCLE[entry.lifecycle].appearance}>{LIFECYCLE[entry.lifecycle].label}</Lozenge>,
              width: '170px',
            },
            {
              id: 'manifest',
              header: 'Manifesto',
              cell: (entry) => (
                <Text color={entry.manifest === 'none' ? 'text.warning' : 'text'}>{MANIFEST_LABEL[entry.manifest]}</Text>
              ),
              width: '150px',
            },
            { id: 'language', header: 'Linguagem', cell: (entry) => entry.repository?.language ?? '—', width: '120px' },
            { id: 'pushed', header: 'Última alteração', cell: (entry) => formatDate(entry.repository?.pushedAt ?? null), width: '150px' },
          ]}
        />
      )}
    </PageShell>
  );
}
