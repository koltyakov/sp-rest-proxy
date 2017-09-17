import { IAuthOptions } from 'node-sp-auth';
import { IAuthConfigSettings } from 'node-sp-auth-config';
import { Router } from 'express';
import * as https from 'https';

export interface IProxySettings {
    hostname?: string;
    port?: number;
    staticRoot?: string;
    staticLibPath?: string;
    rawBodyLimitSize?: string;
    jsonPayloadLimitSize?: string;
    debugOutput?: boolean;
    metadata?: any;
    silentMode?: boolean;
    agent?: https.Agent;

    authConfigSettings?: IAuthConfigSettings;
    configPath?: string; // Legacy
    defaultConfigPath?: string; // Legacy
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
