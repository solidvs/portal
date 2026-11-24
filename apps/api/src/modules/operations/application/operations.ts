import {
  countSince,
  ENVIRONMENTS,
  latest,
  type DeployChange,
  type EnvironmentName,
} from '../domain/operations.js';

export type EnvironmentState = {
  environment: EnvironmentName;
  image: string | null;
  digest: string | null;
  changedAt: string | null;
  changedBy: string | null;
  url: string | null;
};

/** What operations need from the platform repository (implemented over GitHub). */
export interface PlatformSource {
  /** Systems with a file in the environment. */
  systemsIn(environment: EnvironmentName): Promise<string[]>;
  image(system: string, environment: EnvironmentName): Promise<{ image: string; digest: string | null; url: string } | undefined>;
  /** Changes to the system's file in the environment, newest first. */
  changes(system: string, environment: EnvironmentName): Promise<DeployChange[]>;
}

/** Use cases: where each system runs, and what changed. */
export class OperationsQueries {
  constructor(
    private readonly source: PlatformSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async environments(system: string): Promise<EnvironmentState[]> {
    return Promise.all(
      ENVIRONMENTS.map(async (environment) => {
        const [image, changes] = await Promise.all([this.source.image(system, environment), this.source.changes(system, environment)]);
        const last = changes[0];
        return {
          environment,
          image: image?.image ?? null,
          digest: image?.digest ?? null,
          changedAt: image ? (last?.date ?? null) : null,
          changedBy: image ? (last?.author ?? null) : null,
          url: image?.url ?? null,
        };
      }),
    );
  }

  async deploysOf(system: string, limit = 30): Promise<DeployChange[]> {
    const all = await Promise.all(ENVIRONMENTS.map((environment) => this.source.changes(system, environment)));
    return latest(all.flat(), limit);
  }

  async allDeploys(limit = 50): Promise<DeployChange[]> {
    const pairs = await Promise.all(
      ENVIRONMENTS.map(async (environment) => (await this.source.systemsIn(environment)).map((system) => ({ system, environment }))),
    );
    const changes = await Promise.all(pairs.flat().map(({ system, environment }) => this.source.changes(system, environment)));
    return latest(changes.flat(), limit);
  }

  async summary(): Promise<{ deployedToProduction: number; deploysLast7Days: number; latestDeploys: DeployChange[] }> {
    const [production, deploys] = await Promise.all([this.source.systemsIn('production'), this.allDeploys(200)]);
    const weekAgo = new Date(this.now().getTime() - 7 * 86_400_000);
    return { deployedToProduction: production.length, deploysLast7Days: countSince(deploys, weekAgo), latestDeploys: deploys.slice(0, 5) };
  }
}
