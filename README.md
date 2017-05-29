# sp-rest-proxy - SharePoint REST API Proxy for Node.js and Express local serve

[![NPM](https://nodei.co/npm/sp-rest-proxy.png?mini=true&downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/sp-rest-proxy/)

[![npm version](https://badge.fury.io/js/sp-rest-proxy.svg)](https://badge.fury.io/js/sp-rest-proxy)
[![Downloads](https://img.shields.io/npm/dm/sp-rest-proxy.svg)](https://www.npmjs.com/package/sp-rest-proxy)

Allows to perform API calls to local Express application with forwarding the queries to a remote SharePoint instance.

This concept was created to show how is could be easy to implements real world data communications for SharePoint Framework local serve mode during web parts debug without deployment to SharePoint tenant.

## Supported SharePoint versions
- SharePoint Online
- SharePoint 2013
- SharePoint 2016

## Support proxying
- REST API
- CSOM requests
- SOAP web services
- Static resources

## Proxy modes
- API Proxy server
- Socket gateway server
- Socket gateway client

Socket proxying allows to forward API from behind NAT (experimental).

## How to use as a module

1\. Install NPM module in the project:

```bash
npm install --save-dev sp-rest-proxy
```

or

```bash
yarn add sp-rest-proxy --dev
```

2\. Create server.js with the following code:

```javascript
const RestProxy = require('sp-rest-proxy');

const settings = {
    configPath: './config/_private.conf.json', // Location for SharePoint instance mapping and credentials
    port: 8080,                                // Local server port
    staticRoot: './static'                     // Root folder for static content
};

const restProxy = new RestProxy(settings);
restProxy.serve();
```

[Configuration parameters cheatsheet](https://github.com/koltyakov/sp-rest-proxy/tree/master/docs/authparameters.md)

3\. Add npm task for serve into package.json:

```json
"scripts": {
    "serve": "node ./server.js"
}
```

Check if the path to server.js is correct.

4\. Run `npm run serve`.

5\. Provide SharePoint configuration parameters.

6\. Test local API proxy in action.

## How to develop

### Install

1\. Clone/fork the project:

```bash
git clone https://github.com/koltyakov/sp-rest-proxy
```

2\. CMD to the project folder.

3\. Install dependencies:

```bash
npm install
```

or

```bash
yarn install
```

4\. Build:

```bash
npm run build
```

5\. Run the server:

```bash
npm run serve
```

or serve in TypeScript directly

```bash
npm run ts-serve
```

Prompts credentials for a SharePoint site.

6\. Navigate to http://localhost:8080 (or whatever in settings)

7\. Ajax REST calls as if you were in SharePoint site page context:

![REST Client Example](./docs/img/client-example.png)

8\. Tests.

```bash
npm run test
```

![Tests Example](./docs/img/tests-example.png)

## Authentication settings

The proxy provides wizard-like approach for building and managing config files for [`node-sp-auth`](https://github.com/s-KaiNet/node-sp-auth) (Node.js to SharePoint unattended http authentication).

- SharePoint 2013, 2016:
  - Addin only permissions
  - User credentials through the http ntlm handshake
  - Form-based authentication (FBA)
- SharePoint Online:
  - Addin only permissions
  - SAML based with user credentials
  - ADFS user credentials (works with both SharePoint on-premise and Online)

For more information please check node-sp-auth [credential options](https://github.com/s-KaiNet/node-sp-auth#params) and [wiki pages](https://github.com/s-KaiNet/node-sp-auth/wiki).
Auth settings are stored inside `./config/private.json`.

## Some additional info

sp-rest-proxy works with PnP JS Core (not POST request, as there is an endpoint transformation during POST request in PnP JS Core):

![PnP JS Core + sp-rest-proxy](http://koltyakov.ru/images/pnp-sp-rest-proxy.png)

## Use cases

- Client side applications development with local serve, but real data from SharePoint
- SharePoint Framework in local workbench with real data
- Client applications integration test automation scenarios