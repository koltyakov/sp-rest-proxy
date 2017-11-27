const CertificateStore = require('@microsoft/gulp-core-build-serve/lib/CertificateStore');
const RestProxy = require('sp-rest-proxy');

const settings = {
  configPath: './config/private.json',
  port: 4323,
  protocol: 'https',
  ssl: {
    cert: CertificateStore.default.instance.certificateData,
    key: CertificateStore.default.instance.keyData
  }
};

const restProxy = new RestProxy(settings);
restProxy.serve();