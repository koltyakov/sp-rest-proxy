import { IUserCredentials } from 'node-sp-auth';

export interface IBasicTestSetup {
  environmentName: string;
  legacy: boolean;
}

export interface IPrivateTestSetup extends IBasicTestSetup {
  configPath: string;
}

export interface ICiTestSetup extends IBasicTestSetup {
  siteUrl: string;
  authOptions: IUserCredentials;
}

export type ITestSetup = IPrivateTestSetup | ICiTestSetup;
