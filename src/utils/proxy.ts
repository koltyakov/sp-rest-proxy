import * as spauth from 'node-sp-auth';
import { Request } from 'express';
import fetch, { RequestInit, Response, Headers } from 'node-fetch';
import { parse as urlParse } from 'url';

import { cache } from './cache';
import { IProxyContext, IProxySettings } from '../core/interfaces';
import { IncomingHttpHeaders } from 'http';

export type FetchClient = (url: string, init?: RequestInit) => Promise<Response>;
export type FetchResponse = Response;

export class ProxyUtils {

  constructor(private ctx: IProxyContext, private settings: IProxySettings) { /**/ }

  public fetch = async (url: string, init: RequestInit = {}): Promise<Response> => {
    const auth =  await this.getAuthOptions();
    let digest: string;
    if (init.method === 'POST') {
      try {
        // const headers = new Headers(init.headers);
        // // headers.get('X-RequestDigest');
        if (!digest && url.toLowerCase().indexOf('/_api/contextinfo') === -1) {
          digest = await this.requestDigest(url.split('/_api')[0].split('/_vti_bin')[0]);
        }
      } catch(ex) { /**/ }
    }
    const opts: RequestInit = {
      ...init,
      ...auth.options || {},
      headers: this.mergeHeaders(
        new Headers(init.headers),
        new Headers(auth.headers),
        new Headers({ 'X-RequestDigest': digest })
      )
    };
    return fetch(url, opts);
  }

  public getAuthOptions = (): Promise<spauth.IAuthResponse> => {
    return spauth.getAuth(this.ctx.siteUrl, this.ctx.authOptions);
  }

  public requestDigest = (webUrl: string): Promise<string> => {
    const d = cache.get(`${webUrl}:digest`);
    if (d) {
      return Promise.resolve(d);
    }
    return this.fetch(`${webUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: {
        accept: 'application/json;odata=verbose'
      }
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error(r.statusText);
        }
        return r.json();
      })
      .then((r) => {
        const digest = r.d.GetContextWebInformation.FormDigestValue as string;
        const ttl = parseInt(r.d.GetContextWebInformation.FormDigestTimeoutSeconds, 10);
        cache.set(`${webUrl}:digest`, digest, ttl - 30 * 1000);
        return digest;
      });
  }

  public isOnPrem = (url: string): boolean => {
    return url.indexOf('.sharepoint.com') === -1 && url.indexOf('.sharepoint.cn') === -1;
  }

  public isUrlHttps = (url: string): boolean => {
    return url.split('://')[0].toLowerCase() === 'https';
  }

  public isUrlAbsolute = (url: string): boolean => {
    return url.indexOf('http:') === 0 || url.indexOf('https:') === 0;
  }

  public buildEndpointUrl = (req: Request | string): string => {
    const reqUrl = typeof req === 'string' ? req : req.originalUrl;
    let strictRelativeUrls = this.settings.strictRelativeUrls;
    if (typeof req === 'object' && req.header('X-ProxyStrict')) {
      strictRelativeUrls = req.header('X-ProxyStrict').toLowerCase() === 'true' ? true : false;
    }
    const siteUrlParsed = urlParse(this.ctx.siteUrl);
    const baseUrlArr = siteUrlParsed.pathname.split('/');
    const reqUrlArr = reqUrl.split('?')[0].split('/');
    const len = baseUrlArr.length > reqUrlArr.length ? reqUrlArr.length : baseUrlArr.length;
    let similarity = 0;
    let reqPathName = reqUrl;
    if (!strictRelativeUrls) {
      for (let i = 0; i < len; i += 1) {
        similarity += baseUrlArr[i] === reqUrlArr[i] ? 1 : 0;
      }
      if (similarity < 2) {
        reqPathName = (`${siteUrlParsed.pathname}/${reqUrl}`).replace(/\/\//g, '/');
      }
      reqPathName = reqPathName.replace(/\/\//g, '/');
    }
    return `${siteUrlParsed.protocol}//${siteUrlParsed.host}${reqPathName}`;
  }

  public buildProxyEndpointUrl = (reqUrl: string): string => {
    const spHostUrl = this.ctx.siteUrl.split('/').splice(0, 3).join('/');
    let proxyUrl = reqUrl;
    if (proxyUrl.toLowerCase().indexOf(spHostUrl.toLowerCase()) === 0) {
      proxyUrl = proxyUrl.replace(new RegExp(spHostUrl, 'i'), this.ctx.proxyHostUrl);
    }
    return proxyUrl;
  }

  public reqHeader = (headers: IncomingHttpHeaders | Headers, header: string): string => {
    let res: string | string[] = '';
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === header.toLowerCase()) {
        res = headers[key];
      }
    }
    if (typeof res === 'string') {
      return res;
    }
    return res[0];
  }

  // private spreadHeaders = (headers: Headers): { [key: string]: string } => {
  //   const res: { [key: string]: string } = {};
  //   headers.forEach((v, k) => { res[k] = v; });
  //   return res;
  // }

  private mergeHeaders = (...headers: Headers[]): Headers => {
    const res = new Headers();
    for (const hh of headers) {
      hh.forEach((h, k) => {
        if (h) {
          res.set(k, h);
        } else {
          res.delete(k);
        }
      });
    }
    return res;
  }

}
