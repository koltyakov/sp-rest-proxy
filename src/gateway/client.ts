import SocketIOClient, { Socket } from 'socket.io-client';

import fetch from 'node-fetch';
import { Logger } from '../utils/logger';
import { IGatewayClientSettings, IProxySettings } from '../core/interfaces';

export class Client {

  private socket: Socket;
  private logger: Logger;

  constructor (private settings: IGatewayClientSettings, private proxy: IProxySettings) {
    this.socket = SocketIOClient(settings.serverUrl);
    this.logger = new Logger(proxy.logLevel);
  }

  public init = (): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket.on('REQUEST', (request: any) => {
      const endpoint = this.enpointUrl(request.url);
      this.logger.info(`${request.method} request to ${endpoint}`);
      const responsePackage = {
        transaction: request.transaction,
        err: null,
        response: null
      };
      fetch(endpoint, {
        method: request.method,
        headers: request.headers
      })
        .then((r) => {
          if (!r.ok) {
            responsePackage.err = r.statusText;
          }
          return r;
        })
        .then(async (r) => {
          responsePackage.response = {
            ...r,
            body: await r.text()
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
