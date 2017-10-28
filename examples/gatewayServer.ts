/**
 * Serves proxy gateway server mode
 * Client <--HTTP==> **Gateway Server** <==Sockets==> Gateway Client <--HTTP==> SharePoint API
 */

import RestProxy from '../src/RestProxy';

(new RestProxy({
  configPath: './config/private.json'
})).serveGateway({
  port: 9867
});
