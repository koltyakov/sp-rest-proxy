import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestPostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response, next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(request.originalUrl);
    this.logger.info('\nPOST: ' + endpointUrl);

    let reqBody = '';
    if (request.body) {
      reqBody = request.body;
      this.processPostRequest(reqBody, request, response);
    } else {
      request.on('data', chunk => reqBody += chunk);
      request.on('end', () => {
        this.processPostRequest(reqBody, request, response);
      });
    }
  }

  private processPostRequest = (reqBodyData: any, req: Request, res: Response) => {
    const endpointUrlStr = this.util.buildEndpointUrl(req.originalUrl);
    this.logger.verbose('Request body:', reqBodyData);
    this.spr = this.util.getCachedRequest(this.spr);
    this.spr.requestDigest((endpointUrlStr).split('/_api')[0])
      .then(digest => {
        let requestHeadersPass: any = {};
        const jsonOption: any = { json: true };
        const ignoreHeaders = [
          'host', 'referer', 'origin',
          'if-none-match', 'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];
        Object.keys(req.headers).forEach(prop => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              requestHeadersPass['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              requestHeadersPass['Content-Type'] = req.headers[prop];
            } else {
              requestHeadersPass[prop] = req.headers[prop];
            }
          }
        });
        requestHeadersPass = {
          ...requestHeadersPass,
          'X-RequestDigest': digest
        };
        if (
          endpointUrlStr.toLowerCase().indexOf('/attachmentfiles/add') !== -1 ||
          endpointUrlStr.toLowerCase().indexOf('/files/add') !== -1 ||
          endpointUrlStr.toLowerCase().indexOf('/startupload') !== -1 ||
          endpointUrlStr.toLowerCase().indexOf('/continueupload') !== -1 ||
          endpointUrlStr.toLowerCase().indexOf('/finishupload') !== -1
        ) {
          reqBodyData = (req as any).buffer;
          jsonOption.json = false;
          jsonOption.processData = false;
          if (reqBodyData) {
            // requestHeadersPass['Content-Length'] = reqBodyData.byteLength;
          }
        }
        this.logger.verbose('\nHeaders:\n', JSON.stringify(requestHeadersPass, null, 2));
        // JSOM empty object
        if (typeof reqBodyData === 'object' && Object.keys(reqBodyData).length === 0) {
          reqBodyData = '{}';
        }
        return this.spr.post(endpointUrlStr, {
          headers: requestHeadersPass,
          body: reqBodyData,
          ...jsonOption,
          agent: this.util.isUrlHttps(endpointUrlStr) ? this.settings.agent : undefined
        });
      })
      .then(r => {
        this.logger.verbose(r.statusCode, r.body);
        res.status(r.statusCode);
        if (typeof r.body === 'string') {
          res.json(JSON.parse(r.body));
        } else {
          res.json(r.body);
        }
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
