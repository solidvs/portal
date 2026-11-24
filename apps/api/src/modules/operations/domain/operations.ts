import { parse } from 'yaml';

export type EnvironmentName = 'staging' | 'production';
export const ENVIRONMENTS: readonly EnvironmentName[] = ['staging', 'production'];

/** Platform file of a system in an environment (ADR-0007). */
export function environmentFile(system: string, environment: EnvironmentName): string {
  return `environments/${environment}/${system}.compose.yaml`;
}

/** System id from a platform file name, or undefined for anything else. */
export function systemOfFile(fileName: string): string | undefined {
  return /^([a-z0-9][a-z0-9-]*)\.compose\.yaml$/.exec(fileName)?.[1];
}

/** The image of the system's first service, as pinned in the platform file. */
export function imageOf(composeText: string): { image: string; digest: string | null } | undefined {
  try {
    const document = parse(composeText) as { services?: Record<string, { image?: unknown }> } | null;
    const image = Object.values(document?.services ?? {}).find((service) => typeof service.image === 'string')?.image as string | undefined;
    if (!image) return undefined;
    return { image, digest: /@(sha256:[a-f0-9]{64})$/.exec(image)?.[1] ?? null };
  } catch {
    return undefined;
  }
}

export type DeployChange = {
  system: string;
  environment: EnvironmentName;
  sha: string;
  message: string;
  author: string | null;
  date: string;
  url: string;
};

/** Newest first; at most `limit`. */
export function latest(changes: DeployChange[], limit: number): DeployChange[] {
  return [...changes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function countSince(changes: DeployChange[], since: Date): number {
  return changes.filter((change) => Date.parse(change.date) >= since.getTime()).length;
}
