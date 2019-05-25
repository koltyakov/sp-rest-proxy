import { IAuthOptions } from 'node-sp-auth';

interface IBasicEnvironmentConfig {
  environmentName: string;
  legacy: boolean;
}

export interface IPrivateEnvironmentConfig extends IBasicEnvironmentConfig {
  configPath: string;
}

export interface ICiEnvironmentConfig extends IBasicEnvironmentConfig {
  siteUrl: string;
  authOptions: IAuthOptions;
}

export type IEnvironmentConfig = IPrivateEnvironmentConfig | ICiEnvironmentConfig;
