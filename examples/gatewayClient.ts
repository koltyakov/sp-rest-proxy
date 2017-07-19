/**
 * Serves proxy gateway slient mode
 * Client <--HTTP==> Gateway Server <==Sockets==> **Gateway Client** <--HTTP==> SharePoint API
 */

import RestProxy from '../src/RestProxy';

(new RestProxy({
    configPath: './config/private.json'
})).serveClient({
    serverUrl: 'http://localhost:9867'
});
