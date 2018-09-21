import { trimMultiline } from './';

export interface IPageContextInfo extends _spPageContextInfo {}

export const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
  window.location.hostname === '[::1]' ||
  window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

export const loadPageContext = (): Promise<IPageContextInfo> => {
  return new Promise(resolve => {
    if (typeof _spPageContextInfo !== 'undefined') {
      return resolve(_spPageContextInfo);
    }
    if (isLocalhost) {
      const restUrl = trimMultiline(`
        ${window.location.origin}/_api/web?
          $select=Title,Language,ServerRelativeUrl,CurrentUser/Id,Url&
          $expand=CurrentUser/Id
      `);
      return fetch(restUrl, {
        method: 'GET',
        headers: [['Accept', 'application/json;odata=verbose']]
      })
        .then(res => res.json())
        .then(({ d: webInfo }) => {
          const _spPageContextInfoFake: IPageContextInfo = {
            ...{} as any,
            webTitle: webInfo.Title,
            webAbsoluteUrl: window.location.origin + webInfo.ServerRelativeUrl,
            webServerRelativeUrl: webInfo.ServerRelativeUrl,
            currentLanguage: webInfo.Language,
            userId: webInfo.CurrentUser.Id,
            __webAbsoluteUrl: webInfo.Url
          };
          (window as any)._spPageContextInfo = _spPageContextInfoFake;
          return resolve(_spPageContextInfoFake);
        });
    }
  });
};
