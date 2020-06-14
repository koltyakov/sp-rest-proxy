import { Request, Response } from 'express';
import { Headers } from 'node-fetch';

import { BasicRouter } from '../BasicRouter';
import { getHeader } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

export class PostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.info('\nPOST (generic): ' + endpointUrl);
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const headers = new Headers();
      Object.keys(req.headers).forEach((prop) => {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.set('Accept', getHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', getHeader(req.headers, prop));
        }
        // Slug header fixes https://github.com/koltyakov/sp-rest-proxy/issues/51
        if (prop.toLowerCase() === 'slug') {
          headers.set('Slug', getHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'if-match') {
          headers.set('If-Match', getHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'x-http-method') {
          headers.set('X-HTTP-Method', getHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'x-requestdigest') {
          headers.set('X-RequestDigest', getHeader(req.headers, prop));
        }
      });

      if (typeof body === 'object') {
        body = JSON.stringify(body);
      }

      this.sp.fetch(endpointUrl, { method: 'POST', headers, body })
        .then(this.handlers.isOK)
        .then(this.handlers.response(res))
        .catch(this.handlers.error(res));
    });
  }

}
