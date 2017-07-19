import { AuthConfig as SPAuthConfigirator } from 'node-sp-auth-config';
import * as path from 'path';
import * as colors from 'colors';

import { TestsConfigs } from './configs';

async function checkOrPromptForIntegrationConfigCreds(): Promise<void> {

    let configs = [];

    for (let testConfig of TestsConfigs) {
        console.log(`\n=== ${colors.bold.yellow(`${testConfig.environmentName} Credentials`)} ===\n`);
        await (new SPAuthConfigirator({
            configPath: testConfig.configPath
        })).getContext();
        console.log(colors.grey(`Gotcha ${path.resolve(testConfig.configPath)}`));
    }

    console.log('\n');

}

checkOrPromptForIntegrationConfigCreds();
