import 'reflect-metadata';

import { AuditTrail, createDriverAdapter, databaseConfigSchema, databaseEngine, loadConfig } from '@solidvs/server';

import { PrismaClient } from './generated/prisma/client.js';
import { Definitions } from './modules/definitions/application/definitions.js';
import { PlatformDefinitionKinds } from './modules/definitions/infrastructure/platform-definition-kinds.js';
import { PrismaDefinitionRepository } from './modules/definitions/infrastructure/prisma-definition-repository.js';

/**
 * Synthetic data for development and laboratory databases (control 5): never real addresses,
 * people or production data. Goes through the use cases, so it is validated and audited like any
 * edit. Runs with the application login; refuses any database that is not a development one.
 */
const config = loadConfig(databaseConfigSchema);
if (!/_(dev|lab)$/.test(config.DATABASE_NAME)) {
  console.error(`refusing to seed ${config.DATABASE_NAME}: synthetic data goes to development databases only`);
  process.exit(1);
}

const db = new PrismaClient({ adapter: await createDriverAdapter(databaseEngine(), config) });
try {
  const definitions = new Definitions(new PlatformDefinitionKinds(), new PrismaDefinitionRepository(db), new AuditTrail(db));
  const current = await definitions.versions('identity.forgotPasswordUrl', null);
  if (current.state?.activeVersion) {
    console.log('definitions already seeded');
  } else {
    const draft = await definitions.saveDraft('identity.forgotPasswordUrl', null, { value: 'https://senha.example.com/recuperar', note: 'Valor sintético de desenvolvimento' }, 'seed');
    await definitions.publish('identity.forgotPasswordUrl', null, draft.number, 'seed');
    console.log(`seeded synthetic definitions into ${config.DATABASE_NAME}`);
  }
} finally {
  await db.$disconnect();
}
