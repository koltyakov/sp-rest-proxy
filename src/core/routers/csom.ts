import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class CsomRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);
    this.logger.info('\nPOST: ' + endpointUrl);
    let csomPackage = '';
    req.on('data', chunk => csomPackage += chunk);
    req.on('end', () => {
      Promise.all([
        this.spr.requestDigest((endpointUrl).split('/_vti_bin')[0]),
        this.util.getAuthOptions()
      ])
        .then(r => {
          const digest: string = r[0];
          const opt = r[1];
          const headers = {
            ...opt.headers,
            'Accept': '*/*',
            'Content-Type': 'text/xml',
            'X-Requested-With': 'XMLHttpRequest',
            'X-RequestDigest': digest
          };
          return this.spr.post(endpointUrl, {
            headers: headers,
            body: csomPackage,
            json: false,
            agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined
          });
        })
        .then(r => {
          this.logger.verbose(r.statusCode, r.body);
          res.status(r.statusCode);
          if (typeof r.body === 'string') {
            try {
              const result = JSON.parse(r.body);
              res.json(result);
            } catch (ex) {
              res.status(r.statusCode);
              res.send(r.body);
              res.end();
            }
          } else {
            res.json(r.body);
          }
        })
        .catch(err => {
          res.status(err.statusCode);
          res.json(err);
        });
    });
  }

}
