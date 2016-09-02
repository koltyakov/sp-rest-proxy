// npm run serve

var spf = spf || {};
spf.restProxy = function() {
    var express = require("express");
    var app = express();
    var bodyParser = require("body-parser");
    var fs = require("fs");
    var sprequest = require("sp-request");
    var prompt = require("prompt");

    var _self = this;

    var configPath = "./../config/_private.conf.json";

    _self.initContext = function(callback) {
        fs.exists(configPath.replace("./../", ""), function(exists) {
            if (exists) {
                _self.ctx = require(configPath);
                if (callback && typeof callback === "function") {
                    callback();
                }
            } else {
                var promptFor = [];
                promptFor.push({
                    description: "SharePoint Site Url",
                    name: "siteUrl",
                    type: "string",
                    required: true
                });
                promptFor.push({
                    description: "User login",
                    name: "username",
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
                    json.password = res.password;
                    if (res.domain.length > 0) {
                        json.domain = res.domain;
                    }
                    _self.ctx = json;
                    if (res.save) {
                        fs.writeFile(configPath.replace("./../", ""), JSON.stringify(json), "utf8", function(err) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            console.log("Config file is saved to " + configPath);
                        });
                    }
                    if (callback && typeof callback === "function") {
                        callback();
                    }
                });
            }
        });
    };

    _self.spr = null;

    _self.port = process.env.PORT || 8080;
    _self.routers = {
        apiRouter: express.Router(),
        staticRouter: express.Router()
    };

    _self.getCachedRequest = function(spr) {
        var env = {};
        if (_self.ctx.hasOwnProperty("domain")) {
            env.domain = ctx.domain;
        }
        if (_self.ctx.hasOwnProperty("workstation")) {
            env.workstation = ctx.workstation;
        }
        spr = spr || require("sp-request").create(_self.ctx, env);
        return spr;
    };

    _self.routers.apiRouter.get("/*", function(req, res) {
        _self.spr = _self.getCachedRequest(_self.spr);
        console.log("GET: " + _self.ctx.siteUrl + req.originalUrl);
        _self.spr.get(_self.ctx.siteUrl + req.originalUrl)
            .then(function (response) {
                res.status(response.statusCode);
                res.json(response);
            })
            .catch(function (err) {
                res.status(err.statusCode);
                res.json(err);
            });
    });

    _self.routers.apiRouter.post("/*", function(req, res) {
        // res.json({
        //     method: req.method,
        //     headers: req.headers,
        //     url: req.url,
        //     baseUrl: req.baseUrl,
        //     body: req.body
        // });
        _self.spr = _self.getCachedRequest(_self.spr);
        console.log("POST: " + _self.ctx.siteUrl + req.originalUrl);
        _self.spr.requestDigest(_self.ctx.siteUrl)
            .then(function (digest) {
                console.log("Gigest: " + digest);
                return _self.spr.post(_self.ctx.siteUrl + req.originalUrl, {
                    headers: {
                        "X-RequestDigest": digest,
                        "accept": "application/json; odata=verbose",
                    },
                });
            })
            .then(function (response) {
                res.status(response.statusCode);
                res.json(response);
            })
            .catch(function (err) {
                res.status(err.statusCode);
                res.json(err);
            });
    });

    _self.routers.staticRouter.get("/*", function(req, res) {
        var filename;
        var url = "/index.html";
        if (req.url !== "/") {
            url = req.url;
        }
        if (req.url === "/config") {
            var response = {
                siteUrl: _self.ctx.siteUrl,
                username: _self.ctx.username
            };
            res.json(response);
            return;
        }
        res.sendFile(__dirname + url);
    });

    _self.serve = function() {
        _self.initContext(function() {
            app.use(bodyParser.urlencoded({ extended: true }));
            app.use(bodyParser.json());
            app.use("*/_api", _self.routers.apiRouter);
            app.use("/", _self.routers.staticRouter);
            app.listen(_self.port);
            console.log("SharePoint REST Proxy has been started on port " + _self.port);
        });
    };
    return _self;
};

var restProxy = new spf.restProxy();
restProxy.serve();