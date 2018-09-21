import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class SoapRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);
    this.logger.info('\nPOST: ' + endpointUrl);
    let soapBody = '';
    req.on('data', chunk => soapBody += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        soapBody = soapBody.replace(regExpOrigin, this.ctx.siteUrl);
      }
      this.util.getAuthOptions()
        .then(opt => {
          const headers = {
            ...opt.headers,
            'Accept': 'application/xml, text/xml, */*; q=0.01',
            'Content-Type': 'text/xml;charset="UTF-8"',
            'X-Requested-With': 'XMLHttpRequest'
          };
          return this.spr.post(endpointUrl, {
            headers: headers,
            body: soapBody,
            json: false,
            agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined
          });
        })
        .then(r => {
          this.logger.verbose(r.statusCode, r.body);
          res.send(r.body);
          res.end();
        })
        .catch(err => {
          res.status(err.statusCode);
          res.json(err);
        });
    });
  }

}
