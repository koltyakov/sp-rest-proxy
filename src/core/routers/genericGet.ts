import * as fs from 'fs';
import * as path from 'path';
import { Request, Response } from 'express';
import { Headers, RequestInit } from 'node-fetch';

import { BasicRouter } from '../BasicRouter';
import { FetchClient } from '../../utils/proxy';
import { IProxyContext, IProxySettings } from '../interfaces';

export class GetRouter extends BasicRouter {

  private fetch: FetchClient;

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
    this.fetch = this.getHttpClient();
  }

  public router = (req: Request, res: Response): void => {
    // Route local proxy resources (web app)
    if (this.serveLocalResources(req, res)) {
      return;
    }
    let endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nGET (generic): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const headers = new Headers();
    const ignoreHeaders = [ 'host', 'referer', 'origin', 'accept-encoding', 'connection', 'if-none-match' ];
    Object.keys(req.headers).forEach((prop) => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.set('Accept', this.util.reqHeader(req.headers, prop));
        } else if (prop.toLowerCase() === 'content-type') {
          headers.set('Content-Type', this.util.reqHeader(req.headers, prop));
        } else {
          headers.set(prop, this.util.reqHeader(req.headers, prop));
        }
      }
    });
    // this.logger.debug('\nHeaders:', JSON.stringify(requestHeadersPass, null, 2));
    const advanced: Partial<RequestInit> = {
      // json: false,
      // processData: false,
      // encoding: null,
    };

    // Static resources from SharePoint >>
    const ext = endpointUrl.split('?')[0].split('.').pop().toLowerCase();
    if (['js', 'css', 'aspx', 'css', 'html', 'json', 'axd'].indexOf(ext) !== -1) {
      // delete advanced.encoding;
      headers.set('accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    }
    if (endpointUrl.indexOf('/ScriptResource.axd') !== -1) {
      const axdUrlArr = endpointUrl.split('/ScriptResource.axd');
      endpointUrl = `${axdUrlArr[0].split('/').splice(0, 3).join('/')}/ScriptResource.axd${axdUrlArr[1]}`;
      // request.get({ uri: endpointUrl, agent }).pipe(res);
      this.fetch(endpointUrl, { headers, agent })
        .then(this.handleErrors)
        .then((resp) => this.transmitResponseStream(res, resp))
        .catch((err) => this.transmitError(res, err));
      return;
    }
    // Static resources from SharePoint <<

    // this.spr.get(endpointUrl, { headers, ...advanced, agent })
    //   .then((r) => this.transmitResponse(res, r))
    //   .catch((err) => this.transmitError(res, err));
    this.fetch(endpointUrl, { headers, agent, ...advanced })
      .then(this.handleErrors)
      .then((resp) => this.transmitResponse(res, resp))
      .catch((err) => this.transmitError(res, err));
  }

  private serveLocalResources(req: Request, res: Response): boolean {
    let staticIndexUrl = '/index.html';
    if (req.url !== '/') {
      staticIndexUrl = req.url.split('?')[0];
    } else {
      let pageContent = String(fs.readFileSync(path.join(this.settings.staticRoot, staticIndexUrl)));
      pageContent = pageContent.replace('##proxyVersion#', (this.settings.metadata as { version: string }).version);
      res.send(pageContent);
      return true;
    }
    if (req.url === '/config') {
      const response = {
        siteUrl: this.ctx.siteUrl,
        username: (this.ctx.authOptions as unknown as { username?: string }).username || 'Add-In'
      };
      res.json(response);
      return true;
    }
    if (fs.existsSync(path.join(this.settings.staticRoot, staticIndexUrl))) {
      res.sendFile(path.join(this.settings.staticRoot, staticIndexUrl));
      return true;
    }
    return false;
  }

}
