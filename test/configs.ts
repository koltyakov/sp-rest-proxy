import { config } from 'dotenv';
import { ITestSetup, ICiTestSetup, IPrivateTestSetup } from './interfaces';

config();

const ci = process.argv.slice(2).indexOf('--ci') !== -1;
if (ci) { process.env.SPAUTH_ENV = 'production'; }

export const TestsConfigs: ITestSetup[] = ((headless: boolean) => {
  if (headless) {
    const ciTestConf: ICiTestSetup[] = [{
      environmentName: 'SharePoint Online',
      legacy: false,
      siteUrl: process.env.SPAUTH_SITEURL,
      authOptions: {
        username: process.env.SPAUTH_USERNAME,
        password: process.env.SPAUTH_PASSWORD
      }
    }];
    return ciTestConf;
  }
  const privateConf: IPrivateTestSetup[] = [
    {
      environmentName: 'SharePoint Online',
      configPath: './config/integration/private.spo.json',
      legacy: false
    },
    {
      environmentName: 'On-Premise 2016',
      configPath: './config/integration/private.2016.json',
      legacy: false
    },
    {
      environmentName: 'On-Premise 2013',
      configPath: './config/integration/private.2013.json',
      legacy: true
    }
  ];
  return privateConf;
})(ci);

export { ITestSetup, ICiTestSetup, IPrivateTestSetup } from './interfaces';
