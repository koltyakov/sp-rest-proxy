import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestBatchRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response, _next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(request.originalUrl);
    this.logger.info('\nPOST (batch): ' + endpointUrl);
    let reqBody = '';
    if (request.body) {
      reqBody = request.body;
      this.processBatchRequest(reqBody, request, response);
    } else {
      request.on('data', chunk => reqBody += chunk);
      request.on('end', () => this.processBatchRequest(reqBody, request, response));
    }
  }

  private processBatchRequest(body: any, req: Request, res: Response) {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    body = (req as any).rawBody;
    const { processBatchMultipartBody: transform } = this.settings;
    if (transform && typeof transform === 'function') {
      body = transform(body);
    } else {
      const regExp = new RegExp('^(POST|GET) https?://localhost(:[0-9]+)?/', 'i');
      const origin = this.ctx.siteUrl.split('/').splice(0, 3).join('/');
      body = body.split('\n').map(line => {
        if (regExp.test(line)) {
          const parts = line.split(' ');
          const method = parts.shift();
          const version = parts.pop();
          let endpoint = parts.join(' ');
          endpoint = `${origin}/${endpoint.split('/').splice(3, 100).join('/')}`;
          line = `${method} ${endpoint} ${version}`;
        }
        return line;
      }).join('\n');
    }
    // req.headers['Content-Length'] = reqBodyData.byteLength;
    this.logger.verbose('Request body:', body);
    this.spr = this.getHttpClient();
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    this.spr.requestDigest((endpointUrl).split('/_api')[0])
      .then(digest => {
        let headers: any = {};
        const ignoreHeaders = [
          'host', 'referer', 'origin',
          'if-none-match', 'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];
        Object.keys(req.headers).forEach(prop => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              // tslint:disable-next-line:no-string-literal
              headers['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              headers['Content-Type'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'x-requestdigest') {
              // requestHeadersPass['X-RequestDigest'] = req.headers[prop]; // Temporary commented
            } else if (prop.toLowerCase() === 'content-length') {
              // requestHeadersPass['Content-Length'] = req.headers[prop];
            } else {
              headers[prop] = req.headers[prop];
            }
          }
        });
        headers = {
          ...headers,
          'X-RequestDigest': headers['X-RequestDigest'] || digest
        };
        // this.logger.debug('\nHeaders:\n', JSON.stringify(requestHeadersPass, null, 2));
        return this.spr.post(endpointUrl, { headers, body, agent, json: false });
      })
        .then(r => this.transmitResponse(res, r))
        .catch(err => this.transmitError(res, err));
  }

}
