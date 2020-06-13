import { IAuthOptions } from 'node-sp-auth';
import { IAuthConfigSettings } from 'node-sp-auth-config';
import { Router, Request } from 'express';
import { Agent, Server as HttpsServer } from 'https';
import { Server as HttpServer } from 'http';
import { LogLevel } from '../utils/logger';
import { BasicRouter } from './BasicRouter';
import { Response } from 'node-fetch';

export interface IProxySettings {
  hostname?: string;
  ssl?: ISSLConf;
  protocol?: 'https' | 'http';
  port?: number;

  staticRoot?: string;
  rawBodyLimitSize?: string;
  jsonPayloadLimitSize?: string;
  metadata?: unknown;
  agent?: Agent;
  strictRelativeUrls?: boolean;

  authConfigSettings?: IAuthConfigSettings;
  configPath?: string; // Legacy
  defaultConfigPath?: string; // Legacy

  processBatchMultipartBody?: (body: string) => string;

  logLevel?: LogLevel;

  hooks?: IProxyHooks;
}

export interface ISSLConf {
  key: string;
  cert: string;
}

export interface IProxyContext {
  siteUrl: string;
  proxyHostUrl: string;
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

export type IProxyCallback = (
  server: HttpsServer | HttpServer,
  context: IProxyContext,
  settings: IProxySettings
) => void;

export type IProxyErrorCallback = (error: Error) => void;

export interface IProxyHooks {
  responseMapper?: (
    req: Request,
    res: Response,
    router?: BasicRouter
  ) => Promise<Response> | Response;
}
