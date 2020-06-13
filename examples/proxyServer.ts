/**
 * Serves proxy standard mode
 * Client <--HTTP==> **REST Proxy** <--HTTP==> SharePoint API
 */

import RestProxy from '../src/RestProxy';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const argv = require('minimist')(process.argv.slice(2));
const conf = argv.conf;

(new RestProxy({
  configPath: conf || './config/private.json',
  staticRoot: './static',
  rawBodyLimitSize: '4MB'
})).serve();

// ts-node ./examples/proxyServer --conf='./config/integration/private.2013.json'
