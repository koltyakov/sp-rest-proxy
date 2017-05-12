import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { Request, Response, NextFunction } from 'express';

export class RestBatchRouter {

    private spr: ISPRequest;
    private ctx: IProxyContext;
    private settings: IProxySettings;
    private util: ProxyUtils;

    constructor(context: IProxyContext, settings: IProxySettings) {
        this.ctx = context;
        this.settings = settings;
        this.util = new ProxyUtils(this.ctx);
    }

    public router = (request: Request, response: Response, next?: NextFunction) => {
        let endpointUrl = this.util.buildEndpointUrl(request.originalUrl);
        console.log('\POST (batch): ' + endpointUrl);

        let reqBody = '';

        if (request.body) {
            reqBody = request.body;
            this.processBatchRequest(reqBody, request, response);
        } else {
            request.on('data', (chunk) => {
                reqBody += chunk;
            });
            request.on('end', () => {
                this.processBatchRequest(reqBody, request, response);
            });
        }
    }

    private processBatchRequest = (reqBodyData: any, req: Request, res: Response) => {
        let endpointUrlStr = this.util.buildEndpointUrl(req.originalUrl);

        reqBodyData = (req as any).rawBody;

        // Hack for PnP-JS-Core temporary testing approach
        // reqBodyData = reqBodyData.replace(/ _api/g, ` ${endpointUrlStr.replace('/_api/$batch', '/')}_api`);
        // req.headers['Content-Length'] = reqBodyData.byteLength;

        console.log('Request body:', reqBodyData);

        this.spr = this.util.getCachedRequest(this.spr);

        this.spr.requestDigest((endpointUrlStr).split('/_api')[0])
            .then((digest: string) => {
                let requestHeadersPass: any = {};

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
                        } else if (prop.toLowerCase() === 'x-requestdigest') {
                            // requestHeadersPass['X-RequestDigest'] = req.headers[prop]; // Temporary commented
                        } else if (prop.toLowerCase() === 'content-length') {
                            requestHeadersPass['Content-Length'] = req.headers[prop];
                        } else {
                            requestHeadersPass[prop] = req.headers[prop];
                        }
                    }
                });

                requestHeadersPass = {
                    ...requestHeadersPass,
                    'X-RequestDigest': requestHeadersPass['X-RequestDigest'] || digest,
                    'Content-Length': requestHeadersPass['Content-Length'] || reqBodyData.byteLength
                };

                if (this.settings.debugOutput) {
                    console.log('\nHeaders:');
                    console.log(JSON.stringify(requestHeadersPass, null, 2));
                }

                return this.spr.post(endpointUrlStr, {
                    headers: requestHeadersPass,
                    body: reqBodyData,
                    json: false
                });
            })
            .then((resp: any) => {
                if (this.settings.debugOutput) {
                    console.log(resp.statusCode, resp.body);
                }
                res.status(resp.statusCode);
                res.send(resp.body);
            })
            .catch((err: any) => {
                res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
                res.send(err.message);
            });
    }
}
