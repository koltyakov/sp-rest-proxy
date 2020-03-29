import { trimMultiline } from './misc';

// tslint:disable-next-line: no-empty-interface
export interface IPageContextInfo extends _spPageContextInfo {}

export const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export const loadPageContext = (proxyEndpoint?: string): Promise<IPageContextInfo> => {
  return new Promise((resolve) => {
    if (typeof _spPageContextInfo !== 'undefined') {
      return resolve(_spPageContextInfo);
    }
    if (isLocalhost) {
      const apiEndpoint = proxyEndpoint || window.location.origin;
      // if (port) {
      //   const [ protocol, uri ] = apiEndpoint.split(':');
      //   apiEndpoint = `${protocol}:${uri}:${port}`;
      // }
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
          const _spPageContextInfoFake: IPageContextInfo = {
            ...{} as any,
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
          (window as any)._spPageContextInfo = _spPageContextInfoFake;
          return resolve(_spPageContextInfoFake);
        });
    }
  });
};
