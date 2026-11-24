import { deploysResponse } from '@portal/contracts';
import { Lozenge } from '@solidvs/ui';
import { Link } from 'react-router';

import { api } from '../api';
import { DataTable } from '../components/DataTable';
import { Loading, PageShell } from '../components/PageShell';
import { useResource } from '../data/catalog';
import { ENVIRONMENT_LABEL, formatDate } from '../data/labels';

/** Every deploy of every system: each change to a platform file is one deploy. */
export function Deploys() {
  const deploys = useResource(() => api(deploysResponse, '/api/deploys'), []);
  return (
    <PageShell title="Deploys" description="Cada mudança aprovada no repositório da plataforma, em homologação e produção.">
      {!deploys ? (
        <Loading />
      ) : (
        <DataTable
          rows={deploys.deploys}
          rowKey={(d) => `${d.environment}-${d.system}-${d.sha}`}
          empty="Nenhum deploy pela plataforma ainda."
          columns={[
            { id: 'system', header: 'Projeto', cell: (d) => <Link to={`/projetos/${d.system}/deploys`}>{d.system}</Link>, width: '180px' },
            {
              id: 'environment',
              header: 'Ambiente',
              cell: (d) => <Lozenge appearance={d.environment === 'production' ? 'success' : 'inprogress'}>{ENVIRONMENT_LABEL[d.environment]}</Lozenge>,
              width: '140px',
            },
            { id: 'message', header: 'Mudança', cell: (d) => <a href={d.url}>{d.message}</a> },
            { id: 'author', header: 'Por', cell: (d) => d.author ?? '—', width: '140px' },
            { id: 'date', header: 'Quando', cell: (d) => formatDate(d.date), width: '150px' },
          ]}
        />
      )}
    </PageShell>
  );
}
