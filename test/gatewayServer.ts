import * as path from 'path';
const RestProxy = require('../src/index');

import { IProxySettings } from '../src/interfaces';
import { IGatewayServerSettings } from '../src/interfaces';

const settings: IProxySettings = {
    configPath: path.join(__dirname, '/../config/private.json')
};

const proxy = new RestProxy(settings);
proxy.serveGateway(<IGatewayServerSettings>{
    port: 9867
});
