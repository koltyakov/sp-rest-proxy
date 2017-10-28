import RestProxy from './RestProxy';

const settings = {
  configPath: './config/private.json',
  port: 8080
};

const restProxy = new RestProxy(settings);
restProxy.serve();
