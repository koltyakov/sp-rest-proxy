import { Request, Response } from 'express';
import { Headers } from 'node-fetch';

import { BasicRouter } from '../BasicRouter';
import { getHeader } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

export class RestBatchRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response): void => {
    const endpointUrl = this.url.apiEndpoint(request);
    this.logger.info('\nPOST (batch): ' + endpointUrl);
    let reqBody = '';
    if (request.body) {
      reqBody = request.body;
      this.processBatchRequest(reqBody, request, response);
    } else {
      request.on('data', (chunk) => reqBody += chunk);
      request.on('end', () => this.processBatchRequest(reqBody, request, response));
    }
  }

  private processBatchRequest(body: string, req: Request, res: Response) {
    const endpointUrl = this.url.apiEndpoint(req);
    body = (req as unknown as { rawBody: string }).rawBody;
    const { processBatchMultipartBody: transform } = this.settings;
    if (transform && typeof transform === 'function') {
      body = transform(body);
    } else {
      const regExp = new RegExp('^(POST|GET|MERGE|DELETE) https?://localhost(:[0-9]+)?/', 'i');
      const origin = this.ctx.siteUrl.split('/').splice(0, 3).join('/');
      body = body.split('\n').map((line) => {
        if (regExp.test(line)) {
          const parts = line.split(' ');
          const method = parts.shift();
          const version = parts.pop();
          let endpoint = parts.join(' ');
          endpoint = `${origin}/${endpoint.split('/').splice(3).join('/')}`;
          line = `${method} ${endpoint} ${version}`;
        }
        return line;
      }).join('\n');
    }
    this.logger.verbose('Request body:', body);
    const headers = new Headers();
    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'if-none-match', 'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach((prop) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.set('Accept', getHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', getHeader(req.headers, prop));
        } else {
          headers.set(prop, getHeader(req.headers, prop));
        }
      }
    });

    this.sp.fetch(endpointUrl, { method: 'POST', headers, body })
      .then(this.handlers.isOK)
      .then(this.handlers.response(res))
      .catch(this.handlers.error(res));
  }

}
