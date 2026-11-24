import { catalogEntry, catalogResponse, type CatalogEntry, type CatalogResponse } from '@portal/contracts';
import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';

import { CatalogQueries } from '../application/catalog.js';

@Controller('catalog')
export class CatalogController {
  constructor(@Inject(CatalogQueries) private readonly catalog: CatalogQueries) {}

  /** Every system of the organization, with where its catalog entry came from. */
  @Get()
  async list(): Promise<CatalogResponse> {
    return catalogResponse.parse({ entries: await this.catalog.list() });
  }

  @Get(':id')
  async find(@Param('id') id: string): Promise<CatalogEntry> {
    const entry = await this.catalog.find(id);
    if (!entry) throw new NotFoundException();
    return catalogEntry.parse(entry);
  }
}
