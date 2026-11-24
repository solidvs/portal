import { z } from 'zod';

/**
 * Response contracts of the portal API. The API validates what it sends against these schemas and
 * the web app validates what it receives.
 */

/** `GET /api/auth/me`: who is signed in (shape defined by @solidvs/server). */
export const meResponse = z.object({
  user: z.object({
    username: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    department: z.string().nullable(),
  }),
  roles: z.array(z.string()),
  access: z.object({ by: z.enum(['department', 'group']), value: z.string() }),
  csrfToken: z.string(),
});
export type MeResponse = z.infer<typeof meResponse>;

// --- Catalog -------------------------------------------------------------------------------------

export const systemType = z.enum(['web', 'api', 'integration', 'job', 'unknown']);
export const lifecycle = z.enum(['development', 'production', 'deprecated', 'unknown']);
/** Where the catalog entry came from. */
export const manifestSource = z.enum(['repository', 'central', 'none']);

export const catalogEntry = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  type: systemType,
  lifecycle,
  owner: z.string().nullable(),
  surfaces: z.array(z.string()),
  stack: z.string().nullable(),
  dependsOn: z.array(z.string()),
  manifest: manifestSource,
  repository: z
    .object({
      name: z.string(),
      url: z.string(),
      language: z.string().nullable(),
      pushedAt: z.string().nullable(),
      archived: z.boolean(),
    })
    .nullable(),
});
export type CatalogEntry = z.infer<typeof catalogEntry>;

export const catalogResponse = z.object({ entries: z.array(catalogEntry) });
export type CatalogResponse = z.infer<typeof catalogResponse>;

// --- Operations ----------------------------------------------------------------------------------

export const environmentName = z.enum(['staging', 'production']);

export const environmentState = z.object({
  environment: environmentName,
  /** Image reference as in the platform file; null when the system is not deployed there. */
  image: z.string().nullable(),
  digest: z.string().nullable(),
  changedAt: z.string().nullable(),
  changedBy: z.string().nullable(),
  url: z.string().nullable(),
});
export type EnvironmentState = z.infer<typeof environmentState>;
export const environmentsResponse = z.object({ environments: z.array(environmentState) });
export type EnvironmentsResponse = z.infer<typeof environmentsResponse>;

export const deployChange = z.object({
  system: z.string(),
  environment: environmentName,
  sha: z.string(),
  message: z.string(),
  author: z.string().nullable(),
  date: z.string(),
  url: z.string(),
});
export type DeployChange = z.infer<typeof deployChange>;
export const deploysResponse = z.object({ deploys: z.array(deployChange) });
export type DeploysResponse = z.infer<typeof deploysResponse>;

// --- Knowledge -----------------------------------------------------------------------------------

export const documentSummary = z.object({
  file: z.string(),
  title: z.string(),
  status: z.string().nullable(),
  url: z.string(),
});
export type DocumentSummary = z.infer<typeof documentSummary>;
export const documentsResponse = z.object({ documents: z.array(documentSummary) });
export type DocumentsResponse = z.infer<typeof documentsResponse>;

// --- Overview ------------------------------------------------------------------------------------

export const overviewResponse = z.object({
  release: z.string(),
  projects: z.number().int(),
  withManifest: z.number().int(),
  deployedToProduction: z.number().int(),
  deploysLast7Days: z.number().int(),
  latestDeploys: z.array(deployChange),
});
export type OverviewResponse = z.infer<typeof overviewResponse>;

// Administered definitions (ADR-0014) ------------------------------------------------------------

/** One version of a definition, for the administration screens. */
export const definitionVersion = z.object({
  number: z.number().int().positive(),
  value: z.unknown(),
  note: z.string(),
  basedOn: z.number().int().positive().nullable(),
  createdBy: z.string(),
  createdAt: z.iso.datetime(),
  publishedBy: z.string().nullable(),
  publishedAt: z.iso.datetime().nullable(),
});
export type DefinitionVersion = z.infer<typeof definitionVersion>;

/** A kind of definition with its active version and pending draft. */
export const definitionSummary = z.object({
  key: z.string(),
  scope: z.enum(['platform', 'system']),
  systemId: z.string().nullable(),
  public: z.boolean(),
  label: z.string(),
  description: z.string(),
  default: z.unknown(),
  active: definitionVersion.nullable(),
  draft: definitionVersion.nullable(),
});
export type DefinitionSummary = z.infer<typeof definitionSummary>;

/** `GET /api/admin/definitions[?systemId=]`. */
export const definitionSummariesResponse = z.object({ definitions: z.array(definitionSummary) });
export type DefinitionSummariesResponse = z.infer<typeof definitionSummariesResponse>;

/** `GET /api/admin/definitions/:key/versions[?systemId=]`: newest first. */
export const definitionVersionsResponse = z.object({
  activeVersion: z.number().int().positive().nullable(),
  draftVersion: z.number().int().positive().nullable(),
  versions: z.array(definitionVersion),
});
export type DefinitionVersionsResponse = z.infer<typeof definitionVersionsResponse>;

/** `POST /api/admin/definitions/:key/drafts`: body. `value: null` means "no value". */
export const saveDraftRequest = z.object({
  systemId: z.string().regex(/^[a-z][a-z0-9-]{0,59}$/).optional(),
  value: z.unknown(),
  note: z.string().trim().min(1, 'descreva a mudança').max(500),
});
export type SaveDraftRequest = z.infer<typeof saveDraftRequest>;

/** `POST /api/admin/definitions/:key/publish`: body. Publishing an earlier version rolls back. */
export const publishRequest = z.object({
  systemId: z.string().regex(/^[a-z][a-z0-9-]{0,59}$/).optional(),
  version: z.number().int().positive(),
});
export type PublishRequest = z.infer<typeof publishRequest>;

/** Read API for systems and the public endpoint: active values by key. */
export const definitionValuesResponse = z.object({ definitions: z.record(z.string(), z.unknown()) });
export type DefinitionValuesResponse = z.infer<typeof definitionValuesResponse>;
