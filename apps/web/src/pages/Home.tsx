import { overviewResponse } from '@portal/contracts';
import { Box, Inline, Stack, Text, token } from '@solidvs/ui';
import { Link } from 'react-router';

import { api } from '../api';
import { useSession } from '../auth/session';
import { DataTable } from '../components/DataTable';
import { Loading, PageShell } from '../components/PageShell';
import { ENVIRONMENT_LABEL, formatDate } from '../data/labels';
import { useResource } from '../data/catalog';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Box
      padding="space.16"
      style={{
        minWidth: '200px',
        borderRadius: token('radius.8'),
        backgroundColor: token('surface.raised'),
        boxShadow: token('shadow.raised'),
      }}
    >
      <Stack space="space.4">
        <Text size="small" color="text.muted">
          {label}
        </Text>
        <span style={{ font: token('font.metric.l'), color: token('text') }}>{value}</span>
      </Stack>
    </Box>
  );
}

/** Start page: the state of the catalog and the latest deploys. */
export function Home() {
  const me = useSession();
  const overview = useResource(() => api(overviewResponse, '/api/overview'), []);

  return (
    <PageShell title={`Olá, ${me.user.name}`} description="Todos os sistemas da organização, onde rodam e o que mudou.">
      {!overview ? (
        <Loading />
      ) : (
        <Stack space="space.24">
          <Inline space="space.16" shouldWrap>
            <Metric label="Projetos no catálogo" value={overview.projects} />
            <Metric label="Com manifesto" value={overview.withManifest} />
            <Metric label="Em produção pela plataforma" value={overview.deployedToProduction} />
            <Metric label="Deploys nos últimos 7 dias" value={overview.deploysLast7Days} />
          </Inline>
          <Stack space="space.8">
            <Text weight="bold">Últimos deploys</Text>
            <DataTable
              rows={overview.latestDeploys}
              rowKey={(d) => `${d.environment}-${d.sha}`}
              empty="Nenhum deploy pela plataforma ainda."
              columns={[
                { id: 'system', header: 'Projeto', cell: (d) => <Link to={`/projetos/${d.system}/deploys`}>{d.system}</Link> },
                { id: 'environment', header: 'Ambiente', cell: (d) => ENVIRONMENT_LABEL[d.environment] },
                { id: 'message', header: 'Mudança', cell: (d) => <a href={d.url}>{d.message}</a> },
                { id: 'author', header: 'Por', cell: (d) => d.author ?? '—' },
                { id: 'date', header: 'Quando', cell: (d) => formatDate(d.date) },
              ]}
            />
          </Stack>
          <Text size="small" color="text.faint">
            Você entrou por {me.access.by === 'department' ? 'departamento' : 'grupo'} {me.access.value} · versão {overview.release}
          </Text>
        </Stack>
      )}
    </PageShell>
  );
}
