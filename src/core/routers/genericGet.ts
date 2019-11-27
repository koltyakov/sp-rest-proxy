import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request';
import { Request, Response, NextFunction } from 'express';

import { BasicRouter } from '../BasicRouter';
import { IProxyContext, IProxySettings } from '../interfaces';

export class GetRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response, _next?: NextFunction) => {
    // Route local proxy resources (web app)
    if (this.serveLocalResources(req, res)) {
      return;
    }
    this.spr = this.getHttpClient();
    let endpointUrl = this.util.buildEndpointUrl(req);
    this.logger.info('\nGET (generic): ' + endpointUrl);
    const agent = this.util.isUrlHttps(endpointUrl) ? this.settings.agent : undefined;
    const headers: any = {};
    const ignoreHeaders = [ 'host', 'referer', 'origin', 'accept-encoding', 'connection', 'if-none-match' ];
    Object.keys(req.headers).forEach(prop => {
      if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
        if (prop.toLowerCase() === 'accept' && req.headers[prop] !== '*/*') {
          headers.Accept = req.headers[prop];
        } else if (prop.toLowerCase() === 'content-type') {
          headers['Content-Type'] = req.headers[prop];
        } else {
          headers[prop] = req.headers[prop];
        }
      }
    });
    // this.logger.debug('\nHeaders:', JSON.stringify(requestHeadersPass, null, 2));
    const advanced: any = {
      json: false,
      processData: false,
      encoding: null
    };

    // Static resources from SharePoint >>
    const ext = endpointUrl.split('?')[0].split('.').pop().toLowerCase();
    if (['js', 'css', 'aspx', 'css', 'html', 'json', 'axd'].indexOf(ext) !== -1) {
      delete advanced.encoding;
      headers.Accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
    }
    if (endpointUrl.indexOf('/ScriptResource.axd') !== -1) {
      const axdUrlArr = endpointUrl.split('/ScriptResource.axd');
      endpointUrl = `${axdUrlArr[0].split('/').splice(0, 3).join('/')}/ScriptResource.axd${axdUrlArr[1]}`;
      request.get({ uri: endpointUrl, agent }).pipe(res);
      return;
    }
    // Static resources from SharePoint <<

    this.spr.get(endpointUrl, { headers, ...advanced, agent })
      .then(r => this.transmitResponse(res, r))
      .catch(err => this.transmitError(res, err));
  }

  private serveLocalResources(req: Request, res: Response): boolean {
    let staticIndexUrl = '/index.html';
    if (req.url !== '/') {
      staticIndexUrl = req.url.split('?')[0];
    } else {
      let pageContent = String(fs.readFileSync(path.join(this.settings.staticRoot, staticIndexUrl)));
      pageContent = pageContent.replace('##proxyVersion#', this.settings.metadata.version);
      res.send(pageContent);
      return true;
    }
    if (req.url === '/config') {
      const response = {
        siteUrl: this.ctx.siteUrl,
        username: (this.ctx.authOptions as any).username || 'Add-In'
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
