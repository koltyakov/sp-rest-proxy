const cpass = new (require('cpass'))();
const cors = require('cors');
const path = require('path');
const mkdirp = require('mkdirp');
const extend = require('util')._extend;

const RestProxy = function (settings) {
    const express = require('express');
    const app = express();
    const bodyParser = require('body-parser');
    const fs = require('fs');
    const prompt = require('prompt');

    const spauth = require('node-sp-auth');
    const metadata = require(path.join(__dirname, '/../package.json'));

    // default settings
    settings.configPath = settings.configPath || path.join(__dirname, '/../config/_private.conf.json');
    settings.port = settings.port || 8080;
    settings.staticRoot = settings.staticRoot || path.join(__dirname, '/../src');
    settings.staticLibPath = settings.staticLibPath || path.join(__dirname, '/../src/lib');
    // default settings

    let _self = this;
    let configPath = settings.configPath;

    _self.spr = null;

    _self.staticLibPathExists = fs.existsSync(settings.staticLibPath);

    _self.initContext = (callback) => {
        console.log('Config path: ' + settings.configPath);
        fs.exists(configPath, (exists) => {
            let needPrompts = !exists;
            if (exists) {
                _self.ctx = require(configPath);
                if (typeof _self.ctx.password !== 'undefined') {
                    _self.ctx.password = cpass.decode(_self.ctx.password);
                }
                if (_self.ctx.password === '' || typeof _self.ctx.password === 'undefined') {
                    needPrompts = true;
                    if (typeof _self.ctx.clientId !== 'undefined' && typeof _self.ctx.clientSecret !== 'undefined') {
                        needPrompts = false;
                    }
                }
                if (!needPrompts) {
                    if (callback && typeof callback === 'function') {
                        return callback();
                    }
                }
            }
            if (needPrompts) {
                let promptFor = [];
                promptFor.push({
                    description: 'SharePoint Site Url',
                    name: 'siteUrl',
                    type: 'string',
                    required: true
                });
                promptFor.push({
                    description: 'Domain (for On-Prem only)',
                    name: 'domain',
                    type: 'string',
                    required: false
                });
                promptFor.push({
                    description: 'User login',
                    name: 'username',
                    type: 'string',
                    required: true
                });
                promptFor.push({
                    description: 'Password',
                    name: 'password',
                    type: 'string',
                    hidden: true,
                    replace: '*',
                    required: true
                });
                promptFor.push({
                    description: 'Do you want to save config to disk?',
                    name: 'save',
                    type: 'boolean',
                    default: true,
                    required: true
                });
                prompt.start();
                prompt.get(promptFor, (err, res) => {
                    if (err) {
                        console.log(err);
                    }
                    let json = {};
                    json.siteUrl = res.siteUrl;
                    json.username = res.username;
                    json.password = cpass.encode(res.password);
                    if (res.domain.length > 0) {
                        json.domain = res.domain;
                    }
                    _self.ctx = extend({}, json);
                    if (res.save) {
                        let saveFolderPath = path.dirname(configPath);
                        mkdirp(saveFolderPath, function (err) {
                            if (err) {
                                console.log('Error creating folder ' + '`' + saveFolderPath + ' `', err);
                            };
                            fs.writeFile(configPath, JSON.stringify(json, null, 2), 'utf8', (err) => {
                                if (err) {
                                    console.log(err);
                                    return;
                                }
                                console.log('Config file is saved to ' + configPath);
                            });
                            console.log('Please check readme for additional auth methods: https://github.com/koltyakov/sp-rest-proxy');
                        });
                    }
                    if (typeof _self.ctx.password !== 'undefined') {
                        _self.ctx.password = cpass.decode(_self.ctx.password);
                    }
                    if (callback && typeof callback === 'function') {
                        return callback();
                    }
                });
            }
        });
    };

    _self.port = process.env.PORT || settings.port;
    _self.routers = {
        apiRestRouter: express.Router(),
        apiSoapRouter: express.Router(),
        staticRouter: express.Router()
    };

    const getAuthOptions = (callback) => {
        spauth.getAuth(_self.ctx.siteUrl, _self.ctx)
            .then((options) => {
                if (callback && typeof callback === 'function') {
                    callback(options);
                }
            });
    };

    const getCachedRequest = (spr) => {
        spr = spr || require('sp-request').create(_self.ctx);
        return spr;
    };

    const buildEndpointUrl = (reqUrl) => {
        const url = require('url');
        let siteUrlParsed = url.parse(_self.ctx.siteUrl);
        let reqPathName = '';
        if (reqUrl.indexOf(siteUrlParsed.pathname) === 0) {
            reqPathName = reqUrl;
        } else {
            reqPathName = (`${siteUrlParsed.pathname}/${reqUrl}`).replace(/\/\//g, '/');
        }
        return `${siteUrlParsed.protocol}//${siteUrlParsed.host}${reqPathName}`;
    };

    _self.routers.apiRestRouter.get('/*', (req, res) => {
        let endpointUrl = buildEndpointUrl(req.originalUrl);
        _self.spr = getCachedRequest(_self.spr);

        console.log('\nGET: ' + endpointUrl); // _self.ctx.siteUrl + req.originalUrl);

        let requestHeadersPass = {
            'accept': 'application/json; odata=verbose',
            'content-type': 'application/json; odata=verbose'
        };

        let ignoreHeaders = [ 'host', 'referer', 'if-none-match', 'connection',
            'cache-control', 'cache-control', 'user-agent',
            'accept-encoding', 'x-requested-with', 'accept-language' ];

        Object.keys(req.headers).forEach((prop) => {
            if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                if (prop.toLowerCase() === 'accept' && requestHeadersPass[prop.toLowerCase()] === '*/*') {
                    requestHeadersPass[prop.toLowerCase()] = 'application/json; odata=verbose';
                }
            }
        });

        _self.spr.get(endpointUrl, {
            headers: requestHeadersPass
        })
            .then((response) => {
                res.status(response.statusCode);
                res.json(response.body);
            })
            .catch((err) => {
                res.status(err.statusCode >= 100 && err.statusCode < 600 ? err.statusCode : 500);
                res.send(err.message);
            });
    });

    _self.routers.apiRestRouter.post('/*', (req, res) => {
        let endpointUrl = buildEndpointUrl(req.originalUrl);
        console.log('\nPOST: ' + endpointUrl); // _self.ctx.siteUrl + req.originalUrl

        let reqBody = '';

        let processPostRequest = (reqBody, req, res) => {
            let endpointUrl = buildEndpointUrl(req.originalUrl);
            console.log('Request body:', reqBody);

            _self.spr = getCachedRequest(_self.spr);

            _self.spr.requestDigest((endpointUrl).split('/_api')[0])
                .then((digest) => {
                    let requestHeadersPass = {
                        'accept': 'application/json; odata=verbose',
                        'content-type': 'application/json; odata=verbose'
                    };

                    let ignoreHeaders = [ 'host', 'referer', 'if-none-match',
                        'connection', 'cache-control', 'cache-control',
                        'user-agent', 'accept-encoding', 'accept-language',
                        'accept', 'content-type' ];

                    Object.keys(req.headers).forEach((prop) => {
                        if (ignoreHeaders.indexOf(prop.toLowerCase()) === -1) {
                            requestHeadersPass[prop.toLowerCase()] = req.headers[prop];
                        }
                    });

                    requestHeadersPass['X-RequestDigest'] = digest;

                    try {
                        requestHeadersPass['content-length'] = JSON.stringify(reqBody).length;
                    } catch (ex) {}

                    return _self.spr.post(endpointUrl, {
                        headers: requestHeadersPass,
                        body: reqBody
                    });
                })
                .then((response) => {
                    res.status(response.statusCode);
                    res.json(response.body);
                })
                .catch((err) => {
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
            req.on('data', (chunk) => {
                reqBody += chunk;
            });
            req.on('end', () => {
                try {
                    reqBody = JSON.parse(reqBody);
                } catch (ex) {}
                processPostRequest(reqBody, req, res);
            });
        }
    });

    _self.routers.apiSoapRouter.post('/*', (req, res, next) => {
        let endpointUrl = buildEndpointUrl(req.originalUrl);
        _self.spr = getCachedRequest(_self.spr);

        console.log('\nPOST: ' + endpointUrl); // _self.ctx.siteUrl + req.originalUrl

        let regExpOrigin = new RegExp(req.headers.origin, 'g');
        let soapBody = '';
        req.on('data', (chunk) => {
            soapBody += chunk;
        });
        req.on('end', () => {
            soapBody = soapBody.replace(regExpOrigin, _self.ctx.siteUrl);

            getAuthOptions((opt) => {
                let headers = opt.headers;

                headers['Accept'] = 'application/xml, text/xml, */*; q=0.01';
                headers['Content-Type'] = 'text/xml;charset="UTF-8"';
                headers['X-Requested-With'] = 'XMLHttpRequest';
                headers['Content-Length'] = soapBody.length;

                _self.spr.post(endpointUrl, {
                    headers: headers,
                    body: soapBody,
                    json: false
                })
                    .then((response) => {
                        res.send(response);
                        res.end();
                    })
                    .catch((err) => {
                        res.status(err.statusCode);
                        res.json(err);
                    });
            });
        });
    });

    _self.routers.staticRouter.get('/*', (req, res) => {
        let url = '';
        if (_self.staticLibPathExists) {
            url = '/static/index.html';
        } else {
            url = '/static/index_cdn.html';
        }
        if (req.url !== '/') {
            url = req.url;
        } else {
            let pageContent = String(fs.readFileSync(path.join(settings.staticRoot, url)));
            pageContent = pageContent.replace('##proxyVersion#', metadata.version);
            res.send(pageContent);
            return;
        }
        if (req.url === '/config') {
            let response = {
                siteUrl: _self.ctx.siteUrl,
                username: _self.ctx.username
            };
            res.json(response);
            return;
        }
        res.sendFile(path.join(settings.staticRoot, url));
    });

    _self.serve = () => {
        _self.initContext(() => {
            app.use(bodyParser.urlencoded({ extended: true }));
            app.use(bodyParser.json());
            app.use(cors());
            app.use('*/_api', _self.routers.apiRestRouter);
            app.use('*/_vti_bin', _self.routers.apiSoapRouter);
            app.use('/', _self.routers.staticRouter);
            app.listen(_self.port);
            console.log('SharePoint REST Proxy has been started on port ' + _self.port);
        });
    };

    return _self;
};

module.exports = RestProxy;
