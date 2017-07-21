'use strict';

import { AuthConfig } from 'node-sp-auth-config';
import { Request, Response, NextFunction } from 'express';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';

import { RestGetRouter } from './routers/restGet';
import { RestPostRouter } from './routers/restPost';
import { RestBatchRouter } from './routers/restBatch';
import { CsomRouter } from './routers/csom';
import { SoapRouter } from './routers/soap';
import { PostRouter } from './routers/genericPost';
import { GetRouter } from './routers/genericGet';

import { Server as GatewayServer } from './gateway/server';
import { Client as GatewayClient } from './gateway/client';

import { IProxySettings, IProxyContext, IRouters } from './interfaces';
import { IGatewayServerSettings, IGatewayClientSettings } from './interfaces';

export default class RestProxy {

    private app: express.Application;
    private settings: IProxySettings;
    private routers: IRouters;

    constructor(settings: IProxySettings = {}) {
        this.settings = {
            ...settings,
            configPath: path.resolve(settings.configPath || './config/private.json'),
            hostname: settings.hostname || process.env.HOSTNAME || 'localhost',
            port: settings.port || process.env.PORT || 8080,
            staticRoot: path.resolve(settings.staticRoot || path.join(__dirname, '../static')),
            staticLibPath: path.resolve(settings.staticLibPath || path.join(__dirname, '../static/bower_components')),
            debugOutput: settings.debugOutput || false,
            rawBodyLimitSize: settings.rawBodyLimitSize || '2mb',
            jsonPayloadLimitSize: settings.jsonPayloadLimitSize || '2mb',
            metadata: require(path.join(__dirname, '/../package.json')),
            silentMode: typeof settings.silentMode !== 'undefined' ? settings.silentMode : false
        };

        this.app = express();

        this.routers = {
            apiRestRouter: express.Router(),
            apiCsomRouter: express.Router(),
            apiSoapRouter: express.Router(),
            genericPostRouter: express.Router(),
            genericGetRouter: express.Router()
        };
    }

    // Server proxy main mode
    public serveProxy = (callback?: Function) => { this.serve(callback); }
    public serve = (callback?: Function) => {
        (new AuthConfig({
            configPath: this.settings.configPath,
            defaultConfigPath: this.settings.defaultConfigPath,
            encryptPassword: true,
            saveConfigOnDisk: true
        }))
            .getContext()
            .then((context: IProxyContext): void => {

                let bodyParserRaw = bodyParser.raw({
                    type: '*/*',
                    limit: this.settings.rawBodyLimitSize,
                    verify: (req, res, buf, encoding) => {
                        if (buf && buf.length) {
                            req.rawBody = buf.toString(encoding || 'utf8');
                            req.buffer = buf;
                        }
                    }
                });

                let agent = new https.Agent({
                  keepAlive: true,
                  keepAliveMsecs: 10000
                });

                // REST - Files and attachments
                this.routers.apiRestRouter.post(
                    '/*(/attachmentfiles/add|/files/add)*',
                    bodyParserRaw,
                    (new RestPostRouter(context, this.settings, agent)).router
                );

                // REST - Batch requests
                this.routers.apiRestRouter.post(
                    '/[$]batch',
                    bodyParserRaw,
                    (new RestBatchRouter(context, this.settings, agent)).router
                );

                // REST - GET requests (JSON)
                this.routers.apiRestRouter.get(
                    '/*',
                    (new RestGetRouter(context, this.settings, agent)).router
                );

                // REST - POST requests (JSON)
                this.routers.apiRestRouter.post(
                    '/*',
                    bodyParser.json({
                        limit: this.settings.jsonPayloadLimitSize
                    }),
                    (new RestPostRouter(context, this.settings, agent)).router
                );

                //  CSOM requests (XML)
                this.routers.apiCsomRouter.post(
                    '/*',
                    (new CsomRouter(context, this.settings, agent)).router
                );

                //  SOAP requests (XML)
                this.routers.apiSoapRouter.post(
                    '/*',
                    (new SoapRouter(context, this.settings, agent)).router
                );

                // Generic GET and static local content
                this.routers.genericGetRouter.get(
                    '/*',
                    (new GetRouter(context, this.settings, agent)).router
                );

                // Generic POST
                this.routers.genericPostRouter.post(
                    '/*',
                    (new PostRouter(context, this.settings, agent)).router
                );

                this.app.use(bodyParser.urlencoded({ extended: true }));

                this.app.use(cors());
                this.app.use('*/_api', this.routers.apiRestRouter);
                this.app.use('*/_vti_bin/client.svc/ProcessQuery', this.routers.apiCsomRouter);
                this.app.use('*/_vti_bin/*.asmx', this.routers.apiSoapRouter);

                this.app.use('/', this.routers.genericPostRouter);
                this.app.use('/', this.routers.genericGetRouter);

                let server = this.app.listen(this.settings.port, this.settings.hostname, () => {
                    if (!this.settings.silentMode) {
                        console.log(`SharePoint REST Proxy has been started on http://${this.settings.hostname}:${this.settings.port}`);
                    }

                    // After proxy is started callback
                    if (callback && typeof callback === 'function') {
                        callback(server, context, this.settings);
                    }
                });

            })
            .catch((err: any) => {
                console.log('Error', err);
            });
    }

    // Serve socket gateway server
    public serveGateway = (settings: IGatewayServerSettings) => {
        (new GatewayServer(settings, this.settings, this.app)).init();
    }

    // Serve socker gateway client
    public serveClient = (settings: IGatewayClientSettings) => {
        (new GatewayClient(settings, this.settings)).init();
        this.serve();
    }

}

export { IProxySettings, IProxyContext, IGatewayClientSettings, IGatewayServerSettings } from './interfaces';
