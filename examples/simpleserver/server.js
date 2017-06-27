const RestProxy = require('sp-rest-proxy');

(new RestProxy({
    configPath: './config/private.json',
    staticRoot: './static',
    rawBodyLimitSize: '4MB'
})).serve();