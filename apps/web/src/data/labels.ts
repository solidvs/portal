import type { CatalogEntry, DeployChange } from '@portal/contracts';

/** Portuguese labels of catalog and operations values. */
export const TYPE_LABEL: Record<CatalogEntry['type'], string> = {
  web: 'Web',
  api: 'API',
  integration: 'Integração',
  job: 'Rotina',
  unknown: '—',
};

export const LIFECYCLE: Record<CatalogEntry['lifecycle'], { label: string; appearance: 'success' | 'inprogress' | 'removed' | 'default' }> = {
  production: { label: 'Produção', appearance: 'success' },
  development: { label: 'Em desenvolvimento', appearance: 'inprogress' },
  deprecated: { label: 'Descontinuado', appearance: 'removed' },
  unknown: { label: 'Não informado', appearance: 'default' },
};

export const MANIFEST_LABEL: Record<CatalogEntry['manifest'], string> = {
  repository: 'No repositório',
  central: 'Catálogo central',
  none: 'Sem manifesto',
};

export const ENVIRONMENT_LABEL: Record<DeployChange['environment'], string> = {
  staging: 'Homologação',
  production: 'Produção',
};

const DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function formatDate(value: string | null): string {
  return value ? DATE.format(new Date(value)) : '—';
}

/** First 12 hex characters of a digest, the way people quote it. */
export function shortDigest(digest: string | null): string {
  return digest ? digest.replace('sha256:', '').slice(0, 12) : '—';
}
