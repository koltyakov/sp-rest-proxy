import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Headers } from 'node-fetch';

export class SoapRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nPOST (SOAP): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => {
      if (req.headers.origin) {
        const regExpOrigin = new RegExp(req.headers.origin, 'g');
        body = body.replace(regExpOrigin, this.ctx.siteUrl);
      }
      const headers = new Headers({
        'SOAPAction': this.util.reqHeader(req.headers, 'SOAPAction'),
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'Content-Type': 'text/xml;charset="UTF-8"',
        'X-Requested-With': 'XMLHttpRequest'
      });
      // return this.spr.post(endpointUrl, { headers, body, agent, json: false });
      this.fetch(endpointUrl, {
        method: 'POST',
        headers,
        body,
        agent
      })
        .then((r) => this.transmitResponse(res, r))
        .catch((err) => this.transmitError(res, err));
    });
  }

}
