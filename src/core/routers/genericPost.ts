import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class PostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl, this.settings.strictRelativeUrls);
    this.logger.info('\nPOST (generic): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const requestHeadersPass = {};
      Object.keys(req.headers).forEach(prop => {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          // tslint:disable-next-line:no-string-literal
          requestHeadersPass['Accept'] = req.headers[prop];
        }
        if (prop.toLowerCase() === 'content-type') {
          requestHeadersPass['Content-Type'] = req.headers[prop];
        }
        // Slug header fixes https://github.com/koltyakov/sp-rest-proxy/issues/51
        if (prop.toLowerCase() === 'slug') {
          requestHeadersPass['Slug'] = req.headers[prop];
        }
        if (prop.toLowerCase() === 'if-match') {
          requestHeadersPass['If-Match'] = req.headers[prop];
        }
        if (prop.toLowerCase() === 'x-http-method') {
          requestHeadersPass['X-HTTP-Method'] = req.headers[prop];
        }
      });
      this.util.getAuthOptions()
        .then(opt => {
          const headers = {
            ...opt.headers,
            ...requestHeadersPass
          };
          const options: any = {
            json: false,
            processData: false
          };
          return this.spr.post(endpointUrl, { headers, body, ...options, agent });
        })
          .then(r => this.transmitResponse(res, r))
          .catch(err => this.transmitError(res, err));
    });
  }

}
