import * as spauth from 'node-sp-auth';
import fetch, { RequestInit, Response, Headers } from 'node-fetch';
import * as https from 'https';
import * as http from 'http';

import { cache } from './cache';
import { mergeHeaders } from './headers';
import { IProxyContext, IProxySettings } from '../core/interfaces';

export type SPFetch = (url: string, init?: RequestInit) => Promise<Response>;
export type SPResponse = Response;

export interface FetchError {
  response: SPResponse;
  status: number;
  statusText: string;
  body?: string;
}

export interface FetchOptions extends RequestInit {
  headers?: Headers;
}

export class SPClient {

  private agent: https.Agent | http.Agent = null;

  constructor(private ctx: IProxyContext, private settings: IProxySettings) {
    this.agent = this.settings.agent;
    if (!this.agent) {
      if (ctx.siteUrl.split('://')[0].toLowerCase() === 'https') {
        this.agent = new https.Agent({
          rejectUnauthorized: false,
          keepAlive: true,
          keepAliveMsecs: 10000
        });
      } else {
        this.agent = new http.Agent({
          keepAlive: true,
          keepAliveMsecs: 10000
        });
      }
    }
  }

  public fetch = async (url: string, init: FetchOptions = {}): Promise<Response> => {
    const auth =  await spauth.getAuth(this.ctx.siteUrl, this.ctx.authOptions);
    let digest: string;
    if (init.method === 'POST') {
      try {
        // const headers = new Headers(init.headers);
        // // headers.get('X-RequestDigest');
        if (!digest && url.toLowerCase().indexOf('/_api/contextinfo') === -1) {
          digest = await this.requestDigest(url.split('/_api')[0].split('/_vti_bin')[0]);
        }
      } catch(ex) { /**/ }
    }
    const opts: FetchOptions = {
      agent: this.agent,
      ...init,
      ...auth.options || {},
      headers: mergeHeaders(
        init?.headers,
        new Headers(auth.headers),
        new Headers({ 'X-RequestDigest': digest })
      )
    };
    return fetch(url, opts);
  }

  public requestDigest = (webUrl: string): Promise<string> => {
    const d = cache.get(`${webUrl}:digest`);
    if (d) {
      return Promise.resolve(d);
    }
    return this.fetch(`${webUrl}/_api/contextinfo`, {
      method: 'POST',
      headers: new Headers({
        Accept: 'application/json;odata=verbose'
      })
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error(r.statusText);
        }
        return r.json();
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((r: any) => {
        const digest = r.d.GetContextWebInformation.FormDigestValue as string;
        const ttl = parseInt(r.d.GetContextWebInformation.FormDigestTimeoutSeconds, 10);
        cache.set(`${webUrl}:digest`, digest, ttl - 30 * 1000);
        return digest;
      });
  }

}
