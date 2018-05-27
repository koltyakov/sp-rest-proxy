import RestProxy from '../../src/RestProxy';

(new RestProxy({
  configPath: './config/integration/private.2013.json',
  staticRoot: './test/manual/static',
  protocol: 'http'
})).serve();
