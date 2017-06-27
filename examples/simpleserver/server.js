const RestProxy = require('sp-rest-proxy');

const argv = require('minimist')(process.argv.slice(2));
const conf = argv.conf;

(new RestProxy({
    configPath: conf || './config/private.json',
    staticRoot: './static',
    rawBodyLimitSize: '4MB'
})).serve();