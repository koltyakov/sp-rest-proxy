import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { IAuthResponse } from 'node-sp-auth';
import { Request, Response, NextFunction } from 'express';

export class CsomRouter {

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
      console.log('\nPOST: ' + endpointUrl);
    }

    const regExpOrigin = new RegExp(req.headers.origin as any, 'g');
    let csomPackage = '';
    req.on('data', (chunk) => {
      csomPackage += chunk;
    });
    req.on('end', () => {

      Promise.all([
        this.spr.requestDigest((endpointUrl).split('/_vti_bin')[0]),
        this.util.getAuthOptions()
      ])
        .then((response: any) => {

          const digest: string = response[0];
          const opt: IAuthResponse = response[1];

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
        .then((resp: any) => {
          if (this.settings.debugOutput) {
            console.log(resp.statusCode, resp.body);
          }
          res.status(resp.statusCode);
          if (typeof resp.body === 'string') {
            try {
              const result = JSON.parse(resp.body);
              res.json(result);
            } catch (ex) {
              res.status(resp.statusCode);
              res.send(resp.body);
              res.end();
            }
          } else {
            res.json(resp.body);
          }
        })
        .catch((err: any) => {
          res.status(err.statusCode);
          res.json(err);
        });
    });
  }
}
