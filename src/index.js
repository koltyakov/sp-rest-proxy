var cpass = new (require("cpass"));
var cors = require("cors");
var path = require('path');
var mkdirp = require('mkdirp');

var spf = spf || {};
spf.restProxy = function(settings) {
    var express = require("express");
    var app = express();
    var bodyParser = require("body-parser");
    var fs = require("fs");
    var sprequest = require("sp-request");
    var prompt = require("prompt");

    var spauth = require('node-sp-auth');
    var request = require('request-promise');
    var metadata = require(path.join(__dirname, "/..", "/package.json"));

    // default settings
    settings.configPath = path.join(settings.configPath || __dirname + "/../config/_private.conf.json");
    settings.port = settings.port || 8080;
    settings.staticRoot = path.join(settings.staticRoot || __dirname + "/../src");
    settings.staticLibPath = path.join(settings.staticLibPath || __dirname + "/../src/lib");
    // default settings

    var _self = this;

    var configPath = settings.configPath;

    _self.staticLibPathExists = fs.existsSync(settings.staticLibPath);

    _self.initContext = function(callback) {
        console.log("Config path: " + settings.configPath);
        fs.exists(configPath, function(exists) {
            var needPrompts = !exists;
            if (exists) {
                _self.ctx = require(configPath);
                if (typeof _self.ctx.password !== "undefined") {
                    _self.ctx.password = cpass.decode(_self.ctx.password);
                }
                if (_self.ctx.password === "" || typeof _self.ctx.password === "undefined") {
                    needPrompts = true;
                    if (typeof _self.ctx.clientId !== "undefined" && typeof _self.ctx.clientSecret !== "undefined") {
                        needPrompts = false;
                    }
                }
                if (!needPrompts) {
                    if (callback && typeof callback === "function") {
                        callback();
                    }
                }
            }
            if (needPrompts) {
                var promptFor = [];
                promptFor.push({
                    description: "SharePoint Site Url",
                    name: "siteUrl",
                    type: "string",
                    required: true
                });
                promptFor.push({
                    description: "Domain (for On-Prem only)",
                    name: "domain",
                    type: "string",
                    required: false
                });
                promptFor.push({
                    description: "User login",
                    name: "username",
                    type: "string",
                    required: true
                });
                promptFor.push({
                    description: "Password",
                    name: "password",
                    type: "string",
                    hidden: true,
                    replace: "*",
                    required: true
                });
                promptFor.push({
                    description: "Do you want to save config to disk?",
                    name: "save",
                    type: "boolean",
                    default: true,
                    required: true
                });
                prompt.start();
                prompt.get(promptFor, function (err, res) {
                    var json = {};
                    json.siteUrl = res.siteUrl;
                    json.username = res.username;
                    json.password = cpass.encode(res.password);
                    if (res.domain.length > 0) {
                        json.domain = res.domain;
                    }
                    _self.ctx = json;
                    if (res.save) {
                        var saveFolderPath = path.dirname(configPath);
                        mkdirp(saveFolderPath, function(err) {
                            if (err) {
                                console.log("Error creating folder " + "`" + saveFolderPath + " `", err);
                            };
                            fs.writeFile(configPath, JSON.stringify(json, null, 2), "utf8", function(err) {
                                if (err) {
                                    console.log(err);
                                    return;
                                }
                                console.log("Config file is saved to " + configPath);
                            });
                            console.log("Please check readme for additional auth methods: https://github.com/koltyakov/sp-rest-proxy");
                        });
                    }
                    if (typeof _self.ctx.password !== "undefined") {
                        _self.ctx.password = cpass.decode(_self.ctx.password);
                    }
                    if (callback && typeof callback === "function") {
                        callback();
                    }
                });
            }
        });
    };

    _self.spr = null;

    _self.port = process.env.PORT || settings.port;
    _self.routers = {
        apiRestRouter: express.Router(),
        apiSoapRouter: express.Router(),
        staticRouter: express.Router()
    };

    _self.getAuthOptions = function(callback) {
        spauth.getAuth(_self.ctx.siteUrl, _self.ctx)
            .then(function(options) {
                if (callback && typeof callback === "function") {
                    callback(options);
                }
            });
    };

    _self.getCachedRequest = function(spr) {
        spr = spr || require("sp-request").create(_self.ctx);
        return spr;
    };

    _self.routers.apiRestRouter.get("/*", function(req, res) {
        _self.spr = _self.getCachedRequest(_self.spr);
        console.log("GET: " + _self.ctx.siteUrl + req.originalUrl);

        var requestHeadersPass = {
            "accept": "application/json; odata=verbose",
            "content-type": "application/json; odata=verbose"
        };

        var ignoreHeaders = [ "host", "referer", "if-none-match", "connection",
                              "cache-control", "cache-control", "user-agent",
                              "accept-encoding", "x-requested-with", "accept-language" ];

        for (var prop in req.headers) {
            if (req.headers.hasOwnProperty(prop)) {
                if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                    requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                    if (prop.toLowerCase() === "accept" && requestHeadersPass[prop.toLowerCase()] === '*/*') {
                        requestHeadersPass[prop.toLowerCase()] = "application/json; odata=verbose";
                    }
                }
            }
        }

        _self.spr.get(_self.ctx.siteUrl + req.originalUrl, {
            headers: requestHeadersPass
        })
            .then(function (response) {
                res.status(response.statusCode);
                res.json(response.body);
            })
            .catch(function (err) {
                res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
                res.send(err.message);
            });
    });

    _self.routers.apiRestRouter.post("/*", function(req, res) {
        console.log("POST: " + _self.ctx.siteUrl + req.originalUrl);

        var reqBody = "";

        var processPostRequest = function(reqBody, req, res) {
            console.log("Request body:", reqBody);
            _self.spr = _self.getCachedRequest(_self.spr);

            _self.spr.requestDigest(_self.ctx.siteUrl)
                .then(function(digest) {

                    var requestHeadersPass = {
                        "accept": "application/json; odata=verbose",
                        "content-type": "application/json; odata=verbose"
                    };

                    var ignoreHeaders = [ "host", "referer", "if-none-match",
                                          "connection", "cache-control", "cache-control",
                                          "user-agent", "accept-encoding", "accept-language",
                                          "accept", "content-type" ];

                    for (var prop in req.headers) {
                        if (req.headers.hasOwnProperty(prop)) {
                            if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                                requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                            }
                        }
                    }

                    requestHeadersPass["X-RequestDigest"] = digest;

                    try {
                        requestHeadersPass["content-length"] = JSON.stringify(reqBody).length;
                    } catch (ex) {}

                    return _self.spr.post(_self.ctx.siteUrl + req.originalUrl, {
                        headers: requestHeadersPass,
                        body: reqBody
                    });
                })
                .then(function (response) {
                    res.status(response.statusCode);
                    res.json(response.body);
                })
                .catch(function (err) {
                    res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
                    res.send(err.message);
                });
        };

        if (req.body) {
            reqBody = req.body;
            try {
                reqBody = JSON.parse(reqBody);
            } catch (ex) {}
            processPostRequest(reqBody, req, res);
        } else {
            req.on('data', function (chunk) {
                reqBody += chunk;
            });
            req.on('end', function () {
                try {
                    reqBody = JSON.parse(reqBody);
                } catch (ex) {}
                processPostRequest(reqBody, req, res);
            });
        }
    });

    _self.routers.apiSoapRouter.post("/*", function(req, res, next) {
        _self.spr = _self.getCachedRequest(_self.spr);
        console.log("POST: " + _self.ctx.siteUrl + req.originalUrl);
        var regExpOrigin = new RegExp(req.headers.origin, "g");
        var soapBody = "";
        req.on('data', function (chunk) {
            soapBody += chunk;
        });
        req.on('end', function () {
            soapBody = soapBody.replace(regExpOrigin, _self.ctx.siteUrl);

            _self.getAuthOptions(function(opt) {
                var headers = opt.headers; // .Cookie - auth cookie

                headers["Accept"] = "application/xml, text/xml, */*; q=0.01";
                headers["Content-Type"] = "text/xml;charset=\"UTF-8\"";
                headers["Content-Length"] = soapBody.length;
                headers["X-Requested-With"] = "XMLHttpRequest";

                request.post({
                    url: _self.ctx.siteUrl + req.originalUrl,
                    headers: headers,
                    body: soapBody
                }).then(function(response) {
                    res.send(response);
                    res.end();
                })
                .catch(function (err) {
                    res.status(err.statusCode);
                    res.json(err);
                });
            });
        });
    });

    _self.routers.staticRouter.get("/*", function(req, res) {
        var filename;
        var url = "";
        if (_self.staticLibPathExists) {
            url = "/static/index.html";
        } else {
            url = "/static/index_cdn.html";
        }
        if (req.url !== "/") {
            url = req.url;
        } else {
            var pageContent = String(fs.readFileSync(path.join(settings.staticRoot, url)));
            pageContent = pageContent.replace('##proxyVersion#', metadata.version);
            res.send(pageContent);
            return;
        }
        if (req.url === "/config") {
            var response = {
                siteUrl: _self.ctx.siteUrl,
                username: _self.ctx.username
            };
            res.json(response);
            return;
        }
        res.sendFile(path.join(settings.staticRoot, url));
    });

    _self.serve = function() {
        _self.initContext(function() {
            app.use(bodyParser.urlencoded({ extended: true }));
            app.use(bodyParser.json());
            app.use(cors());
            app.use("*/_api", _self.routers.apiRestRouter);
            app.use("*/_vti_bin", _self.routers.apiSoapRouter);
            app.use("/", _self.routers.staticRouter);
            app.listen(_self.port);
            console.log("SharePoint REST Proxy has been started on port " + _self.port);
        });
    };
    return _self;
};

module.exports = spf.restProxy;