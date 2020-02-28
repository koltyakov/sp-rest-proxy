import { AuthConfig, IAuthConfigSettings } from 'node-sp-auth-config';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

import { Logger } from '../utils/logger';
import { RestGetRouter } from './routers/restGet';
import { RestPostRouter } from './routers/restPost';
import { RestBatchRouter } from './routers/restBatch';
import { CsomRouter } from './routers/csom';
import { SoapRouter } from './routers/soap';
import { PostRouter } from './routers/genericPost';
import { GetRouter } from './routers/genericGet';

import { Server as GatewayServer } from '../gateway/server';
import { Client as GatewayClient } from '../gateway/client';

import {
  IProxySettings,
  IProxyContext,
  IRouters,
  IGatewayServerSettings,
  IGatewayClientSettings,
  IProxyCallback,
  IProxyErrorCallback
} from './interfaces';

export default class RestProxy {

  private app: express.Application;
  private settings: IProxySettings;
  private routers: IRouters;
  private logger: Logger;
  private isExtApp: boolean = false;

  constructor(settings: IProxySettings = {}, app?: express.Application) {
    const authConfigSettings: IAuthConfigSettings = settings.authConfigSettings || {};

    this.settings = {
      ...settings as any,
      protocol: typeof settings.protocol !== 'undefined' ? settings.protocol : 'http',
      hostname: settings.hostname || process.env.HOSTNAME || 'localhost',
      port: settings.port || process.env.PORT || 8080,
      staticRoot: path.resolve(settings.staticRoot || path.join(__dirname, '/../../static')),
      rawBodyLimitSize: settings.rawBodyLimitSize || '10MB',
      jsonPayloadLimitSize: settings.jsonPayloadLimitSize || '2MB',
      metadata: require(path.join(__dirname, '/../../package.json')),
      strictRelativeUrls: typeof settings.strictRelativeUrls !== 'undefined' ? settings.strictRelativeUrls : false,
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

    this.logger = new Logger(this.settings.logLevel);

    if (typeof app !== 'undefined') {
      this.app = app;
      this.isExtApp = true;
    } else {
      this.app = express();
    }

    this.routers = {
      apiRestRouter: express.Router(),
      apiCsomRouter: express.Router(),
      apiSoapRouter: express.Router(),
      genericPostRouter: express.Router(),
      genericGetRouter: express.Router()
    };
  }

  // Server proxy main mode
  public serveProxy(callback?: IProxyCallback): void {
    this.serve(callback);
  }

  // Serve socket gateway server
  public serveGateway = (settings: IGatewayServerSettings): void => {
    new GatewayServer(settings, this.settings, this.app).init();
  }

  // Serve socker gateway client
  public serveClient = (settings: IGatewayClientSettings): void => {
    new GatewayClient(settings, this.settings).init();
    this.serve();
  }

  // Keep public for backward compatibility
  public serve(callback?: IProxyCallback, errorCallback?: IProxyErrorCallback): void {
    (async () => {

      const ctx = await new AuthConfig(this.settings.authConfigSettings).getContext();

      const context = {
        ...ctx,
        proxyHostUrl: `${this.settings.protocol}://${this.settings.hostname}:${this.settings.port}`
      } as IProxyContext;

      // tslint:disable-next-line: deprecation
      const bodyParserRaw = bodyParser.raw({
        type: () => true, // '*/*', // To catch request without Content-Type header
        limit: this.settings.rawBodyLimitSize,
        verify: (req, _res, buf, encoding) => {
          if (buf && buf.length) {
            (req as any).rawBody = buf.toString(encoding || 'utf8');
            (req as any).buffer = buf;
          }
        }
      });

      // tslint:disable-next-line: deprecation
      const bodyParserUrlencoded = bodyParser.urlencoded({ extended: true });

      // REST - Files and attachments
      this.routers.apiRestRouter.post(
        `/*(${[
          '/attachmentfiles/add',
          '/files/add',
          '/startUpload',
          '/continueUpload',
          '/finishUpload',
          '/_layouts/15/Upload'
        ].join('|')})*`,
        bodyParserRaw,
        new RestPostRouter(context, this.settings).router
      );

      // REST - Batch requests
      this.routers.apiRestRouter.post(
        '/[$]batch',
        bodyParserRaw,
        new RestBatchRouter(context, this.settings).router
      );

      // REST - GET requests (JSON)
      this.routers.apiRestRouter.get(
        '/*',
        new RestGetRouter(context, this.settings).router
      );

      // REST - POST requests (JSON)
      this.routers.apiRestRouter.post(
        '/*',
        // tslint:disable-next-line: deprecation
        bodyParser.json({
          limit: this.settings.jsonPayloadLimitSize
        }),
        new RestPostRouter(context, this.settings).router
      );

      // Put and Patch workaround issue #59
      (() => {
        // REST - PUT requests (JSON)
        this.routers.apiRestRouter.put(
          '/*',
          // tslint:disable-next-line: deprecation
          bodyParser.json({
            limit: this.settings.jsonPayloadLimitSize
          }),
          new RestPostRouter(context, this.settings).router
        );

        // REST - PATCH requests (JSON)
        this.routers.apiRestRouter.patch(
          '/*',
          // tslint:disable-next-line: deprecation
          bodyParser.json({
            limit: this.settings.jsonPayloadLimitSize
          }),
          new RestPostRouter(context, this.settings).router
        );
      })();

      //  CSOM requests (XML)
      this.routers.apiCsomRouter.post(
        '/*',
        bodyParserUrlencoded,
        new CsomRouter(context, this.settings).router
      );

      //  SOAP requests (XML)
      this.routers.apiSoapRouter.post(
        '/*',
        bodyParserUrlencoded,
        new SoapRouter(context, this.settings).router
      );

      // Generic GET and static local content
      this.routers.genericGetRouter.get(
        '/*',
        new GetRouter(context, this.settings).router
      );

      // Generic POST
      this.routers.genericPostRouter.post(
        '/*',
        bodyParserUrlencoded,
        new PostRouter(context, this.settings).router
      );

      // this.app.use(bodyParser.urlencoded({ extended: true }));

      this.app.use(cors());
      this.app.use('*/_api', this.routers.apiRestRouter);
      this.app.use('*/_vti_bin/client.svc/ProcessQuery', this.routers.apiCsomRouter);
      this.app.use('*/_vti_bin/*.asmx', this.routers.apiSoapRouter);

      // SP2010 legacy REST API, issue #54
      this.app.use('*/_vti_bin/ListData.svc', this.routers.genericPostRouter);
      this.app.use('*/_vti_bin/ListData.svc', this.routers.genericGetRouter);

      this.app.use('/', this.routers.genericPostRouter);
      this.app.use('/', this.routers.genericGetRouter);

      // Deligate serving to external app
      if (this.isExtApp) { return; }

      const upCallback = (server: https.Server | http.Server, context: IProxyContext, settings: IProxySettings, callback?: IProxyCallback) => {
        this.logger.info(`SharePoint REST Proxy has been started on ${context.proxyHostUrl}`);
        // After proxy is started callback
        if (callback && typeof callback === 'function') {
          callback(server, context, settings);
        }
      };

      let server: http.Server | https.Server = null;
      if (this.settings.protocol === 'https') {
        if (typeof this.settings.ssl === 'undefined') {
          // console.log('Error: No SSL settings provided!');
          // return;
          this.settings.ssl = {
            cert: path.join(__dirname, './../../ssl/cert.crt'),
            key: path.join(__dirname, './../../ssl/key.pem')
          };
        }
        const options: https.ServerOptions = {
          cert: fs.existsSync(this.settings.ssl.cert) ? fs.readFileSync(this.settings.ssl.cert) : this.settings.ssl.cert,
          key: fs.existsSync(this.settings.ssl.key) ? fs.readFileSync(this.settings.ssl.key) : this.settings.ssl.key
        };
        server = https.createServer(options, this.app);
      } else {
        server = require('http').Server(this.app);
      }

      if (server) {
        server.listen(this.settings.port, this.settings.hostname, () => {
          upCallback(server, context, this.settings, callback);
        });
      }

    })().catch((error) => {
      this.logger.error(error);
      if (errorCallback) {
        errorCallback(error);
      }
    });
  }

}

export {
  IProxySettings,
  IProxyContext,
  IGatewayClientSettings,
  IGatewayServerSettings
} from './interfaces';
