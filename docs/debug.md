# Proxy to SharePoint Fiddler debug

## Navigate to project folder

## Add environment variables

```bash
set https_proxy=http://127.0.0.1:8888
set http_proxy=http://127.0.0.1:8888
set NODE_TLS_REJECT_UNAUTHORIZED=0
```

## Run proxy

```bash
npm run ts-serve
```

## Enable non-browsers processes and start capture the traffic in Fiddler