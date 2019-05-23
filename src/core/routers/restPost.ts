import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestPostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response, _next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(request);
    this.logger.info('\nPOST: ' + endpointUrl);
    let reqBody = '';
    if (request.body) {
      reqBody = request.body;
      this.processPostRequest(reqBody, request, response);
    } else {
      request.on('data', chunk => reqBody += chunk);
      request.on('end', () => this.processPostRequest(reqBody, request, response));
    }
  }

  private processPostRequest = (body: any, req: Request, res: Response) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.verbose('Request body:', body);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    this.spr.requestDigest(endpointUrl.split('/_api')[0])
      .then(digest => {
        let headers: any = {};
        const jsonOption: any = { json: true };
        const ignoreHeaders = [
          'host', 'referer', 'origin', 'x-requestdigest',
          'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];
        Object.keys(req.headers).forEach(prop => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              headers['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              headers['Content-Type'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'x-requestdigest') {
              headers['X-RequestDigest'] = req.headers[prop];
            } else {
              headers[prop] = req.headers[prop];
            }
          }
        });
        headers = {
          ...headers,
          'X-RequestDigest': headers['X-RequestDigest'] || digest
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
          // if (body) {
          //   headers['Content-Length'] = body.byteLength;
          // }
        }
        // this.logger.debug('\nHeaders:\n', JSON.stringify(headers, null, 2));
        if (typeof body === 'object' && Object.keys(body).length === 0) {
          // JSOM empty object
          if (
            endpointUrl.toLowerCase().indexOf('/_vti_bin/client.svc') !== -1 ||
            endpointUrl.toLowerCase().indexOf('/_api/contextinfo') !== -1
          ) {
            body = '{}';
            // When content-length is set to 0 in this case - since body has been
            // forcably set to "{}" - the content length becomes invalid. The following
            // line removes the content-length header to avoid errors downstream.
          }
          Object.keys(headers).forEach(prop => {
            if (prop.toLowerCase() === 'content-length') {
              delete headers[prop];
            }
          });
        }
        return this.spr.post(endpointUrl, { headers, body, ...jsonOption, agent });
      })
      .then(r => this.transmitResponse(res, r))
      .catch(err => this.transmitError(res, err));
  }

}
