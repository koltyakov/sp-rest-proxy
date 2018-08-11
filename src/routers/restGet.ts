import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { Request, Response, NextFunction } from 'express';

export class RestGetRouter {

  private spr: ISPRequest;
  private ctx: IProxyContext;
  private settings: IProxySettings;
  private util: ProxyUtils;

  constructor (context: IProxyContext, settings: IProxySettings) {
    this.ctx = context;
    this.settings = settings;
    this.util = new ProxyUtils(this.ctx);
  }

  public router = (req: Request, res: Response, next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);

    if (!this.settings.silentMode) {
      console.log('\nGET: ' + endpointUrl);
    }

    const isDoc = endpointUrl.split('?')[0].toLowerCase().endsWith('/$value');
    const requestHeadersPass: any = {};
    let additionalOptions: any = {};
    if (isDoc) {
      additionalOptions = {
        encoding: null
      };
    }

    const ignoreHeaders = [
      'host', 'referer', 'origin',
      'if-none-match', 'connection', 'cache-control', 'user-agent',
      'accept-encoding', 'x-requested-with', 'accept-language'
    ];

    Object.keys(req.headers).forEach((prop: string) => {
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

    if (this.settings.debugOutput) {
      console.log('\nHeaders:');
      console.log(JSON.stringify(req.headers, null, 2));
    }

    this.spr.get(endpointUrl, {
      headers: requestHeadersPass,
      agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined,
      ...additionalOptions
    })
      .then((response: any) => {
        if (this.settings.debugOutput) {
          console.log(response.statusCode, response.body);
        }

        // Paged collections patch
        if (typeof response.body['odata.nextLink'] === 'string') {
          response.body['odata.nextLink'] = this.util.buildProxyEndpointUrl(response.body['odata.nextLink']);
        }
        if (response.body.d && typeof response.body.d.__next === 'string') {
          response.body.d.__next = this.util.buildProxyEndpointUrl(response.body.d.__next);
        }

        // OData patch to PnPjs chained requests work
        if (typeof response.body['odata.metadata'] === 'string') {
          response.body['odata.metadata'] = this.util.buildProxyEndpointUrl(response.body['odata.metadata']);
        }

        res.status(response.statusCode);
        if (isDoc) {
          res.send(response.body);
        } else {
          res.json(response.body);
        }
      })
      .catch((err: any) => {
        res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
        if (err.response && err.response.body) {
          res.json(err.response.body);
        } else {
          res.send(err.message);
        }
      });
  }
}
