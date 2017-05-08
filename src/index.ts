'use strict';

import { Request, Response, NextFunction } from 'express';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';

import { Context } from './utils/context';
import { RestGetRouter } from './routers/restGet';
import { RestPostRouter } from './routers/restPost';
import { SoapRouter } from './routers/soap';
import { StaticRouter } from './routers/static';
import { IProxySettings, IProxyContext, IRouters } from './interfaces';

class RestProxy {

    public app: express.Application;
    public settings: IProxySettings;
    public routers: IRouters;

    constructor(settings: IProxySettings = {}) {
        this.settings = {
            ...settings,
            configPath: settings.configPath || path.join(__dirname, '/../config/private.json'),
            hostname: settings.hostname || process.env.HOSTNAME || 'localhost',
            port: settings.port || process.env.PORT || 8080,
            staticRoot: settings.staticRoot || path.join(__dirname, '/../static'),
            staticLibPath: settings.staticLibPath || path.join(__dirname, '/../bower_components'),
            debugOutput: settings.debugOutput || false,
            metadata: require(path.join(__dirname, '/../package.json'))
        };

        this.app = express();

        this.routers = {
            apiRestRouter: express.Router(),
            apiSoapRouter: express.Router(),
            staticRouter: express.Router()
        };
    }

    public serve = () => {
        (new Context(this.settings))
            .get()
            .then((ctx: IProxyContext): void => {

                /* Original implementations */
                // this.app.use(bodyParser.urlencoded({ extended: true }));
                // this.app.use(bodyParser.json({ strict: true }));

                /* Experiments with middleware */
                // this.app.use((req: Request, res: Response, next: NextFunction) => {
                //     if (req.originalUrl.toLowerCase().indexOf('/attachmentfiles/add(') !== -1) {
                //         req.headers['Content-Type'] = 'text/html';
                //     }
                //     console.log('middleware');
                //     next();
                // });

                /* Experiments with body parser verify */
                // this.app.use(bodyParser.json({
                //     strict: false,
                //     verify: (req, res, buf, encoding) => {
                //         if (buf && buf.length) {
                //             req.rawBody = buf.toString(encoding || 'utf8');
                //         }
                //         console.log('req.rawBody', req.rawBody);
                //         return false;
                //     }
                // }));
                // this.app.use(bodyParser.urlencoded({ extended: true }));


                /* Raw text body injection into specific URI endpoint */
                let bodyParserText = bodyParser.text({
                    type: '*/*',
                    verify: (req, res, buf, encoding) => {
                        if (buf && buf.length) {
                            req.rawBody = buf.toString(encoding || 'utf8');
                        }
                        return false;
                    }
                });
                this.routers.apiRestRouter.post('/*(/attachmentfiles/add)*', bodyParserText, (new RestPostRouter(ctx, this.settings)).router);
                /* Raw body injection into specific URI endpoint */

                this.routers.apiRestRouter.get('/*', (new RestGetRouter(ctx, this.settings)).router);
                this.routers.apiRestRouter.post('/*', bodyParser.json(), (new RestPostRouter(ctx, this.settings)).router);
                this.routers.apiSoapRouter.post('/*', (new SoapRouter(ctx, this.settings)).router);
                this.routers.staticRouter.get('/*', (new StaticRouter(ctx, this.settings)).router);

                this.app.use(bodyParser.urlencoded({ extended: true }));

                this.app.use(cors());
                this.app.use('*/_api', this.routers.apiRestRouter);
                this.app.use('*/_vti_bin', this.routers.apiSoapRouter);
                this.app.use('/', this.routers.staticRouter);

                this.app.listen(this.settings.port, this.settings.hostname, () => {
                    console.log(`SharePoint REST Proxy has been started on http://${this.settings.hostname}:${this.settings.port}`);
                });
            })
            .catch((err: any) => {
                console.log('Error', err);
            });
    }
}

module.exports = RestProxy;
