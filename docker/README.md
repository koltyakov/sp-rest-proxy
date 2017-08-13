# SharePoint REST Proxy for Docker

## Build image

```bash
docker build -t sp-rest-proxy .
```

## Create container

```bash
docker run -p 9090:8080 --name=sharepoint --hostname=localhost -it sp-rest-proxy node ./server
```

### Provide SharePoint connection settings

The interactive console starts on the command.
Provide SharePoint connection with credentials.

Credentials settings are saved to './config/private.json'.

## Proxy is running on

[http://localhost:9090](http://localhost:9090)