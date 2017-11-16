export interface ITestSetup {
  environmentName: string;
  configPath: string;
  legacy: boolean;
}

export const TestsConfigs: ITestSetup[] = [
  {
    environmentName: 'SharePoint Online',
    configPath: './config/integration/private.spo.json',
    legacy: false
  }, {
    environmentName: 'On-Premise 2016',
    configPath: './config/integration/private.2016.json',
    legacy: false
  }, {
    environmentName: 'On-Premise 2013',
    configPath: './config/integration/private.2013.json',
    legacy: true
  }
];
