import { definitionValuesResponse, type DefinitionValuesResponse } from '@portal/contracts';
import { Controller, ForbiddenException, Get, Headers, Inject, Param, Res } from '@nestjs/common';
import { CurrentService, ServiceRoute, type ServiceCaller } from '@solidvs/server';
import type { Response } from 'express';

import { Definitions } from '../application/definitions.js';
import { notModified } from './etag.js';

/**
 * Read API for systems (ADR-0014, item 5): active values, with a client credentials token of the
 * calling system for the portal. A system reads the platform scope and its own scope only.
 */
@Controller('definitions')
@ServiceRoute()
export class ServiceDefinitionsController {
  constructor(@Inject(Definitions) private readonly definitions: Definitions) {}

  @Get('platform')
  async platform(@Headers('if-none-match') ifNoneMatch: string | undefined, @Res({ passthrough: true }) response: Response): Promise<DefinitionValuesResponse | undefined> {
    const body = definitionValuesResponse.parse({ definitions: await this.definitions.activeValues('platform', null) });
    response.setHeader('Cache-Control', 'private, no-cache');
    return notModified(body, ifNoneMatch, response) ? undefined : body;
  }

  @Get('systems/:systemId')
  async system(
    @Param('systemId') systemId: string,
    @CurrentService() caller: ServiceCaller,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<DefinitionValuesResponse | undefined> {
    if (caller.clientId !== systemId) throw new ForbiddenException('a system reads its own definitions only');
    const body = definitionValuesResponse.parse({ definitions: await this.definitions.activeValues('system', systemId) });
    response.setHeader('Cache-Control', 'private, no-cache');
    return notModified(body, ifNoneMatch, response) ? undefined : body;
  }
}
