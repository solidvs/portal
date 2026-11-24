import { databaseConfigSchema, loadConfig, platformConfigSchema } from '@solidvs/server';
import { z } from 'zod';

/**
 * Configuration of the portal. The platform delivers it as one JSON file at /run/secrets/config
 * (local development: CONFIG_FILE=config.local.json). The system refuses to start when a key is
 * missing.
 *
 * The DATABASE_* keys carry the application login of the portal's database (ADR-0016); the
 * migration login never reaches the running service.
 *
 * GitHub access: in staging and production, a GitHub App with read-only permissions (metadata,
 * contents, actions) installed on the organization. For local development only, a personal token.
 */
export const configSchema = platformConfigSchema
  .extend(databaseConfigSchema.shape)
  .extend({
    /** Release identifier set by the platform at deploy time; "dev" locally. */
    RELEASE: z.string().default('dev'),
    /** GitHub organization of the installation (owner of the platform and system repositories). */
    GITHUB_ORG: z.string().min(1),
    /** Repository with the desired state of every environment (ADR-0007). */
    PLATFORM_REPO: z.string().default('platform'),
    /** Repository with the standard stack and its decisions. */
    STANDARDS_REPO: z.string().default('standard'),
    /** Repository with catalog entries of systems that have no manifest yet. */
    CATALOG_REPO: z.string().default('catalog'),
    GITHUB_APP_ID: z.string().optional(),
    /** PEM private key of the GitHub App. */
    GITHUB_APP_PRIVATE_KEY: z.string().optional(),
    GITHUB_APP_INSTALLATION_ID: z.string().optional(),
    /** Local development only. */
    GITHUB_TOKEN: z.string().optional(),
    /** Minutes GitHub answers are kept in memory. */
    GITHUB_CACHE_MINUTES: z.coerce.number().int().positive().default(5),
  })
  .refine(
    (c) => Boolean(c.GITHUB_APP_ID && c.GITHUB_APP_PRIVATE_KEY && c.GITHUB_APP_INSTALLATION_ID) || Boolean(c.GITHUB_TOKEN),
    {
      message:
        'GitHub access: set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY and GITHUB_APP_INSTALLATION_ID (or GITHUB_TOKEN for local development)',
      path: ['GITHUB_APP_ID'],
    },
  );

export type Config = z.infer<typeof configSchema>;

export function readConfig(): Config {
  return loadConfig(configSchema);
}
