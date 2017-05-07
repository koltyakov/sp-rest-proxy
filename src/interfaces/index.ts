import { IAuthOptions } from 'node-sp-auth';

export interface IProxySettings {
    configPath?: string;
    hostname?: string;
    port?: number;
    staticRoot?: string;
    staticLibPath?: string;
    debugOutput?: boolean;
    metadata?: any;
}

export interface IProxyContext {
    siteUrl: string;
    context: IAuthOptions;
}
