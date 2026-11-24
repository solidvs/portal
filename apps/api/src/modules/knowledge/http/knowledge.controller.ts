import { documentsResponse, type DocumentsResponse } from '@portal/contracts';
import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { CatalogQueries } from '../../catalog/application/catalog.js';
import { KnowledgeQueries, type DocumentKind } from '../application/knowledge.js';

@Controller()
export class KnowledgeController {
  constructor(
    @Inject(KnowledgeQueries) private readonly knowledge: KnowledgeQueries,
    @Inject(CatalogQueries) private readonly catalog: CatalogQueries,
  ) {}

  @Get('projects/:id/decisions')
  decisions(@Param('id') id: string): Promise<DocumentsResponse> {
    return this.ofSystem(id, 'decisions');
  }

  @Get('projects/:id/procedures')
  procedures(@Param('id') id: string): Promise<DocumentsResponse> {
    return this.ofSystem(id, 'procedures');
  }

  /** Decisions of the standard stack itself. */
  @Get('stack/decisions')
  async stack(): Promise<DocumentsResponse> {
    return documentsResponse.parse({ documents: await this.knowledge.stackDecisions() });
  }

  private async ofSystem(id: string, kind: DocumentKind): Promise<DocumentsResponse> {
    const entry = await this.catalog.find(id);
    if (!entry) throw new NotFoundException();
    const documents = entry.repository ? await this.knowledge.ofSystem(entry.repository.name, kind) : [];
    return documentsResponse.parse({ documents });
  }
}
