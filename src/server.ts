import RestProxy from './RestProxy';

const settings = {
  configPath: './config/private.json',
  port: 8080
  // debugOutput: true
};

const restProxy = new RestProxy(settings);
restProxy.serve();
