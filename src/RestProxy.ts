'use strict';

import { AuthConfig, IAuthConfigSettings } from 'node-sp-auth-config';
import * as express from 'express';
// tslint:disable-next-line:no-duplicate-imports
import { Request, Response, NextFunction } from 'express';
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

import { IProxySettings, IProxyContext, IRouters,
         IGatewayServerSettings, IGatewayClientSettings
} from './interfaces';

export default class RestProxy {

  private app: express.Application;
  private settings: IProxySettings;
  private routers: IRouters;

  constructor (settings: IProxySettings = {}) {
    let authConfigSettings: IAuthConfigSettings = settings.authConfigSettings || {};

    this.settings = {
      ...settings as any,
      hostname: settings.hostname || process.env.HOSTNAME || 'localhost',
      port: settings.port || process.env.PORT || 8080,
      staticRoot: path.resolve(settings.staticRoot || path.join(__dirname, '../static')),
      staticLibPath: path.resolve(settings.staticLibPath || path.join(__dirname, '../static/bower_components')),
      debugOutput: settings.debugOutput || false,
      rawBodyLimitSize: settings.rawBodyLimitSize || '2mb',
      jsonPayloadLimitSize: settings.jsonPayloadLimitSize || '2mb',
      metadata: require(path.join(__dirname, '/../package.json')),
      silentMode: typeof settings.silentMode !== 'undefined' ? settings.silentMode : false,
      agent: settings.agent || new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 10000
      }),
      authConfigSettings: {
        ...authConfigSettings,
        configPath: path.resolve(authConfigSettings.configPath || settings.configPath || './config/private.json'),
        defaultConfigPath: authConfigSettings.defaultConfigPath || settings.defaultConfigPath,
        encryptPassword: typeof authConfigSettings.encryptPassword !== 'undefined' ? authConfigSettings.encryptPassword : true,
        saveConfigOnDisk: typeof authConfigSettings.saveConfigOnDisk !== 'undefined' ? authConfigSettings.saveConfigOnDisk : true
      }
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
  public serveProxy = (callback?: Function) => {
    this.serve(callback);
  }

  public serve = (callback?: Function) => {
    (new AuthConfig(this.settings.authConfigSettings))
      .getContext()
      .then((context: IProxyContext): void => {

        let bodyParserRaw = bodyParser.raw({
          type: '*/*',
          limit: this.settings.rawBodyLimitSize,
          verify: (req, res, buf, encoding) => {
            if (buf && buf.length) {
              (req as any).rawBody = buf.toString(encoding || 'utf8');
              (req as any).buffer = buf;
            }
          }
        });

        let bodyParserUrlencoded = bodyParser.urlencoded({ extended: true });

        // REST - Files and attachments
        this.routers.apiRestRouter.post(
          '/*(/attachmentfiles/add|/files/add)*',
          bodyParserRaw,
          (new RestPostRouter(context, this.settings)).router
        );

        // REST - Batch requests
        this.routers.apiRestRouter.post(
          '/[$]batch',
          bodyParserRaw,
          (new RestBatchRouter(context, this.settings)).router
        );

        // REST - GET requests (JSON)
        this.routers.apiRestRouter.get(
          '/*',
          (new RestGetRouter(context, this.settings)).router
        );

        // REST - POST requests (JSON)
        this.routers.apiRestRouter.post(
          '/*',
          bodyParser.json({
            limit: this.settings.jsonPayloadLimitSize
          }),
          (new RestPostRouter(context, this.settings)).router
        );

        //  CSOM requests (XML)
        this.routers.apiCsomRouter.post(
          '/*',
          bodyParserUrlencoded,
          (new CsomRouter(context, this.settings)).router
        );

        //  SOAP requests (XML)
        this.routers.apiSoapRouter.post(
          '/*',
          bodyParserUrlencoded,
          (new SoapRouter(context, this.settings)).router
        );

        // Generic GET and static local content
        this.routers.genericGetRouter.get(
          '/*',
          (new GetRouter(context, this.settings)).router
        );

        // Generic POST
        this.routers.genericPostRouter.post(
          '/*',
          bodyParserUrlencoded,
          (new PostRouter(context, this.settings)).router
        );

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
