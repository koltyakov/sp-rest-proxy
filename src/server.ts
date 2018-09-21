import RestProxy from './RestProxy';
import { IProxySettings } from './interfaces';

const settings: IProxySettings = {
  configPath: './config/private.json',
  port: 8080,
  // protocol: 'https'
};

if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  console.log('Your Node.js environment is configured to use a network proxy.');
}

const restProxy = new RestProxy(settings);
restProxy.serve();
