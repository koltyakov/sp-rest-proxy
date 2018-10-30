import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class SoapRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    this.spr = this.getHttpClient();
    const endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.logger.info('\nPOST (SOAP): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      this.util.getAuthOptions()
        .then(opt => {
          const headers = {
            ...opt.headers,
            'SOAPAction': req.headers.soapaction,
            'Accept': 'application/xml, text/xml, */*; q=0.01',
            'Content-Type': 'text/xml;charset="UTF-8"',
            'X-Requested-With': 'XMLHttpRequest'
          };
          return this.spr.post(endpointUrl, { headers, body, agent, json: false });
        })
        .then(r => this.transmitResponse(res, r))
        .catch(err => this.transmitError(res, err));
    });
  }

}
