import { Request, Response, NextFunction } from 'express';

import { ProxyUtils } from '../utils';
import { Logger } from '../utils/logger';

import { ISPRequest } from 'sp-request';
import { IProxyContext, IProxySettings } from './interfaces';

export class BasicRouter {

  public spr: ISPRequest;
  public util: ProxyUtils;
  public logger: Logger;

  constructor(public ctx: IProxyContext, public settings: IProxySettings) {
    this.util = new ProxyUtils(this.ctx);
    this.logger = new Logger(settings.logLevel);
  }

  public router: (req: Request, res: Response, next?: NextFunction) => void;

  public getHttpClient(): ISPRequest {
    this.spr = this.util.getCachedRequest(this.spr);
    return this.spr;
  }

}
