import RestProxy from './core/RestProxy';
import { logger } from './utils/logger';
import { IProxySettings } from './core/interfaces';

const settings: IProxySettings = {
  configPath: './config/private.json',
  port: 8080
};

if (process.env.HTTP_PROXY || process.env.HTTPS_PROXY) {
  logger.error('Your Node.js environment is configured to use a network proxy.');
}

const restProxy = new RestProxy(settings);
restProxy.serve();
