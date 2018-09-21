import * as SocketIOClient from 'socket.io-client';
import * as httpRequest from 'request';

import { Logger } from '../utils/logger';
import { IGatewayClientSettings, IProxySettings } from '../core/interfaces';

export class Client {

  private socket: SocketIOClient.Socket;
  private logger: Logger;

  constructor (private settings: IGatewayClientSettings, private proxy: IProxySettings) {
    this.socket = SocketIOClient(settings.serverUrl);
    this.logger = new Logger(proxy.logLevel);
  }

  public init = () => {
    this.socket.on('REQUEST', request => {
      const endpoint = this.enpointUrl(request.url);
      this.logger.info(`${request.method} request to ${endpoint}`);
      httpRequest(endpoint, {
        method: request.method,
        headers: request.headers
      }, (err, response) => {
        const responsePackage = {
          transaction: request.transaction,
          err,
          response
        };
        this.socket.emit('RESPONSE', responsePackage);
      });
    });
  }

  private enpointUrl = (relativeUrl: string): string => {
    const hostname = this.proxy.hostname;
    const port = this.proxy.port;
    return `http://${hostname}:${port}${relativeUrl}`
      .replace(':80/', '/').replace(':443/', '/');
  }

}
