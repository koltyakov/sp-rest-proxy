import RestProxy from '../../src/RestProxy';

(new RestProxy({
  configPath: './config/private.json',
  staticRoot: './test/manual/static',
  rawBodyLimitSize: '4MB',
  protocol: 'https'
})).serve();
