import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestGetRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.logger.info('\nGET: ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const isDoc = endpointUrl.split('?')[0].toLowerCase().endsWith('/$value');
    const headers: any = {};
    const additionalOptions: any = {};
    if (isDoc) {
      additionalOptions.encoding = null;
    }
    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach(prop => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.Accept = req.headers[prop];
        } else if (prop.toLowerCase() === 'content-type') {
          headers['Content-Type'] = req.headers[prop];
        } else {
          headers[prop] = req.headers[prop];
        }
      }
    });
    // this.logger.debug('\nHeaders:\n', JSON.stringify(req.headers, null, 2));
    this.spr.get(endpointUrl, { headers, ...additionalOptions, agent })
      .then(r => {
        // Paged collections patch
        if (typeof r.body['odata.nextLink'] === 'string') {
          r.body['odata.nextLink'] = this.util.buildProxyEndpointUrl(r.body['odata.nextLink']);
        }
        if (r.body.d && typeof r.body.d.__next === 'string') {
          r.body.d.__next = this.util.buildProxyEndpointUrl(r.body.d.__next);
        }
        // OData patch to PnPjs chained requests work
        if (typeof r.body['odata.metadata'] === 'string') {
          r.body['odata.metadata'] = this.util.buildProxyEndpointUrl(r.body['odata.metadata']);
        }
        return r;
      })
      .then(r => this.transmitResponse(res, r))
      .catch(err => this.transmitError(res, err));
  }

}
