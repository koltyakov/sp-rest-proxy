import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class RestGetRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);
    this.logger.info('\nGET: ' + endpointUrl);

    const isDoc = endpointUrl.split('?')[0].toLowerCase().endsWith('/$value');
    const requestHeadersPass: any = {};
    const additionalOptions: any = {};
    if (isDoc) {
      additionalOptions.encoding = null;
    }
    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'if-none-match', 'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];
    Object.keys(req.headers).forEach(prop => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          requestHeadersPass.Accept = req.headers[prop];
        } else if (prop.toLowerCase() === 'content-type') {
          requestHeadersPass['Content-Type'] = req.headers[prop];
        } else {
          requestHeadersPass[prop] = req.headers[prop];
        }
      }
    });
    this.logger.verbose('\nHeaders:\n', JSON.stringify(req.headers, null, 2));
    this.spr.get(endpointUrl, {
      headers: requestHeadersPass,
      agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined,
      ...additionalOptions
    })
      .then(r => {
        this.logger.verbose(r.statusCode, r.body);
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
        res.status(r.statusCode);
        if (isDoc) {
          res.send(r.body);
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
