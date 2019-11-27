import * as parseArgs from 'minimist';

import RestProxy, { IProxySettings } from '../../src/core/RestProxy';
import { LogLevel } from '../../src/utils/logger';

const argv = parseArgs(process.argv.slice(2));

// To test with Fidler uncomment following lines:
// process.env.http_proxy = 'http://127.0.0.1:8888';
// process.env.https_proxy = 'http://127.0.0.1:8888';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const settings: IProxySettings = {
  configPath: argv.p || './config/private.json',
  staticRoot: './test/manual/static',
  logLevel: LogLevel.Error,
  // protocol: 'https',
  // hostname: '10.42.7.50',
  // port: 3777
  hooks: {
    responseMapper: (req, res, router) => {
      if (req.method === 'POST') {
        if (req.originalUrl.toLowerCase().indexOf('/files/add') !== -1) {
          const body = JSON.parse(res.body);
          if (typeof body.d.ListItemAllFields.__deferred.uri === 'string') {
            body.d.ListItemAllFields.__deferred.uri = router.util.buildProxyEndpointUrl(body.d.ListItemAllFields.__deferred.uri);
          }
          res.body = JSON.stringify(body);
        }
      }
      return res;
    }
  }
};

new RestProxy(settings).serve();
