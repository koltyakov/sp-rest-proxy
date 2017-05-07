import * as path from 'path';
import { RestProxy } from './index';

const settings = {
    configPath: path.join(__dirname, '/../config/_private.conf.json'),
    port: 8080,
    staticRoot: path.join(__dirname, '/../')
};

const restProxy = new RestProxy(settings);
restProxy.serve();
