import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Headers, BodyInit } from 'node-fetch';

export class RestPostRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (request: Request, response: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(request);
    this.logger.info('\nPOST: ' + endpointUrl);
    let reqBody = '';
    if (request.body) {
      reqBody = request.body;
      this.processPostRequest(reqBody, request, response);
    } else {
      request.on('data', (chunk) => reqBody += chunk);
      request.on('end', () => this.processPostRequest(reqBody, request, response));
    }
  }

  private processPostRequest = (body: BodyInit, req: Request, res: Response) => {
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.verbose('Request body:', body);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const headers = new Headers();
    // const jsonOption: any = { json: true };
    const ignoreHeaders = [
      'host', 'referer', 'origin', 'x-requestdigest',
      'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach((prop) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.set('Accept', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'x-requestdigest') {
          headers.set('X-RequestDigest', this.util.reqHeader(req.headers, prop));
        } else {
          headers.set(prop, this.util.reqHeader(req.headers, prop));
        }
      }
    });
    if (
      endpointUrl.toLowerCase().indexOf('/attachmentfiles/add') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/files/add') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/startupload') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/continueupload') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/finishupload') !== -1
    ) {
      body = (req as unknown as { buffer: Buffer }).buffer;
      // jsonOption.json = false;
      // jsonOption.processData = false;
      if (body) {
        headers.set('Content-Length', `${body.byteLength}`);
      }
      headers.delete('Content-Type');
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
      Object.keys(headers).forEach((prop) => {
        if (prop.toLowerCase() === 'content-length') {
          // delete headers[prop];
          headers.delete(prop);
        }
      });
    }
    if (typeof body === 'object') {
      body = JSON.stringify(body);
    }

    // return this.spr.post(endpointUrl, { headers, body, ...jsonOption, agent });
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
