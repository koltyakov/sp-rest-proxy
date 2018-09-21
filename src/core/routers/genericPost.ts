import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class PostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);
    this.logger.info('\nPOST: ' + endpointUrl);

    let postBody = '';
    req.on('data', chunk => postBody += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        postBody = postBody.replace(regExpOrigin, this.ctx.siteUrl);
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
          const options = {
            json: false,
            processData: false
          };
          return this.spr.post(endpointUrl, {
            headers: headers,
            body: postBody,
            ...options as any,
            agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined
          });
        })
        .then(r => {
          this.logger.verbose(r.statusCode, r.body);
          res.status(r.statusCode);
          res.contentType(r.headers['content-type'] || '');
          res.send(r.body);
        })
        .catch(err => {
          res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
          if (err.response && err.response.body) {
            res.json(err.response.body);
          } else {
            res.send(err.message);
          }
        });
    });
  }

}
