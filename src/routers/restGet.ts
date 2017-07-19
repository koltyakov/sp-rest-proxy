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

        if (!this.settings.silentMode) {
            console.log('\nGET: ' + endpointUrl);
        }

        let requestHeadersPass: any = {};

        let ignoreHeaders = [
            'host', 'referer', 'origin',
            'if-none-match', 'connection', 'cache-control', 'user-agent',
            'accept-encoding', 'x-requested-with', 'accept-language'
        ];

        Object.keys(req.headers).forEach((prop: string) => {
            if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
                    requestHeadersPass.Accept = req.headers[prop];
                } else if (prop.toLowerCase() === 'content-type') {
                    requestHeadersPass['Content-Type'] = req.headers[prop];
                } else {
                    requestHeadersPass[prop] = req.headers[prop];
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
