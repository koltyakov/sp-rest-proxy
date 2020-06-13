// eslint-disable-next-line @typescript-eslint/no-var-requires
const RestProxy = require('sp-rest-proxy');

const settings = {
  configPath: './config/private.json',
  hostname: '0.0.0.0',
  port: 8080
};

const restProxy = new RestProxy(settings);
restProxy.serve();
