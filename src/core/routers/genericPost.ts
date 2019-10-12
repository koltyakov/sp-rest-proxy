import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class PostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nPOST (generic): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const requestHeadersPass = {};
      Object.keys(req.headers).forEach((prop) => {
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
        if (prop.toLowerCase() === 'x-requestdigest') {
          requestHeadersPass['X-RequestDigest'] = req.headers[prop];
        }
      });

      // Automatically add X-RequestDigest for /_vti_bin requests
      if (!requestHeadersPass['X-RequestDigest'] && endpointUrl.indexOf('/_vti_bin') !== -1) {
        try {
          const digest = await Promise.resolve(this.spr.requestDigest(endpointUrl.split('/_vti_bin')[0]));
          requestHeadersPass['X-RequestDigest'] = digest;
        } catch (ex) {
          return this.transmitError(res, ex);
        }
      }

      this.util.getAuthOptions()
        .then((opt) => {
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
        .then((r) => this.transmitResponse(res, r))
        .catch((err) => this.transmitError(res, err));
    });
  }

}
