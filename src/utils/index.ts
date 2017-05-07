import * as Promise from 'bluebird';
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
        return spauth.getAuth(this.ctx.siteUrl, this.ctx.context);
    }

    public getCachedRequest = (spr: ISPRequest): ISPRequest => {
        this.spr = spr || spRequest.create(this.ctx.context);
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
