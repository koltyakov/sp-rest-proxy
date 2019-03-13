import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestPostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response, _next?: NextFunction) => {
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

  private processPostRequest = (body: any, req: Request, res: Response) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.logger.verbose('Request body:', body);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    this.spr.requestDigest((endpointUrl).split('/_api')[0])
      .then(digest => {
        let headers: any = {};
        const jsonOption: any = { json: true };
        const ignoreHeaders = [
          'host', 'referer', 'origin',
          'if-none-match', 'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];
        Object.keys(req.headers).forEach(prop => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              headers['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              headers['Content-Type'] = req.headers[prop];
            } else {
              headers[prop] = req.headers[prop];
            }
          }
        });
        headers = {
          ...headers,
          'X-RequestDigest': digest
        };
        if (
          endpointUrl.toLowerCase().indexOf('/attachmentfiles/add') !== -1 ||
          endpointUrl.toLowerCase().indexOf('/files/add') !== -1 ||
          endpointUrl.toLowerCase().indexOf('/startupload') !== -1 ||
          endpointUrl.toLowerCase().indexOf('/continueupload') !== -1 ||
          endpointUrl.toLowerCase().indexOf('/finishupload') !== -1
        ) {
          body = (req as any).buffer;
          jsonOption.json = false;
          jsonOption.processData = false;
          if (body) {
            // requestHeadersPass['Content-Length'] = reqBodyData.byteLength;
          }
        }
        // this.logger.debug('\nHeaders:\n', JSON.stringify(requestHeadersPass, null, 2));
        // JSOM empty object
        if (typeof body === 'object' && Object.keys(body).length === 0) {
          body = '{}';
          // When content-length is set to 0 in this case - since body has been
          // forcably set to "{}" - the content length becomes invalid. The following
          // line removes the content-length header to avoid errors downstream.
          delete headers['content-length'];
        }
        return this.spr.post(endpointUrl, { headers, body, ...jsonOption, agent });
      })
      .then(r => this.transmitResponse(res, r))
      .catch(err => this.transmitError(res, err));
  }

}
