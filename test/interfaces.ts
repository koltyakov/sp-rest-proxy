import { IOnlineAddinCredentials } from 'node-sp-auth';

export interface IBasicTestSetup {
  environmentName: string;
  legacy: boolean;
}

export interface IPrivateTestSetup extends IBasicTestSetup {
  configPath: string;
}

export interface ICiTestSetup extends IBasicTestSetup {
  siteUrl: string;
  authOptions: IOnlineAddinCredentials;
}

export type ITestSetup = IPrivateTestSetup | ICiTestSetup;
