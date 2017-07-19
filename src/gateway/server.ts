import * as SocketIO from 'socket.io';
import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';

import { generateGuid } from '../utils';
import { IGatewayServerSettings, IProxySettings } from '../interfaces';
import { Application } from 'express';

export class Server {

    private settings: IGatewayServerSettings;
    private proxy: IProxySettings;

    private server: http.Server;
    private io: SocketIO.Server;
    private socket: SocketIO.Socket;
    private app: Application;

    constructor(settings: IGatewayServerSettings, proxy: IProxySettings, app: Application) {
        this.app = app;
        this.server = http.createServer(this.app);
        this.io = SocketIO(this.server);
        this.settings = settings;
        this.proxy = proxy;
    }

    public init = () => {
        this.server.listen(this.settings.port || this.proxy.port);
        this.io.on('connection', (socket) => {

            this.socket = socket;

            let bodyParserRaw = bodyParser.raw({
                type: '*/*',
                limit: this.proxy.rawBodyLimitSize,
                verify: (req, res, buf, encoding) => {
                    if (buf && buf.length) {
                        req.rawBody = buf.toString(encoding || 'utf8');
                        req.buffer = buf;
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
            this.app.post('*/_api/*', bodyParser.json({ limit: this.proxy.jsonPayloadLimitSize }), this.postTransmitter);

            //  CSOM/SOAP requests (XML)
            this.app.post('*/_vti_bin/*', this.postTransmitter);

            // Static router
            this.app.get('*', this.getTransmitter);

            this.app.use(bodyParser.urlencoded({ extended: true }));
            this.app.use(cors());

        });
    }

    private getTransmitter = (req: express.Request, res: express.Response) => {
        const transaction = generateGuid();

        if (!this.proxy.silentMode) {
            console.log('\nGET: ' + req.originalUrl);
        }

        const responseCallback = (data) => {
            if (data.transaction === transaction) {
                let statusCode = data.response.statusCode;
                let body = data.response.body;

                try {
                    body = JSON.parse(body);
                } catch (ex) {
                    //
                }

                res.status(statusCode);
                res.contentType(data.response.headers['content-type']);

                res.send(body);

                this.socket.removeListener('RESPONSE', responseCallback);
            }
        };
        this.socket.on('RESPONSE', responseCallback);

        let request = {
            url: req.originalUrl,
            method: 'GET',
            headers: req.headers,
            transaction: transaction
        };
        this.io.emit('REQUEST', request);
    }

    private postTransmitter = (req: express.Request, res: express.Response) => {
        const transaction = generateGuid();

        if (!this.proxy.silentMode) {
            console.log('\nPOST: ' + req.originalUrl);
        }

        const responseCallback = (data) => {
            if (data.transaction === transaction) {
                let statusCode = data.response.statusCode;
                let body = data.response.body;
                try {
                    body = JSON.parse(body);
                } catch (ex) {
                    //
                }
                res.status(statusCode);
                res.json(body);
                this.socket.removeListener('RESPONSE', responseCallback);
            }
        };
        this.socket.on('RESPONSE', responseCallback);

        const extractPostRequestBody = (request: express.Request, callback: Function): void => {
            let reqBody = '';

            if (request.body) {
                reqBody = request.body;
                if (callback && typeof callback === 'function') {
                    callback(reqBody);
                }
            } else {
                request.on('data', (chunk) => {
                    reqBody += chunk;
                });
                request.on('end', () => {
                    if (callback && typeof callback === 'function') {
                        callback(reqBody);
                    }
                });
            }
        };

        extractPostRequestBody(req, (body: any) => {
            let request = {
                url: req.originalUrl,
                method: 'POST',
                headers: req.headers,
                body: body,
                transaction: transaction
            };
            this.io.emit('REQUEST', request);
        });
    }

}
