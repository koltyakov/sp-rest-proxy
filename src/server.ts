import RestProxy from './RestProxy';
import { IProxySettings } from './interfaces';

const settings: IProxySettings = {
  configPath: './config/private.json',
  port: 8080,
  protocol: 'https'
  // debugOutput: true
};

const restProxy = new RestProxy(settings);
restProxy.serve();
