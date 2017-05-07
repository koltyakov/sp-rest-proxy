import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { ISPRequest } from 'sp-request';
import { Request, Response, NextFunction } from 'express';

export class RestGetRouter {

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
        this.spr = this.util.getCachedRequest(this.spr);

        console.log('\nGET: ' + endpointUrl); // _self.ctx.siteUrl + req.originalUrl);

        let requestHeadersPass = {
            'accept': 'application/json; odata=verbose',
            'content-type': 'application/json; odata=verbose'
        };

        let ignoreHeaders = [ 'host', 'referer', 'if-none-match', 'connection',
            'cache-control', 'cache-control', 'user-agent', 'origin',
            'accept-encoding', 'x-requested-with', 'accept-language' ];

        // `origin` header causes 403 error in CORS requests

        Object.keys(req.headers).forEach((prop) => {
            if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                if (prop.toLowerCase() === 'accept' && requestHeadersPass[prop.toLowerCase()] === '*/*') {
                    requestHeadersPass[prop.toLowerCase()] = 'application/json; odata=verbose';
                }
            }
        });

        if (this.settings.debugOutput) {
            console.log('\nHeaders:');
            console.log(JSON.stringify(req.headers, null, 2));
        }

        this.spr.get(endpointUrl, {
            headers: requestHeadersPass
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
    }
}
