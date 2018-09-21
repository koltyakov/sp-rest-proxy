import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class CsomRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.logger.info('\nPOST (CSOM): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', chunk => body += chunk);
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
          return this.spr.post(endpointUrl, { headers, body, agent, json: false });
        })
        .then(r => this.transmitResponse(res, r))
        .catch(err => this.transmitError(res, err));
    });
  }

}
