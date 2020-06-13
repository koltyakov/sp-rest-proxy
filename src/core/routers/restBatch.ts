import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Headers } from 'node-fetch';

export class RestBatchRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (request: Request, response: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(request);
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
    const endpointUrl = this.util.buildEndpointUrl(req);
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
    // req.headers['Content-Length'] = reqBodyData.byteLength;
    this.logger.verbose('Request body:', body);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const headers = new Headers();
    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'if-none-match', 'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach((prop) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.set('Accept', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'x-requestdigest') {
          // headers['X-RequestDigest'] = req.headers[prop]; // temporary commented
        } else if (prop.toLowerCase() === 'content-length') {
          // requestHeadersPass['Content-Length'] = req.headers[prop];
        } else {
          headers.set(prop, this.util.reqHeader(req.headers, prop));
        }
      }
    });
    // this.logger.debug('\nHeaders:\n', JSON.stringify(requestHeadersPass, null, 2));
    // return this.spr.post(endpointUrl, { headers, body, agent, json: false });
    this.fetch(endpointUrl, {
      method: 'POST',
      headers,
      body,
      agent
    })
      .then(this.handleErrors)
      .then((r) => this.transmitResponse(res, r))
      .catch((err) => this.transmitError(res, err));
  }

}
