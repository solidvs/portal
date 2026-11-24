import { definitionSummariesResponse, definitionVersion, definitionVersionsResponse, publishRequest, saveDraftRequest, type DefinitionSummariesResponse, type DefinitionVersion, type DefinitionVersionsResponse } from '@portal/contracts';
import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query, UnprocessableEntityException } from '@nestjs/common';
import { CurrentSession, RequireRoles, systemIdSchema, type Session } from '@solidvs/server';

import { Definitions } from '../application/definitions.js';
import { asHttpError } from './errors.js';
import { summaryView, versionView } from './views.js';

function systemOf(value: unknown): string | null {
  if (value === undefined) return null;
  const parsed = systemIdSchema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('systemId: catalog id');
  return parsed.data;
}

/**
 * Administration of definitions (ADR-0014, item 4), for people with a session: everyone in the
 * portal reads; editors and administrators write drafts; administrators publish. Roles come from
 * directory groups (`app.module.ts`).
 */
@Controller('admin/definitions')
export class AdminDefinitionsController {
  constructor(@Inject(Definitions) private readonly definitions: Definitions) {}

  @Get()
  async list(@Query('systemId') systemId: unknown): Promise<DefinitionSummariesResponse> {
    const system = systemOf(systemId);
    const summaries = await this.definitions.summaries(system === null ? 'platform' : 'system', system);
    return definitionSummariesResponse.parse({ definitions: summaries.map(summaryView) });
  }

  @Get(':key/versions')
  async versions(@Param('key') key: string, @Query('systemId') systemId: unknown): Promise<DefinitionVersionsResponse> {
    try {
      const { state, versions } = await this.definitions.versions(key, systemOf(systemId));
      return definitionVersionsResponse.parse({
        activeVersion: state?.activeVersion ?? null,
        draftVersion: state?.draftVersion ?? null,
        versions: versions.map(versionView),
      });
    } catch (error) {
      throw asHttpError(error);
    }
  }

  @Post(':key/drafts')
  @RequireRoles('editor', 'admin')
  async saveDraft(@Param('key') key: string, @Body() body: unknown, @CurrentSession() session: Session): Promise<DefinitionVersion> {
    const input = saveDraftRequest.safeParse(body);
    if (!input.success) throw new UnprocessableEntityException(input.error.issues.map((issue) => issue.message));
    try {
      const version = await this.definitions.saveDraft(key, input.data.systemId ?? null, { value: input.data.value ?? null, note: input.data.note }, session.principal.username);
      return definitionVersion.parse(versionView(version));
    } catch (error) {
      throw asHttpError(error);
    }
  }

  @Post(':key/publish')
  @HttpCode(200)
  @RequireRoles('admin')
  async publish(@Param('key') key: string, @Body() body: unknown, @CurrentSession() session: Session): Promise<{ activeVersion: number }> {
    const input = publishRequest.safeParse(body);
    if (!input.success) throw new UnprocessableEntityException(input.error.issues.map((issue) => issue.message));
    try {
      return { activeVersion: await this.definitions.publish(key, input.data.systemId ?? null, input.data.version, session.principal.username) };
    } catch (error) {
      throw asHttpError(error);
    }
  }
}
