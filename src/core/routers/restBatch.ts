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
      request.on('end', () => {
        this.processBatchRequest(reqBody, request, response);
      });
    }
  }

  private processBatchRequest(reqBodyData: any, req: Request, res: Response) {
    const endpointUrlStr = this.util.buildEndpointUrl(req.originalUrl);
    reqBodyData = (req as any).rawBody;
    const { processBatchMultipartBody: transform } = this.settings;
    if (transform && typeof transform === 'function') {
      reqBodyData = transform(reqBodyData);
    } else {
      const regExp = new RegExp('^(POST|GET) https?://localhost(:[0-9]+)?/', 'i');
      const origin = this.ctx.siteUrl.split('/').splice(0, 3).join('/');
      reqBodyData = reqBodyData.split('\n').map(line => {
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
    this.logger.info('Request body:', reqBodyData);
    this.spr = this.util.getCachedRequest(this.spr);
    this.spr.requestDigest((endpointUrlStr).split('/_api')[0])
      .then(digest => {
        let requestHeadersPass: any = {};
        const ignoreHeaders = [
          'host', 'referer', 'origin',
          'if-none-match', 'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];
        Object.keys(req.headers).forEach(prop => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              // tslint:disable-next-line:no-string-literal
              requestHeadersPass['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              requestHeadersPass['Content-Type'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'x-requestdigest') {
              // requestHeadersPass['X-RequestDigest'] = req.headers[prop]; // Temporary commented
            } else if (prop.toLowerCase() === 'content-length') {
              // requestHeadersPass['Content-Length'] = req.headers[prop];
            } else {
              requestHeadersPass[prop] = req.headers[prop];
            }
          }
        });
        requestHeadersPass = {
          ...requestHeadersPass,
          'X-RequestDigest': requestHeadersPass['X-RequestDigest'] || digest
        };
        this.logger.verbose('\nHeaders:\n', JSON.stringify(requestHeadersPass, null, 2));
        return this.spr.post(endpointUrlStr, {
          headers: requestHeadersPass,
          body: reqBodyData,
          json: false,
          agent: this.util.isUrlHttps(endpointUrlStr) ? this.settings.agent : undefined
        });
      })
      .then(r => {
        this.logger.verbose(r.statusCode, r.body);
        res.status(r.statusCode);
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
  }

}
