const path = require('path');
const RestProxy = require(path.join(__dirname, '/index.js'));

const settings = {
    configPath: path.join(__dirname, '/../config/_private.conf.json'),
    port: 8080,
    staticRoot: path.join(__dirname, '/../src')
};

const restProxy = new RestProxy(settings);
restProxy.serve();
