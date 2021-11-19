import { Request, Response } from 'express';
import { Headers, Response as FetchResponse } from 'node-fetch';

import { BasicRouter } from '../BasicRouter';
import { BodyInit } from 'node-fetch';
import { getHeaders } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

export class RestPostRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (request: Request, response: Response): void => {
    const endpointUrl = this.url.apiEndpoint(request);
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
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.verbose('Request body:', body);
    const headers = getHeaders(req.headers);
    if (this.isDocumentEndpoint(endpointUrl)) {
      body = (req as unknown as { buffer: Buffer }).buffer;
      if (body) {
        headers.set('Content-Length', `${body.byteLength}`);
      }
    }
    if (typeof body === 'object' && Object.keys(body).length === 0) {
      // JSOM empty object
      if (
        endpointUrl.toLowerCase().indexOf('/_vti_bin/client.svc') !== -1 ||
        endpointUrl.toLowerCase().indexOf('/_api/contextinfo') !== -1
      ) {
        body = '{}';
        // When content-length is set to 0 in this case - since body has been
        // set to "{}" - the content length becomes invalid. The following
        // line removes the content-length header to avoid errors downstream.
      }
      Object.keys(headers).forEach((prop) => {
        if (prop.toLowerCase() === 'content-length') {
          headers.delete(prop);
        }
      });
    }
    if (typeof body === 'object' && !this.isDocumentEndpoint(endpointUrl)) {
      body = JSON.stringify(body);
    }

    this.sp.fetch(endpointUrl, { method: 'POST', headers, body })
      .then(this.handlers.isOK)
      .then(async (r) => {
        const ct = new Headers(r.headers).get('content-type') || '';
        if (ct.toLowerCase().indexOf('application/json') !== 0) {
          return r;
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body = await r.json() as any;

          // Paged collections patch
          if (typeof body['odata.nextLink'] === 'string') {
            body['odata.nextLink'] = this.url.proxyEndpoint(body['odata.nextLink']);
          }
          if (typeof body.d?.__next === 'string') {
            body.d.__next = this.url.proxyEndpoint(body.d.__next);
          }
          // OData patch to PnPjs chained requests work
          if (typeof body['odata.metadata'] === 'string') {
            body['odata.metadata'] = this.url.proxyEndpoint(body['odata.metadata']);
          }
          // OData patch to PnPjs URI resolver, Verbose mode
          if (body?.d?.__metadata?.uri) {
            body.d.__metadata.uri = this.url.proxyEndpoint(body.d.__metadata.uri);
          }

          return new FetchResponse(JSON.stringify(body), r);

        } catch (ex) { this.logger.error(ex); }
        return r;
      })
      .then(this.handlers.response(res))
      .catch(this.handlers.error(res));
  }

  private isDocumentEndpoint = (endpointUrl: string): boolean => {
    if (
      endpointUrl.toLowerCase().indexOf('/attachmentfiles/add') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/files/add') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/startupload') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/continueupload') !== -1 ||
      endpointUrl.toLowerCase().indexOf('/finishupload') !== -1
    ) {
      return true;
    }
    return false;
  }

}
