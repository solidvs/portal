import { overviewResponse, type OverviewResponse } from '@portal/contracts';
import { Controller, Get, Inject } from '@nestjs/common';

import type { Config } from '../../../config.js';
import { CONFIG } from '../../../tokens.js';
import { CatalogQueries } from '../../catalog/application/catalog.js';
import { OperationsQueries } from '../../operations/application/operations.js';

/** Start page numbers: projects, manifests, production systems and recent deploys. */
@Controller('overview')
export class OverviewController {
  constructor(
    @Inject(CatalogQueries) private readonly catalog: CatalogQueries,
    @Inject(OperationsQueries) private readonly operations: OperationsQueries,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  @Get()
  async overview(): Promise<OverviewResponse> {
    const [entries, summary] = await Promise.all([this.catalog.list(), this.operations.summary()]);
    return overviewResponse.parse({
      release: this.config.RELEASE,
      projects: entries.length,
      withManifest: entries.filter((e) => e.manifest !== 'none').length,
      ...summary,
    });
  }
}
