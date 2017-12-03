import { IAuthOptions } from 'node-sp-auth';
import { IAuthConfigSettings } from 'node-sp-auth-config';
import { Router } from 'express';
import { Agent, Server as HttpsServer } from 'https';
import { Server as HttpServer } from 'http';

export interface IProxySettings {
  hostname?: string;
  ssl?: ISSLConf;
  protocol?: 'https' | 'http';
  port?: number;

  staticRoot?: string;
  rawBodyLimitSize?: string;
  jsonPayloadLimitSize?: string;
  debugOutput?: boolean;
  metadata?: any;
  silentMode?: boolean;
  agent?: Agent;

  authConfigSettings?: IAuthConfigSettings;
  configPath?: string; // Legacy
  defaultConfigPath?: string; // Legacy
}

export interface ISSLConf {
  key: string;
  cert: string;
}

export interface IProxyContext {
  siteUrl: string;
  authOptions?: IAuthOptions;
}

export interface IRouters {
  [routerName: string]: Router;
}

export interface IGatewayServerSettings {
  port?: number;
}

export interface IGatewayClientSettings {
  serverUrl: string;
}

export interface IProxyCallback {
  (
    server: HttpsServer | HttpServer,
    context: IProxyContext,
    settings: IProxySettings
  ): void;
}
