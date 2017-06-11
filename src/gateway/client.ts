import * as SocketIOClient from 'socket.io-client';
import * as httpRequest from 'request';

import { getCaseInsensitiveProp } from '../utils';
import { IGatewayClientSettings, IProxySettings } from '../interfaces';

export class Client {

    private settings: IGatewayClientSettings;
    private proxy: IProxySettings;
    private socket: SocketIOClient.Socket;

    constructor(settings: IGatewayClientSettings, proxy: IProxySettings) {
        this.socket = SocketIOClient(settings.serverUrl);
        this.settings = settings;
        this.proxy = proxy;
    }

    public init = () => {
        this.socket.on('REQUEST', (request) => {
            let endpoint = this.enpointUrl(request.url);
            console.log(`${request.method} request to ${endpoint}`);
            httpRequest(endpoint, {
                method: request.method,
                headers: request.headers
            }, (err, response) => {
                let responsePackage = {
                    transaction: request.transaction,
                    err, response
                };
                this.socket.emit('RESPONSE', responsePackage);
            });
        });
    }

    private enpointUrl = (relativeUrl: string): string => {
        let hostname = this.proxy.hostname;
        let port = this.proxy.port;
        return `http://${hostname}:${port}${relativeUrl}`
            .replace(':80/', '/').replace(':443/', '/');
    }

}
