import * as path from 'path';
const RestProxy = require('../src/index');

import { IProxySettings } from '../src/interfaces';
import { IGatewayClientSettings } from '../src/interfaces';

const settings: IProxySettings = {
    configPath: path.join(__dirname, '/../config/private.json')
};

const proxy = new RestProxy(settings);
proxy.serveClient(<IGatewayClientSettings>{
    serverUrl: 'http://localhost:9867'
});
