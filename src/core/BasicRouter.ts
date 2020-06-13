import { Request, Response, NextFunction } from 'express';

import { ProxyUtils, FetchClient, FetchResponse } from '../utils/proxy';
import { Logger } from '../utils/logger';

import { IProxyContext, IProxySettings } from './interfaces';

export interface FetchError {
  response: FetchResponse;
  status: number;
  statusText: string;
  body?: string;
}

export class BasicRouter {

  public util: ProxyUtils;
  public logger: Logger;

  constructor(public ctx: IProxyContext, public settings: IProxySettings) {
    this.util = new ProxyUtils(ctx, settings);
    this.logger = new Logger(settings.logLevel);
  }

  public router: (req: Request, r: Response, next?: NextFunction) => void;

  public getHttpClient(): FetchClient {
    return this.util.fetch;
  }

  public async handleErrors(resp: FetchResponse): Promise<FetchResponse> {
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public async transmitResponse(r: Response, resp: FetchResponse, bodyReader?: (r: FetchResponse) => Promise<any>): Promise<void> {
    const body = bodyReader ? await bodyReader(resp) : await resp.text();
    this.logger.verbose(resp.status, body);
    r.status(resp.status);
    const ct = resp.headers.get('content-type');
    if (ct) {
      r.contentType(ct);
    }
    // Injecting ad-hoc response mapper
    if (typeof this.settings.hooks?.responseMapper === 'function') {
      try {
        resp = await this.settings.hooks.responseMapper(r.req, resp, this);
      } catch (ex) { /**/ }
    }
    r.send(body);
  }

  public async transmitResponseStream(r: Response, resp: FetchResponse): Promise<void> {
    this.logger.verbose(resp.statusText, '[ stream ]', resp.size);
    r.status(resp.status);
    const ct = resp.headers.get('content-type');
    if (ct) {
      r.contentType(ct);
    }
    // Injecting ad-hoc response mapper
    if (typeof this.settings.hooks?.responseMapper === 'function') {
      try {
        resp = await this.settings.hooks.responseMapper(r.req, resp, this);
      } catch (ex) { /**/ }
    }
    resp.body.pipe(r);
  }

  public transmitError(r: Response, err: FetchError): void {
    const { status, statusText, body, response } = err;

    if (status) {
      this.logger.error('Error', { status, statusText, body });
    } else {
      this.logger.error('Error', err);
    }

    const message = (err as unknown as { message: string }).message;

    r.status(status || 400);
    if (response) {
      r.contentType(response.headers.get('content-type'));
    }
    r.send(
      body ||
      statusText ||
      (message && `Proxy Error: ${message} (see more in sp-rest-proxy console)`) ||
      'Unknown error'
    );
  }

}
