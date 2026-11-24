import { deploysResponse, documentsResponse, environmentsResponse, type CatalogEntry } from '@portal/contracts';
import {
  Avatar,
  Box,
  ChartBarIcon,
  DecisionIcon,
  DeploymentIcon,
  Inline,
  LinkIcon,
  Lozenge,
  PageIcon,
  ProjectPage,
  ScreenIcon,
  SettingsIcon,
  Stack,
  Text,
  token,
  type ProjectView,
} from '@solidvs/ui';
import { useEffect, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';

import { api } from '../api';
import { DataTable } from '../components/DataTable';
import { DocumentTable } from '../components/DocumentTable';
import { Loading } from '../components/PageShell';
import { rememberProject, useCatalog, useResource } from '../data/catalog';
import { ENVIRONMENT_LABEL, formatDate, LIFECYCLE, MANIFEST_LABEL, shortDigest, TYPE_LABEL } from '../data/labels';

function Section({ children }: { children: ReactNode }) {
  return <Box paddingBlock="space.16">{children}</Box>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Inline space="space.16" alignBlock="start">
      <Box style={{ width: '180px', flexShrink: 0 }}>
        <Text weight="medium">{label}</Text>
      </Box>
      <Text>{children}</Text>
    </Inline>
  );
}

function Summary({ entry }: { entry: CatalogEntry }) {
  return (
    <Section>
      <Stack space="space.12">
        {entry.description && <Text color="text.muted">{entry.description}</Text>}
        <Field label="Tipo">{TYPE_LABEL[entry.type]}</Field>
        <Field label="Ciclo de vida">
          <Lozenge appearance={LIFECYCLE[entry.lifecycle].appearance}>{LIFECYCLE[entry.lifecycle].label}</Lozenge>
        </Field>
        <Field label="Responsável">{entry.owner ?? '—'}</Field>
        <Field label="Superfícies">{entry.surfaces.length ? entry.surfaces.join(', ') : '—'}</Field>
        <Field label="Stack">{entry.stack ?? '—'}</Field>
        <Field label="Manifesto">{MANIFEST_LABEL[entry.manifest]}</Field>
        <Field label="Repositório">
          {entry.repository ? <a href={entry.repository.url}>{entry.repository.name}</a> : '—'}
        </Field>
        <Field label="Última alteração">{formatDate(entry.repository?.pushedAt ?? null)}</Field>
        {entry.manifest === 'none' && (
          <Text color="text.warning">
            Este repositório ainda não tem catalog-info.yaml: os dados acima são só o que o GitHub informa.
          </Text>
        )}
      </Stack>
    </Section>
  );
}

function Environments({ id }: { id: string }) {
  const data = useResource(() => api(environmentsResponse, `/api/projects/${id}/environments`), [id]);
  if (!data) return <Loading />;
  return (
    <Section>
      <Inline space="space.16" shouldWrap>
        {data.environments.map((environment) => (
          <Box
            key={environment.environment}
            padding="space.16"
            style={{ width: '360px', borderRadius: token('radius.8'), backgroundColor: token('surface.raised'), boxShadow: token('shadow.raised') }}
          >
            <Stack space="space.8">
              <Inline spread="space-between" alignBlock="center">
                <Text weight="bold">{ENVIRONMENT_LABEL[environment.environment]}</Text>
                {environment.image ? <Lozenge appearance="success">No ar</Lozenge> : <Lozenge>Não publicado</Lozenge>}
              </Inline>
              {environment.image ? (
                <>
                  <Text size="small" color="text.muted">
                    Imagem <code>{shortDigest(environment.digest)}</code>
                  </Text>
                  <Text size="small" color="text.muted">
                    {formatDate(environment.changedAt)} por {environment.changedBy ?? '—'}
                  </Text>
                  {environment.url && (
                    <Text size="small">
                      <a href={environment.url}>Arquivo na plataforma</a>
                    </Text>
                  )}
                </>
              ) : (
                <Text size="small" color="text.faint">
                  Sem arquivo deste sistema na plataforma.
                </Text>
              )}
            </Stack>
          </Box>
        ))}
      </Inline>
    </Section>
  );
}

function Deploys({ id }: { id: string }) {
  const data = useResource(() => api(deploysResponse, `/api/projects/${id}/deploys`), [id]);
  if (!data) return <Loading />;
  return (
    <Section>
      <DataTable
        rows={data.deploys}
        rowKey={(d) => `${d.environment}-${d.sha}`}
        empty="Nenhum deploy deste sistema pela plataforma."
        columns={[
          { id: 'environment', header: 'Ambiente', cell: (d) => ENVIRONMENT_LABEL[d.environment], width: '140px' },
          { id: 'message', header: 'Mudança', cell: (d) => <a href={d.url}>{d.message}</a> },
          { id: 'author', header: 'Por', cell: (d) => d.author ?? '—', width: '140px' },
          { id: 'date', header: 'Quando', cell: (d) => formatDate(d.date), width: '150px' },
        ]}
      />
    </Section>
  );
}

function Documents({ id, kind }: { id: string; kind: 'decisions' | 'procedures' }) {
  const data = useResource(() => api(documentsResponse, `/api/projects/${id}/${kind}`), [id, kind]);
  if (!data) return <Loading />;
  return (
    <Section>
      <DocumentTable
        documents={data.documents}
        empty={kind === 'decisions' ? 'Nenhuma decisão em docs/decisions.' : 'Nenhum procedimento em docs/procedures.'}
      />
    </Section>
  );
}

function Dependencies({ entry, catalog }: { entry: CatalogEntry; catalog: CatalogEntry[] }) {
  return (
    <Section>
      {entry.dependsOn.length === 0 ? (
        <Text color="text.faint">Nenhuma dependência declarada no manifesto.</Text>
      ) : (
        <Stack space="space.8">
          {entry.dependsOn.map((dependency) => {
            const target = catalog.find((e) => e.id === dependency);
            return (
              <Text key={dependency}>
                {target ? <Link to={`/projetos/${target.id}`}>{target.name}</Link> : dependency}
                {!target && <Text color="text.faint"> (fora do catálogo)</Text>}
              </Text>
            );
          })}
        </Stack>
      )}
    </Section>
  );
}

function Settings() {
  return (
    <Section>
      <Text color="text.muted">
        Variáveis e segredos de cada ambiente ficam no GitHub (repositório da plataforma da organização → Settings → Environments). Esta aba passa a
        mostrar os nomes, nunca os valores, quando o portal ganhar acesso a eles.
      </Text>
    </Section>
  );
}

const TABS: Omit<ProjectView, 'content'>[] = [
  { id: 'resumo', label: 'Resumo', icon: ChartBarIcon },
  { id: 'ambientes', label: 'Ambientes', icon: ScreenIcon },
  { id: 'deploys', label: 'Deploys', icon: DeploymentIcon },
  { id: 'decisoes', label: 'Decisões', icon: DecisionIcon },
  { id: 'procedimentos', label: 'Procedimentos', icon: PageIcon },
  { id: 'dependencias', label: 'Dependências', icon: LinkIcon },
  { id: 'configuracoes', label: 'Configurações', icon: SettingsIcon },
];

/** A project, with its views as tabs. Each tab has its own URL: /projetos/<id>/<tab>. */
export function Project() {
  const { projectId, tab } = useParams();
  const navigate = useNavigate();
  const catalog = useCatalog();
  const entry = catalog?.find((e) => e.id === projectId);
  useEffect(() => {
    if (entry) rememberProject(entry.id);
  }, [entry]);

  if (!catalog) return <Loading />;
  if (!entry) return <Navigate to="/projetos" replace />;
  const selected = TABS.some((t) => t.id === tab) ? tab! : 'resumo';
  const content: Record<string, ReactNode> = {
    resumo: <Summary entry={entry} />,
    ambientes: <Environments id={entry.id} />,
    deploys: <Deploys id={entry.id} />,
    decisoes: <Documents id={entry.id} kind="decisions" />,
    procedimentos: <Documents id={entry.id} kind="procedures" />,
    dependencias: <Dependencies entry={entry} catalog={catalog} />,
    configuracoes: <Settings />,
  };

  return (
    <ProjectPage
      spaceLabel="Projetos"
      title={entry.name}
      avatar={<Avatar size="small" appearance="square" name={entry.name} />}
      views={TABS.map((t) => ({ ...t, content: t.id === selected ? content[t.id] : null }))}
      selectedViewId={selected}
      onViewChange={(viewId) => navigate(`/projetos/${entry.id}/${viewId}`)}
      members={[]}
    />
  );
}
