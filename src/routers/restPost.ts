import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { Request, Response, NextFunction } from 'express';

export class RestPostRouter {

    private spr: ISPRequest;
    private ctx: IProxyContext;
    private settings: IProxySettings;
    private util: ProxyUtils;

    constructor(context: IProxyContext, settings: IProxySettings) {
        this.ctx = context;
        this.settings = settings;
        this.util = new ProxyUtils(this.ctx);
    }

    public router = (req: Request, res: Response, next?: NextFunction) => {
        let endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
        console.log('\nPOST: ' + endpointUrl); // _self.ctx.siteUrl + req.originalUrl

        let reqBody = '';

        let processPostRequest = (reqBody, req, res) => {
            let endpointUrl = this.util.buildEndpointUrl(req.originalUrl);
            console.log('Request body:', reqBody);

            this.spr = this.util.getCachedRequest(this.spr);

            this.spr.requestDigest((endpointUrl).split('/_api')[0])
                .then((digest: string) => {
                    let requestHeadersPass = {
                        'accept': 'application/json; odata=verbose',
                        'content-type': 'application/json; odata=verbose'
                    };

                    let ignoreHeaders = [ 'host', 'referer', 'if-none-match',
                        'connection', 'cache-control', 'cache-control', 'origin',
                        'user-agent', 'accept-encoding', 'accept-language',
                        'accept', 'content-type' ];

                    Object.keys(req.headers).forEach((prop) => {
                        if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                            requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                        }
                    });

                    requestHeadersPass['X-RequestDigest'] = digest;

                    try {
                        requestHeadersPass['content-length'] = JSON.stringify(reqBody).length;
                    } catch (ex) {}

                    if (this.settings.debugOutput) {
                        console.log('\nHeaders:');
                        console.log(JSON.stringify(requestHeadersPass, null, 2));
                    }

                    return this.spr.post(endpointUrl, {
                        headers: requestHeadersPass,
                        body: reqBody
                    });
                })
                .then((response: any) => {
                    if (this.settings.debugOutput) {
                        console.log(response.statusCode, response.body);
                    }
                    res.status(response.statusCode);
                    res.json(response.body);
                })
                .catch((err: any) => {
                    res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
                    res.send(err.message);
                });
        };

        if (req.body) {
            reqBody = req.body;
            try {
                reqBody = JSON.parse(reqBody);
            } catch (ex) {}
            processPostRequest(reqBody, req, res);
        } else {
            req.on('data', (chunk) => {
                reqBody += chunk;
            });
            req.on('end', () => {
                try {
                    reqBody = JSON.parse(reqBody);
                } catch (ex) {}
                processPostRequest(reqBody, req, res);
            });
        }
    }
}
