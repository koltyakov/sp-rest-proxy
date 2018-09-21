const CertStore = require('@microsoft/gulp-core-build-serve/lib/CertificateStore');
const RestProxy = require('sp-rest-proxy');

const CertificateStore = CertStore.CertificateStore || CertStore.default;

const settings = {
  configPath: './config/private.json',
  port: 4323,
  protocol: 'https',
  ssl: {
    cert: CertificateStore.instance.certificateData,
    key: CertificateStore.instance.keyData
  }
};

const restProxy = new RestProxy(settings);
restProxy.serve();