import * as parseArgs from 'minimist';

import RestProxy, { IProxySettings } from '../../src/RestProxy';

const argv = parseArgs(process.argv.slice(2));

const settings: IProxySettings = {
  configPath: argv.p || './config/private.json',
  staticRoot: './test/manual/static',
  protocol: 'http'
};

new RestProxy(settings).serve();
