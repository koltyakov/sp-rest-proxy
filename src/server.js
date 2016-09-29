// npm run serve
var RestProxy = require(__dirname + "/index.js");

var settings = {
    configPath: __dirname + "/../config/_private.conf.json",
    port: 8080,
    staticRoot: __dirname + "/../src"
};

var restProxy = new RestProxy(settings);
restProxy.serve();