import * as SocketIO from 'socket.io';
import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';

import { generateGuid } from '../utils/misc';
import { IGatewayServerSettings, IProxySettings } from '../core/interfaces';
import { Logger } from '../utils/logger';

export class Server {

  private server: http.Server;
  private io: SocketIO.Server;
  private socket: SocketIO.Socket;
  private logger: Logger;

  constructor (
    private settings: IGatewayServerSettings,
    private proxy: IProxySettings,
    private app: express.Application
  ) {
    this.server = http.createServer(this.app);
    this.io = SocketIO(this.server);
    this.logger = new Logger(proxy.logLevel);
  }

  public init = (): void => {
    this.server.listen(this.settings.port || this.proxy.port);
    this.io.on('connection', (socket) => {

      this.socket = socket;

      // tslint:disable-next-line: deprecation
      const bodyParserRaw = bodyParser.raw({
        type: '*/*',
        limit: this.proxy.rawBodyLimitSize,
        verify: (req, _res, buf, encoding) => {
          if (buf && buf.length) {
            (req as unknown as { rawBody: string }).rawBody = buf.toString(encoding as BufferEncoding || 'utf8');
            (req as unknown as { buffer: Buffer }).buffer = buf;
          }
        }
      });

      // REST - GET requests (JSON)
      this.app.get('*/_api/*', this.getTransmitter);

      // REST - Files and attachments
      this.app.post('*/_api/*(/attachmentfiles/add|/files/add)*', bodyParserRaw, this.postTransmitter);

      // REST - Batch requests
      this.app.post('*/_api/[$]batch', bodyParserRaw, this.postTransmitter);

      // REST - POST requests (JSON)
      // tslint:disable-next-line: deprecation
      this.app.post('*/_api/*', bodyParser.json({ limit: this.proxy.jsonPayloadLimitSize }), this.postTransmitter);

      //  CSOM/SOAP requests (XML)
      this.app.post('*/_vti_bin/*', this.postTransmitter);

      // Static router
      this.app.get('*', this.getTransmitter);

      // tslint:disable-next-line: deprecation
      this.app.use(bodyParser.urlencoded({ extended: true }));
      this.app.use(cors());

    });
  }

  private getTransmitter = (req: express.Request, res: express.Response): void => {
    const transaction = generateGuid();
    this.logger.info('\nGET: ' + req.originalUrl);
    const responseCallback = (data) => {
      if (data.transaction === transaction) {
        const statusCode = data.response.statusCode;
        let body = data.response.body;
        try { body = JSON.parse(body); } catch (ex) { /**/ }
        res.status(statusCode);
        res.contentType(data.response.headers['content-type']);
        res.send(body);
        this.socket.removeListener('RESPONSE', responseCallback);
      }
    };
    this.socket.on('RESPONSE', responseCallback);
    const request = {
      url: req.originalUrl,
      method: 'GET',
      headers: req.headers,
      transaction
    };
    this.io.emit('REQUEST', request);
  }

  private postTransmitter = (req: express.Request, res: express.Response): void => {
    const transaction = generateGuid();
    this.logger.info('\nPOST: ' + req.originalUrl);
    const responseCallback = (data) => {
      if (data.transaction === transaction) {
        const statusCode = data.response.statusCode;
        let body = data.response.body;
        try { body = JSON.parse(body); } catch (ex) { /**/ }
        res.status(statusCode);
        res.json(body);
        this.socket.removeListener('RESPONSE', responseCallback);
      }
    };
    this.socket.on('RESPONSE', responseCallback);
    const extractPostRequestBody = (request: express.Request, callback?: (body: any) => void): void => {
      let reqBody = '';
      if (request.body) {
        reqBody = request.body;
        if (callback && typeof callback === 'function') {
          callback(reqBody);
        }
      } else {
        request.on('data', (chunk) => reqBody += chunk);
        request.on('end', () => {
          if (callback && typeof callback === 'function') {
            callback(reqBody);
          }
        });
      }
    };
    extractPostRequestBody(req, (body) => {
      const request = {
        url: req.originalUrl,
        method: 'POST',
        headers: req.headers,
        body,
        transaction
      };
      this.io.emit('REQUEST', request);
    });
  }

}
