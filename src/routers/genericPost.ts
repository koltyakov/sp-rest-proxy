import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { IAuthResponse } from 'node-sp-auth';
import { Request, Response, NextFunction } from 'express';

export class PostRouter {

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
    let endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
    this.spr = this.util.getCachedRequest(this.spr);

    if (!this.settings.silentMode) {
      console.log('\nPOST: ' + endpointUrl);
    }

    let postBody = '';
    req.on('data', (chunk) => {
      postBody += chunk;
    });
    req.on('end', () => {
      if (req.headers.origin) {
        let regExpOrigin = new RegExp(req.headers.origin as any, 'g');
        postBody = postBody.replace(regExpOrigin, this.ctx.siteUrl);
      }

      let requestHeadersPass = {};
      Object.keys(req.headers).forEach((prop: string) => {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          // tslint:disable-next-line:no-string-literal
          requestHeadersPass['Accept'] = req.headers[prop];
        }
        if (prop.toLowerCase() === 'content-type') {
          requestHeadersPass['Content-Type'] = req.headers[prop];
        }
      });

      this.util.getAuthOptions()
        .then((opt: IAuthResponse) => {
          let headers = {
            ...opt.headers,
            ...requestHeadersPass
          };

          let options = {
            json: false,
            processData: false
          };

          this.spr.post(endpointUrl, {
            headers: headers,
            body: postBody,
            ...options as any,
            agent: this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined
          })
            .then((response: any) => {
              if (this.settings.debugOutput) {
                console.log(response.statusCode, response.body);
              }

              res.status(response.statusCode);
              res.contentType(response.headers['content-type']);

              res.send(response.body);
            });
        })
        .catch((err: any) => {
          res.status(err.statusCode);
          res.json(err);
        });
    });
  }
}
