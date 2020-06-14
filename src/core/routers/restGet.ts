import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { Headers, Response as FetchResponse } from 'node-fetch';
import { getHeader } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

export class RestGetRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.info('\nGET: ' + endpointUrl);
    const headers = new Headers();
    const isDoc = endpointUrl.split('?')[0].toLowerCase().endsWith('/$value');
    if (isDoc) {
      headers.set('binaryStringResponseBody', 'true');
    }
    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach((prop) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && getHeader(req.headers, prop) !== '*/*') {
          headers.set('Accept', getHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', getHeader(req.headers, prop));
        } else {
          headers.set(prop, getHeader(req.headers, prop));
        }
      }
    });
    this.sp.fetch(endpointUrl, { method: 'GET', headers })
      .then(this.handlers.isOK)
      .then(async (r) => {
        const ct = new Headers(r.headers).get('content-type');
        if (ct.toLowerCase().indexOf('application/json') !== 0) {
          return r;
        }
        try {
          const body = await r.json();

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
      .then((r) => this.handlers.response(res)(r, (resp) => {
        if (isDoc) {
          return resp.buffer();
        }
        return resp.text();
      }))
      .catch(this.handlers.error(res));
  }

}
