import { Request } from 'express';
import { parse as urlParse } from 'url';

import { IProxyContext, IProxySettings } from '../core/interfaces';

export class UrlUtils {

  constructor(private ctx: IProxyContext, private settings: IProxySettings) { /**/ }

  public isOnPrem = (url: string): boolean => {
    return url.indexOf('.sharepoint.com') === -1 && url.indexOf('.sharepoint.cn') === -1;
  }

  public isHttps = (url: string): boolean => {
    return url.split('://')[0].toLowerCase() === 'https';
  }

  public isAbsolute = (url: string): boolean => {
    return url.indexOf('http:') === 0 || url.indexOf('https:') === 0;
  }

  public apiEndpoint = (req: Request | string): string => {
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

  public proxyEndpoint = (reqUrl: string): string => {
    const spHostUrl = this.ctx.siteUrl.split('/').splice(0, 3).join('/');
    let proxyUrl = reqUrl;
    if (proxyUrl.toLowerCase().indexOf(spHostUrl.toLowerCase()) === 0) {
      proxyUrl = proxyUrl.replace(new RegExp(spHostUrl, 'i'), this.ctx.proxyHostUrl);
    }
    return proxyUrl;
  }

}
