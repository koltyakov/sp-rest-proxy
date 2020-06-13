import { Request, Response } from 'express';
import { Headers } from 'node-fetch';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';

import { IProxyContext, IProxySettings } from '../interfaces';

export class PostRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nPOST (generic): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const requestHeadersPass = new Headers();
      Object.keys(req.headers).forEach((prop) => {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          requestHeadersPass.set('Accept', this.util.reqHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'content-type') {
          requestHeadersPass.set('Content-Type', this.util.reqHeader(req.headers, prop));
        }
        // Slug header fixes https://github.com/koltyakov/sp-rest-proxy/issues/51
        if (prop.toLowerCase() === 'slug') {
          requestHeadersPass.set('Slug', this.util.reqHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'if-match') {
          requestHeadersPass.set('If-Match', this.util.reqHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'x-http-method') {
          requestHeadersPass.set('X-HTTP-Method', this.util.reqHeader(req.headers, prop));
        }
        if (prop.toLowerCase() === 'x-requestdigest') {
          requestHeadersPass.set('X-RequestDigest', this.util.reqHeader(req.headers, prop));
        }
      });

      // Automatically add X-RequestDigest for /_vti_bin requests
      if (!requestHeadersPass['X-RequestDigest'] && endpointUrl.indexOf('/_vti_bin') !== -1) {
        // try {
        const digest = await this.util.requestDigest(endpointUrl.split('/_vti_bin')[0]);
        requestHeadersPass.set('X-RequestDigest', digest);
        // } catch (ex) {
        //   return this.transmitError(res, ex);
        // }
      }

      // this.util.getAuthOptions()
      //   .then((opt) => {
      //     const headers = {
      //       ...opt.headers,
      //       ...requestHeadersPass
      //     };
      //     const options: any = {
      //       json: false,
      //       processData: false
      //     };
      //     return this.spr.post(endpointUrl, { headers, body, ...options, agent });
      //   })
      //   .then((r) => this.transmitResponse(res, r))
      //   .catch((err) => this.transmitError(res, err));

      if (typeof body === 'object') {
        body = JSON.stringify(body);
      }

      this.fetch(endpointUrl, {
        method: 'POST',
        headers: requestHeadersPass,
        body,
        agent
      })
        .then(this.handleErrors)
        .then((r) => this.transmitResponse(res, r))
        .catch((err) => this.transmitError(res, err));
    });
  }

}
