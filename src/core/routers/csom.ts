import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';

export class CsomRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nPOST (CSOM): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', async () => {
      const digest = await this.util.requestDigest(endpointUrl.split('/_vti_bin')[0]);
      const headers = {
        'Accept': '*/*',
        'Content-Type': 'text/xml',
        'X-Requested-With': 'XMLHttpRequest',
        'X-RequestDigest': digest
      };
      return this.fetch(endpointUrl, {
        method: 'POST',
        headers,
        body,
        agent
      })
        .then(this.handleErrors)
        .then((r) => this.transmitResponse(res, r))
        .catch((err) => this.transmitError(res, err));
    });
  }

}
