import RestProxy from '../../src/RestProxy';

(new RestProxy({
  configPath: './config/private.json',
  staticRoot: './test/manual/static',
  protocol: 'http'
})).serve();
