import * as spauth from 'node-sp-auth';
import * as spRequest from 'sp-request';
import { ISPRequest } from 'sp-request';
import * as url from 'url';

import { IProxyContext } from '../interfaces';

export class ProxyUtils {

    private spr: ISPRequest;
    private ctx: IProxyContext;

    constructor(context: IProxyContext) {
        this.ctx = context;
    }

    public getAuthOptions = (): Promise<any> => {
        return <any>spauth.getAuth(this.ctx.siteUrl, this.ctx.authOptions);
    }

    public getCachedRequest = (spr: ISPRequest): ISPRequest => {
        this.spr = spr || spRequest.create(this.ctx.authOptions);
        return this.spr;
    }

    public buildEndpointUrl = (reqUrl: string) => {
        let siteUrlParsed = url.parse(this.ctx.siteUrl);
        let reqPathName = '';
        if (reqUrl.indexOf(siteUrlParsed.pathname) === 0) {
            reqPathName = reqUrl;
        } else {
            reqPathName = (`${siteUrlParsed.pathname}/${reqUrl}`).replace(/\/\//g, '/');
        }
        return `${siteUrlParsed.protocol}//${siteUrlParsed.host}${reqPathName}`;
    }

}

export const generateGuid = (): string => {
    const s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    };
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

export const checkNestedProperties = (object: any, ...args: string[]): boolean => {
    for (let i: number = 0, len: number = args.length; i < len; i += 1) {
        if (!object || !object.hasOwnProperty(args[i])) {
            return false;
        }
        object = object[args[i]];
    }
    return true;
};

export const getCaseInsensitiveProp = (object: any, propertyName: string): any => {
    propertyName = propertyName.toLowerCase();
    return Object.keys(object).reduce((res: any, prop: string) => {
        if (prop.toLowerCase() === propertyName) {
            res = object[prop];
        }
        return res;
    }, undefined);
};

export const trimMultiline = (multiline: string): string => {
    return multiline.trim().split('\n').map((line: string) => {
        return line.trim();
    }).join('\n');
};
