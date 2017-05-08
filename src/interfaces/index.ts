import { IAuthOptions } from 'node-sp-auth';
import { Router } from 'express';

export interface IProxySettings {
    configPath?: string;
    hostname?: string;
    port?: number;
    staticRoot?: string;
    staticLibPath?: string;
    rawBodyLimitSize?: string;
    debugOutput?: boolean;
    metadata?: any;
}

export interface IProxyContext {
    siteUrl: string;
    context: IAuthOptions;
}

export interface IRouters {
    [routerName: string]: Router;
}
