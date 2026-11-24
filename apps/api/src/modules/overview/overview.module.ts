import { Module } from '@nestjs/common';

import { CatalogModule } from '../catalog/catalog.module.js';
import { OperationsModule } from '../operations/operations.module.js';
import { OverviewController } from './http/overview.controller.js';

@Module({ imports: [CatalogModule, OperationsModule], controllers: [OverviewController] })
export class OverviewModule {}
