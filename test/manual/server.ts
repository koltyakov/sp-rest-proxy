import * as parseArgs from 'minimist';

import RestProxy, { IProxySettings } from '../../src/RestProxy';

const argv = parseArgs(process.argv.slice(2));

// process.env.http_proxy = 'http://127.0.0.1:8888';
// process.env.https_proxy = 'http://127.0.0.1:8888';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const settings: IProxySettings = {
  configPath: argv.p || './config/private.wcf.json',
  staticRoot: './test/manual/static',
  debugOutput: true
  // protocol: 'https'
};

new RestProxy(settings).serve();
