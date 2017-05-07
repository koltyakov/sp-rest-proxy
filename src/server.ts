import * as path from 'path';

import RestProxy from './index';
import { IProxySettings } from './interfaces';

const settings: IProxySettings = {
    configPath: path.join(__dirname, '/../config/private.json'),
    staticRoot: path.join(__dirname, '/../')
};

(new RestProxy(settings)).serve();
