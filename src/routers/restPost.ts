import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { Request, Response, NextFunction } from 'express';

export class RestPostRouter {

  private spr: ISPRequest;
  private ctx: IProxyContext;
  private settings: IProxySettings;
  private util: ProxyUtils;

  constructor (context: IProxyContext, settings: IProxySettings) {
    this.ctx = context;
    this.settings = settings;
    this.util = new ProxyUtils(this.ctx);
  }

  public router = (request: Request, response: Response, next?: NextFunction) => {
    let endpointUrl = this.util.buildEndpointUrl(request.originalUrl);

    if (!this.settings.silentMode) {
      console.log('\nPOST: ' + endpointUrl);
    }

    let reqBody = '';

    if (request.body) {
      reqBody = request.body;
      this.processPostRequest(reqBody, request, response);
    } else {
      request.on('data', (chunk) => {
        reqBody += chunk;
      });
      request.on('end', () => {
        this.processPostRequest(reqBody, request, response);
      });
    }
  }

  private processPostRequest = (reqBodyData: any, req: Request, res: Response) => {
    let endpointUrlStr = this.util.buildEndpointUrl(req.originalUrl);

    if (!this.settings.silentMode) {
      console.log('Request body:', reqBodyData);
    }

    this.spr = this.util.getCachedRequest(this.spr);

    this.spr.requestDigest((endpointUrlStr).split('/_api')[0])
      .then((digest: string) => {
        let requestHeadersPass: any = {};
        let jsonOption: any = {
          json: true
        };
        let ignoreHeaders = [
          'host', 'referer', 'origin',
          'if-none-match', 'connection', 'cache-control', 'user-agent',
          'accept-encoding', 'x-requested-with', 'accept-language'
        ];

        Object.keys(req.headers).forEach((prop: string) => {
          if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
            if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
              // tslint:disable-next-line:no-string-literal
              requestHeadersPass['Accept'] = req.headers[prop];
            } else if (prop.toLowerCase() === 'content-type') {
              requestHeadersPass['Content-Type'] = req.headers[prop];
            } else {
              requestHeadersPass[prop] = req.headers[prop];
            }
          }
        });

        requestHeadersPass = {
          ...requestHeadersPass,
          'X-RequestDigest': digest
          // 'Content-Length': reqBodyData.length
        };

        if (
          endpointUrlStr.toLowerCase().indexOf('/attachmentfiles/add') !== -1 ||
          endpointUrlStr.toLowerCase().indexOf('/files/add') !== -1
        ) {
          // reqBodyData = (req as any).rawBody;
          reqBodyData = (req as any).buffer;
          jsonOption.json = false;
          jsonOption.processData = false;
          requestHeadersPass['Content-Length'] = reqBodyData.byteLength;
        }

        if (this.settings.debugOutput) {
          console.log('\nHeaders:');
          console.log(JSON.stringify(requestHeadersPass, null, 2));
        }

        return this.spr.post(endpointUrlStr, {
          headers: requestHeadersPass,
          body: reqBodyData,
          ...jsonOption,
          agent: this.util.isUrlHttps(endpointUrlStr) ? this.settings.agent : undefined
        });
      })
      .then((resp: any) => {
        if (this.settings.debugOutput) {
          console.log(resp.statusCode, resp.body);
        }
        res.status(resp.statusCode);
        if (typeof resp.body === 'string') {
          res.json(JSON.parse(resp.body));
        } else {
          res.json(resp.body);
        }
      })
      .catch((err: any) => {
        res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
        res.send(err.message);
      });
  }
}
