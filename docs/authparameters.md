# SharePoint instance mapping and credentials

## Default storage location:

- `./config/_private.conf.json`

## Parameters:

- `siteUrl` - SharePoint site (SPWeb) url [string, required]
- `username` - user name for SP authentication [string, optional in case of some auth methods]
- `password` - password [string, optional in case of some auth methods]

**Additional authentication options:**

Since communication module (sp-request), which is used in sppull, had received additional SharePoint authentication methods, they are also supported in sppull.

- SharePoint On-Premise (Add-In permissions):
    - `clientId`
    - `issuerId`
    - `realm`
    - `rsaPrivateKeyPath`
    - `shaThumbprint`
- SharePoint On-Premise (NTLM handshake - more commonly used scenario):
    - `username` - username without domain
    - `password`
    - `domain` / `workstation`
- SharePoint Online (Add-In permissions):
    - `clientId`
    - `clientSecret`
- SharePoint Online (SAML based with credentials - more commonly used scenario):
    - `username` - user name for SP authentication [string, required]
    - `password` - password [string, required]
- ADFS user credantials:
    - `username`
    - `password`
    - `relyingParty`
    - `adfsUrl`

For more information please check node-sp-auth [credential options](https://github.com/s-KaiNet/node-sp-auth#params) and [wiki pages](https://github.com/s-KaiNet/node-sp-auth/wiki).