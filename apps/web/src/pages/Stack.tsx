import { documentsResponse } from '@portal/contracts';

import { api } from '../api';
import { DocumentTable } from '../components/DocumentTable';
import { Loading, PageShell } from '../components/PageShell';
import { useResource } from '../data/catalog';

/** The standard stack: its decision records, as written in the standards repository. */
export function Stack() {
  const decisions = useResource(() => api(documentsResponse, '/api/stack/decisions'), []);
  return (
    <PageShell title="Arquitetura" description="As decisões que todo sistema da plataforma segue.">
      {!decisions ? <Loading /> : <DocumentTable documents={decisions.documents} empty="Nenhuma decisão registrada." />}
    </PageShell>
  );
}
