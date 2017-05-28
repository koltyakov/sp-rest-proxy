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

    constructor(context: IProxyContext, settings: IProxySettings) {
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

        let regExpOrigin = new RegExp(req.headers.origin, 'g');
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

                    let digest: string = response[0];
                    let opt: IAuthResponse = response[1];

                    let headers = {
                        ...opt.headers,
                        'Accept': '*/*',
                        'Content-Type': 'text/xml',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-RequestDigest': digest,
                        'Content-Length': csomPackage.length
                    };

                    return this.spr.post(endpointUrl, {
                        headers: headers,
                        body: csomPackage,
                        json: false
                    });
                })
                .then((response: any) => {
                    if (this.settings.debugOutput) {
                        console.log(response.statusCode, response.body);
                    }
                    res.send(response);
                    res.end();
                })
                .catch((err: any) => {
                    res.status(err.statusCode);
                    res.json(err);
                });
        });
    }
}
