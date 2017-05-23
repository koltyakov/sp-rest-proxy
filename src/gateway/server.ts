import * as SocketIO from 'socket.io';
import * as http from 'http';

import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as cors from 'cors';

// import { getCaseInsensitiveProp } from '../utils';
import { StaticRouter } from '../routers/static';

import { generateGuid } from '../utils';
import { IGatewayServerSettings, IProxySettings } from '../interfaces';
import { Application } from 'express';

export class Server {

    private settings: IGatewayServerSettings;
    private proxy: IProxySettings;

    private server: http.Server;
    private io: SocketIO.Server;
    private app: Application;

    constructor(settings: IGatewayServerSettings, proxy: IProxySettings, app: Application) {
        this.app = app;
        this.server = http.createServer(this.app);
        this.io = SocketIO(this.server);
        this.settings = settings;
        this.proxy = proxy;
    }

    public init() {
        this.server.listen(this.settings.port || this.proxy.port);
        this.io.on('connection', (socket) => {

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
            this.app.get('*/_api/*', (req, res) => {
                const transaction = generateGuid();

                console.log('\nGET: ' + req.originalUrl);

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
                        socket.removeListener('RESPONSE', responseCallback);
                    }
                };
                socket.on('RESPONSE', responseCallback);

                let request = {
                    url: req.originalUrl,
                    method: 'GET',
                    headers: req.headers,
                    transaction: transaction
                };
                this.io.emit('REQUEST', request);
            });

            // REST - Files and attachments
            this.app.post('*/_api/*(/attachmentfiles/add|/files/add)*', bodyParserRaw, (req, res) => {
                //
            });

            // REST - Batch requests
            this.app.post('*/_api/[$]batch', bodyParserRaw, (req, res) => {
                //
            });

            // REST - POST requests (JSON)
            this.app.post('*/_api/*', bodyParser.json({
                limit: this.proxy.jsonPayloadLimitSize
            }), (req, res) => {
                const transaction = generateGuid();

                console.log('\nPOST: ' + req.originalUrl);

                //
            });

            //  SOAP requests (XML)
            this.app.post('*/_vti_bin/*', (req, res) => {
                //
            });

            let staticRouter = express.Router();
            staticRouter.get(
                '/*',
                (new StaticRouter({
                    siteUrl: '/gateway',
                    authOptions: {
                        username: 'Gateway mode',
                        password: ''
                    }
                }, this.proxy)).router
            );

            this.app.use(bodyParser.urlencoded({ extended: true }));
            this.app.use(cors());
            this.app.use('/', staticRouter);

        });
    }

}
