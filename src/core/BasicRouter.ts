import { Request, Response, NextFunction } from 'express';

import { ProxyUtils } from '../utils/proxy';
import { Logger } from '../utils/logger';

import { ISPRequest } from 'sp-request';
import { IProxyContext, IProxySettings } from './interfaces';
import { IncomingMessage } from 'http';

export class BasicRouter {

  public spr: ISPRequest;
  public util: ProxyUtils;
  public logger: Logger;

  constructor(public ctx: IProxyContext, public settings: IProxySettings) {
    this.util = new ProxyUtils(ctx, settings);
    this.logger = new Logger(settings.logLevel);
  }

  public router: (req: Request, res: Response, next?: NextFunction) => void;

  public getHttpClient(): ISPRequest {
    this.spr = this.util.getCachedRequest(this.spr);
    return this.spr;
  }

  public async transmitResponse(res: Response, response: IncomingMessage): Promise<void> {
    this.logger.verbose(response.statusCode, response.body);
    res.status(response.statusCode);
    res.contentType(response.headers['content-type'] || '');
    // Injecting ad-hoc response mapper
    if (this.settings.hooks && this.settings.hooks.responseMapper && typeof this.settings.hooks.responseMapper === 'function') {
      try {
        response = await this.settings.hooks.responseMapper(res.req, response);
      } catch (ex) { /**/ }
    }
    res.send(response.body);
  }

  public transmitError(res: Response, err: any): void {
    const { statusCode, message, error } = err;
    this.logger.verbose('Error', { statusCode, message, error });
    const response: IncomingMessage = err.response || {
      statusCode: statusCode || 400,
      headers: {},
      body: message || 'Unknown error'
    };
    res.status(response.statusCode);
    res.contentType(response.headers['content-type'] || '');
    res.send(response.body);
  }

}
