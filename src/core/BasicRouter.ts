import { Request, Response, NextFunction } from 'express';

import { SPClient, SPResponse, FetchError } from '../utils/client';
import { UrlUtils } from '../utils/url';
import { Logger, LogLevel } from '../utils/logger';

import { IProxyContext, IProxySettings } from './interfaces';
import { copyHeaders } from '../utils/headers';

const keepHeaders = [ 'cache-control', 'content-length', 'content-type', 'date', 'etag', 'expires', 'last-modified', 'request-id' ];

export class BasicRouter {

  public sp: SPClient;
  public url: UrlUtils;
  public logger: Logger;

  constructor(public ctx: IProxyContext, public settings: IProxySettings) {
    this.sp = new SPClient(ctx, settings);
    this.url = new UrlUtils(ctx, settings);
    this.logger = new Logger(settings.logLevel);
  }

  public router: (req: Request, r: Response, next?: NextFunction) => void;


  public handlers = {
    isOK: async (resp: SPResponse): Promise<SPResponse> => {
      if (!resp.ok) {
        const error: FetchError = {
          status: resp.status,
          statusText: resp.statusText,
          response: resp
        };
        try {
          error.body = await resp.clone().text();
        } catch(ex) { /**/ }
        throw error;
      }
      return resp;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: (r: Response) => async (resp: SPResponse, bodyReader?: (r: SPResponse) => Promise<any>): Promise<void> => {
      bodyReader = bodyReader || ((a) => a.text());
      const data = await bodyReader(resp);

      this.logger.verbose(resp.status, `${data}`);

      // Injecting ad-hoc response mapper
      if (typeof this.settings.hooks?.responseMapper === 'function') {
        try {
          resp = await this.settings.hooks.responseMapper(r.req, resp, this);
        } catch (ex) { /**/ }
      }

      copyHeaders(r, resp.headers, keepHeaders);
      r.status(resp.status);

      const ct = resp.headers.get('content-type');
      if (ct) { r.contentType(ct); }
      r.send(data);
    },

    responsePipe: (r: Response) => async (resp: SPResponse): Promise<void> => {
      if (this.settings.logLevel >= LogLevel.Verbose) {
        const data = await resp.clone().text();
        this.logger.verbose(resp.statusText, data);
      }
      // Injecting ad-hoc response mapper
      if (typeof this.settings.hooks?.responseMapper === 'function') {
        try {
          resp = await this.settings.hooks.responseMapper(r.req, resp, this);
        } catch (ex) { /**/ }
      }
      copyHeaders(r, resp.headers, keepHeaders);
      r.status(resp.status);
      const ct = resp.headers.get('content-type');
      if (ct) { r.contentType(ct); }
      resp.body.pipe(r);
    },

    error: (r: Response) => (err: FetchError): void => {
      const { status, statusText, body, response: apiResp } = err;
      if (status) {
        this.logger.error('Error', { status, statusText, body });
      } else {
        this.logger.error('Error', err);
      }

      r.status(status || 400);
      if (apiResp) {
        copyHeaders(r, apiResp.headers, keepHeaders);
        const ct = apiResp.headers.get('content-type');
        if (ct) { r.contentType(ct); }
      }
      const message = (err as unknown as { message: string }).message;

      r.send(
        body ||
        statusText ||
        (message && `Proxy Error: ${message} (see more in sp-rest-proxy console)`) ||
        'Unknown error'
      );
    }
  };

}
