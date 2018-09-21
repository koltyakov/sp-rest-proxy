import { resolve } from 'path';
import { AuthConfig } from 'node-sp-auth-config';
import * as colors from 'colors';

import { logger } from '../src/utils/logger';
import { TestsConfigs } from './configs';

async function checkOrPromptForIntegrationConfigCreds (): Promise<void> {

  for (const { configPath, environmentName } of TestsConfigs) {
    logger.info(`\n=== ${colors.bold.yellow(`${environmentName} Credentials`)} ===\n`);
    await new AuthConfig({ configPath }).getContext();
    logger.info(colors.grey(`Gotcha ${resolve(configPath)}`));
  }

  logger.info('\n');

}

checkOrPromptForIntegrationConfigCreds();
