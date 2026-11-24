import { definitionValuesResponse, type DefinitionValuesResponse } from '@portal/contracts';
import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import { Public } from '@solidvs/server';
import type { Response } from 'express';

import { CONFIG } from '../../../tokens.js';
import type { Config } from '../../../config.js';
import { Definitions } from '../application/definitions.js';
import { notModified } from './etag.js';

/**
 * Public definitions (ADR-0014, items 5 and 8): read-only, without authentication, for the login
 * page of the identity provider. Only kinds marked public; cross-origin reads from the identity
 * provider's address only; cached for a minute.
 */
@Controller('public/definitions')
export class PublicDefinitionsController {
  private readonly identityOrigin: string;

  constructor(
    @Inject(Definitions) private readonly definitions: Definitions,
    @Inject(CONFIG) config: Config,
  ) {
    this.identityOrigin = new URL(config.OIDC_ISSUER).origin;
  }

  /** Public on purpose: the login page shows these values before anyone signs in. */
  @Get()
  @Public()
  async list(@Headers('if-none-match') ifNoneMatch: string | undefined, @Res({ passthrough: true }) response: Response): Promise<DefinitionValuesResponse | undefined> {
    const body = definitionValuesResponse.parse({ definitions: await this.definitions.activeValues('platform', null, { onlyPublic: true }) });
    response.setHeader('Access-Control-Allow-Origin', this.identityOrigin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    response.setHeader('Cache-Control', 'public, max-age=60');
    return notModified(body, ifNoneMatch, response) ? undefined : body;
  }
}
