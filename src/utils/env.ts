import { trimMultiline } from './misc';

export interface IPageContextInfo extends _spPageContextInfo {
  __webAbsoluteUrl?: string;
  __siteAbsoluteUrl?: string;
}

export const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export const loadPageContext = (proxyEndpoint?: string): Promise<Partial<IPageContextInfo>> => {
  return new Promise((resolve) => {
    if (typeof _spPageContextInfo !== 'undefined') {
      return resolve(_spPageContextInfo);
    }
    if (isLocalhost) {
      const apiEndpoint = proxyEndpoint || window.location.origin;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getWebInfo = (): Promise<any> => {
        const restUrl = trimMultiline(`
          ${apiEndpoint}/_api/web?
            $select=Title,Language,ServerRelativeUrl,Url,
              CurrentUser/Id,CurrentUser/LoginName,CurrentUser/Email,CurrentUser/Title,CurrentUser/IsSiteAdmin&
            $expand=CurrentUser
        `);
        return fetch(restUrl, {
          method: 'GET',
          headers: [
            ['Accept', 'application/json;odata=verbose'],
            ['X-ProxyStrict', 'false']
          ]
        }).then((res) => res.json());
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getSiteInfo = (): Promise<any> => {
        const restUrl = `${apiEndpoint}/_api/site?$select=ServerRelativeUrl,Url`;
        return fetch(restUrl, {
          method: 'GET',
          headers: [
            ['Accept', 'application/json;odata=verbose'],
            ['X-ProxyStrict', 'false']
          ]
        }).then((res) => res.json());
      };
      return Promise.all([ getWebInfo(), getSiteInfo() ])
        .then(([{ d: webInfo }, { d: siteInfo }]) => {
          const _spPageContextInfoFake: Partial<IPageContextInfo> = {
            // Web info
            webTitle: webInfo.Title,
            webAbsoluteUrl: apiEndpoint + webInfo.ServerRelativeUrl,
            webServerRelativeUrl: webInfo.ServerRelativeUrl,
            // Locale
            currentLanguage: webInfo.Language,
            // Site info
            siteAbsoluteUrl: apiEndpoint + siteInfo.ServerRelativeUrl,
            siteServerRelativeUrl: siteInfo.ServerRelativeUrl,
            // User info
            userId: webInfo.CurrentUser.Id,
            userLoginName: webInfo.CurrentUser.LoginName,
            userDisplayName: webInfo.CurrentUser.Title,
            userEmail: webInfo.CurrentUser.Email,
            isSiteAdmin: webInfo.CurrentUser.IsSiteAdmin,
            // Misc
            __webAbsoluteUrl: webInfo.Url,
            __siteAbsoluteUrl: siteInfo.Url,
          };
          (window as unknown as { _spPageContextInfo: Partial<IPageContextInfo> })
            ._spPageContextInfo = _spPageContextInfoFake;
          return resolve(_spPageContextInfoFake);
        });
    }
    // Not a localhost, but still no object model loaded
    SP.SOD.executeFunc('sp.js', 'SP.ClientContext', () => resolve(_spPageContextInfo));
  });
};
