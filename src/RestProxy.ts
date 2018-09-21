import { AuthConfig, IAuthConfigSettings } from 'node-sp-auth-config';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';

import { RestGetRouter } from './routers/restGet';
import { RestPostRouter } from './routers/restPost';
import { RestBatchRouter } from './routers/restBatch';
import { CsomRouter } from './routers/csom';
import { SoapRouter } from './routers/soap';
import { PostRouter } from './routers/genericPost';
import { GetRouter } from './routers/genericGet';

import { Server as GatewayServer } from './gateway/server';
import { Client as GatewayClient } from './gateway/client';

import {
  IProxySettings,
  IProxyContext,
  IRouters,
  IGatewayServerSettings,
  IGatewayClientSettings,
  IProxyCallback
} from './interfaces';

export default class RestProxy {

  private app: express.Application;
  private settings: IProxySettings;
  private routers: IRouters;

  constructor (settings: IProxySettings = {}) {
    let authConfigSettings: IAuthConfigSettings = settings.authConfigSettings || {};

    this.settings = {
      ...settings as any,
      protocol: typeof settings.protocol !== 'undefined' ? settings.protocol : 'http',
      hostname: settings.hostname || process.env.HOSTNAME || 'localhost',
      port: settings.port || process.env.PORT || 8080,
      staticRoot: path.resolve(settings.staticRoot || path.join(__dirname, '../static')),
      debugOutput: settings.debugOutput || false,
      rawBodyLimitSize: settings.rawBodyLimitSize || '10MB',
      jsonPayloadLimitSize: settings.jsonPayloadLimitSize || '2MB',
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
  public serveProxy = (callback?: IProxyCallback) => {
    this.serve(callback);
  }

  public serve = (callback?: IProxyCallback) => {
    (new AuthConfig(this.settings.authConfigSettings))
      .getContext()
      .then(context => {
        return {
          ...context,
          proxyHostUrl: `${this.settings.protocol}://${this.settings.hostname}:${this.settings.port}`
        } as IProxyContext;
      })
      .then((context: IProxyContext): void => {

        let bodyParserRaw = bodyParser.raw({
          type: req => true, // '*/*', // To catch request without Content-Type header
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
          `/*(${[
            '/attachmentfiles/add',
            '/files/add',
            '/startUpload',
            '/continueUpload',
            '/finishUpload'
          ].join('|')})*`,
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

        // Put and Patch workaround issue #59
        (() => {
          // REST - PUT requests (JSON)
          this.routers.apiRestRouter.put(
            '/*',
            bodyParser.json({
              limit: this.settings.jsonPayloadLimitSize
            }),
            (new RestPostRouter(context, this.settings)).router
          );

          // REST - PATCH requests (JSON)
          this.routers.apiRestRouter.patch(
            '/*',
            bodyParser.json({
              limit: this.settings.jsonPayloadLimitSize
            }),
            (new RestPostRouter(context, this.settings)).router
          );
        })();

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

        const upCallback = (server: https.Server | http.Server, context: IProxyContext, settings: IProxySettings, callback?: IProxyCallback) => {
          if (!settings.silentMode) {
            console.log(`SharePoint REST Proxy has been started on ${context.proxyHostUrl}`);
          }

          // After proxy is started callback
          if (callback && typeof callback === 'function') {
            callback(server, context, settings);
          }
        };

        let server: http.Server | https.Server;
        if (this.settings.protocol === 'https') {
          if (typeof this.settings.ssl === 'undefined') {
            // console.log('Error: No SSL settings provided!');
            // return;
            this.settings.ssl = {
              cert: path.join(__dirname, './../ssl/cert.crt'),
              key: path.join(__dirname, './../ssl/key.pem')
            };
          }
          let options: https.ServerOptions = {
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

export {
  IProxySettings,
  IProxyContext,
  IGatewayClientSettings,
  IGatewayServerSettings
} from './interfaces';
