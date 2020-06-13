import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Headers, Response as FetchResponse } from 'node-fetch';

export class RestGetRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nGET: ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const isDoc = endpointUrl.split('?')[0].toLowerCase().endsWith('/$value');
    const headers = new Headers();
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
        if (prop.toLowerCase() === 'accept' && this.util.reqHeader(req.headers, prop) !== '*/*') {
          headers.set('Accept', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', this.util.reqHeader(req.headers, prop));
        } else {
          headers.set(prop, this.util.reqHeader(req.headers, prop));
        }
      }
    });
    // this.logger.debug('\nHeaders:\n', JSON.stringify(req.headers, null, 2));
    this.fetch(endpointUrl, {
      method: 'GET',
      headers,
      agent
    })
      .then(this.handleErrors)
      .then(async (r) => {
        const ct = new Headers(r.headers).get('content-type');
        if (ct.toLowerCase().indexOf('application/json') !== 0) {
          return r;
        }

        try {

          const body = await r.json();

          // Paged collections patch
          if (typeof body['odata.nextLink'] === 'string') {
            body['odata.nextLink'] = this.util.buildProxyEndpointUrl(body['odata.nextLink']);
          }
          if (typeof body.d?.__next === 'string') {
            body.d.__next = this.util.buildProxyEndpointUrl(body.d.__next);
          }
          // OData patch to PnPjs chained requests work
          if (typeof body['odata.metadata'] === 'string') {
            body['odata.metadata'] = this.util.buildProxyEndpointUrl(body['odata.metadata']);
          }
          // OData patch to PnPjs URI resolver, Verbose mode
          if (body?.d?.__metadata?.uri) {
            body.d.__metadata.uri = this.util.buildProxyEndpointUrl(body.d.__metadata.uri);
          }

          return new FetchResponse(JSON.stringify(body), r);

        } catch (ex) {
          console.log(ex);
        }
        return r;
      })
      .then((r) => {
        return this.transmitResponse(res, r, (resp) => {
          if (isDoc) {
            return resp.buffer();
          }
          return resp.text();
        });
      })
      .catch((err) => this.transmitError(res, err));
  }

}
