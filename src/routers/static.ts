import * as fs from 'fs';
import * as path from 'path';

import { ProxyUtils } from '../utils';
import { IProxyContext, IProxySettings } from '../interfaces';
import { Request, Response, NextFunction } from 'express';

export class StaticRouter {

    private ctx: IProxyContext;
    private settings: IProxySettings;
    private staticLibPathExists: boolean;

    constructor(context: IProxyContext, settings: IProxySettings) {
        this.ctx = context;
        this.settings = settings;
        this.staticLibPathExists = fs.existsSync(settings.staticLibPath);
    }

    public router = (req: Request, res: Response, next?: NextFunction) => {
        let url = '';

        if (this.staticLibPathExists) {
            url = '/index.html';
        } else {
            url = '/index-cdn.html';
        }

        if (req.url !== '/') {
            url = req.url;
        } else {
            let pageContent = String(fs.readFileSync(path.join(this.settings.staticRoot, url)));
            pageContent = pageContent.replace('##proxyVersion#', this.settings.metadata.version);
            res.send(pageContent);
            return;
        }
        if (req.url === '/config') {
            let response = {
                siteUrl: this.ctx.siteUrl,
                username: (this.ctx.context as any).username || 'Add-In'
            };
            res.json(response);
            return;
        }
        res.sendFile(path.join(this.settings.staticRoot, url));
    }
}
