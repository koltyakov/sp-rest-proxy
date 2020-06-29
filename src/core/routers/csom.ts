import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';
import { getHeaders } from '../../utils/headers';

export class CsomRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.info('\nPOST (CSOM): ' + endpointUrl);
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      const headers = getHeaders(req.headers);
      return this.sp.fetch(endpointUrl, { method: 'POST', headers, body })
        .then(this.handlers.isOK)
        .then(this.handlers.response(res))
        .catch(this.handlers.error(res));
    });
  }

}
