import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { getHeaders } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

export class SoapRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.info('\nPOST (SOAP): ' + endpointUrl);
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const headers = getHeaders(req.headers);
      this.sp.fetch(endpointUrl, { method: 'POST', headers, body })
        .then(this.handlers.isOK)
        .then(this.handlers.response(res))
        .catch(this.handlers.error(res));
    });
  }

}
