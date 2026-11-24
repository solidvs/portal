import { deploysResponse, environmentsResponse, type DeploysResponse, type EnvironmentsResponse } from '@portal/contracts';
import { Controller, Get, Inject, Param } from '@nestjs/common';

import { OperationsQueries } from '../application/operations.js';

@Controller()
export class OperationsController {
  constructor(@Inject(OperationsQueries) private readonly operations: OperationsQueries) {}

  /** What runs in staging and production, from the platform repository. */
  @Get('projects/:id/environments')
  async environments(@Param('id') id: string): Promise<EnvironmentsResponse> {
    return environmentsResponse.parse({ environments: await this.operations.environments(id) });
  }

  /** Deploys of one system: every change to its platform files. */
  @Get('projects/:id/deploys')
  async deploysOf(@Param('id') id: string): Promise<DeploysResponse> {
    return deploysResponse.parse({ deploys: await this.operations.deploysOf(id) });
  }

  /** Latest deploys of every system. */
  @Get('deploys')
  async all(): Promise<DeploysResponse> {
    return deploysResponse.parse({ deploys: await this.operations.allDeploys() });
  }
}
