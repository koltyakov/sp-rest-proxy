import { Request, Response } from 'express';

import { BasicRouter } from '../BasicRouter';
import { getHeaders } from '../../utils/headers';

import { IProxyContext, IProxySettings } from '../interfaces';

// These are actually mostly never used in SharePoint REST API
// yet, recently, in SPO some methods support seems to be introducing

export class RestDeleteRouter extends BasicRouter {

  constructor(context: IProxyContext, settings: IProxySettings) {
    super(context, settings);
  }

  public router = (req: Request, res: Response): void => {
    const endpointUrl = this.url.apiEndpoint(req);
    this.logger.info('\nDELETE: ' + endpointUrl);
    // const headers = new Headers();
    const headers = getHeaders(req.headers);
    this.sp.fetch(endpointUrl, { method: 'DELETE', headers })
      .then(this.handlers.isOK)
      .then(this.handlers.response(res))
      .catch(this.handlers.error(res));
  }
}

// export class RestPutRouter extends BasicRouter {

//   constructor(context: IProxyContext, settings: IProxySettings) {
//     super(context, settings);
//   }

//   public router = (request: Request, response: Response): void => {
//     const endpointUrl = this.url.apiEndpoint(request);
//     this.logger.info('\nPUT: ' + endpointUrl);
//     let reqBody = '';
//     if (request.body) {
//       reqBody = request.body;
//       this.processRequest(reqBody, request, response);
//     } else {
//       request.on('data', (chunk) => reqBody += chunk);
//       request.on('end', () => this.processRequest(reqBody, request, response));
//     }
//   }

//   public processRequest = (body: BodyInit, req: Request, res: Response): void => {
//     const endpointUrl = this.url.apiEndpoint(req);
//     this.logger.info('\nPUT: ' + endpointUrl);
//     // const headers = new Headers();
//     const headers = getHeaders(req.headers);
//     this.sp.fetch(endpointUrl, { method: 'PUT', headers, body: JSON.stringify(body) })
//       .then(this.handlers.isOK)
//       .then(this.handlers.response(res))
//       .catch(this.handlers.error(res));
//   }
// }

// export class RestPatchRouter extends BasicRouter {

//   constructor(context: IProxyContext, settings: IProxySettings) {
//     super(context, settings);
//   }

//   public router = (request: Request, response: Response): void => {
//     const endpointUrl = this.url.apiEndpoint(request);
//     this.logger.info('\nPATCH: ' + endpointUrl);
//     let reqBody = '';
//     if (request.body) {
//       reqBody = request.body;
//       this.processRequest(reqBody, request, response);
//     } else {
//       request.on('data', (chunk) => reqBody += chunk);
//       request.on('end', () => this.processRequest(reqBody, request, response));
//     }
//   }

//   public processRequest = (body: BodyInit, req: Request, res: Response): void => {
//     const endpointUrl = this.url.apiEndpoint(req);
//     this.logger.info('\nPATCH: ' + endpointUrl);
//     // const headers = new Headers();
//     const headers = getHeaders(req.headers);
//     this.sp.fetch(endpointUrl, { method: 'PATCH', headers, body: JSON.stringify(body) })
//       .then(this.handlers.isOK)
//       .then(this.handlers.response(res))
//       .catch(this.handlers.error(res));
//   }
// }