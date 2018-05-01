import * as spauth from 'node-sp-auth';
import * as spRequest from 'sp-request';
// tslint:disable-next-line:no-duplicate-imports
import { ISPRequest } from 'sp-request';
import { parse as urlParse } from 'url';

import { IProxyContext } from '../interfaces';

export class ProxyUtils {

  private spr: ISPRequest;
  private ctx: IProxyContext;

  constructor (context: IProxyContext) {
    this.ctx = context;
  }

  public getAuthOptions = (): Promise<any> => {
    return spauth.getAuth(this.ctx.siteUrl, this.ctx.authOptions) as any;
  }

  public getCachedRequest = (spr: ISPRequest): ISPRequest => {
    this.spr = spr || spRequest.create(this.ctx.authOptions);
    return this.spr;
  }

  public isOnPrem (url: string): boolean {
    return url.indexOf('.sharepoint.com') === -1 && url.indexOf('.sharepoint.cn') === -1;
  }

  public isUrlHttps (url: string): boolean {
    return url.split('://')[0].toLowerCase() === 'https';
  }

  public isUrlAbsolute (url: string): boolean {
    return url.indexOf('http:') === 0 || url.indexOf('https:') === 0;
  }

  public buildEndpointUrl = (reqUrl: string): string => {
    const siteUrlParsed = urlParse(this.ctx.siteUrl);
    let reqPathName = reqUrl;

    const baseUrlArr = siteUrlParsed.pathname.split('/');
    const reqUrlArr = reqUrl.split('?')[0].split('/');

    let similarity = 0;
    const len = baseUrlArr.length > reqUrlArr.length ?
      reqUrlArr.length : baseUrlArr.length;
    for (let i = 0; i < len; i += 1) {
      similarity += baseUrlArr[i] === reqUrlArr[i] ? 1 : 0;
    }

    if (similarity < 2) {
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
  args.forEach(arg => {
    if (!object || !object.hasOwnProperty(arg)) {
      return false;
    }
    object = object[arg];
  });
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
