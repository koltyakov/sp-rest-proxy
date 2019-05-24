import { ITestSetup, IPrivateTestSetup, ICiTestSetup } from '../configs';

export const testVariables = {
  newListName: 'SPRP List',
  newDocLibName: 'SPRP Library',
  headers: {
    verbose: {
      headers: {
        Accept: 'application/json;odata=verbose'
      }
    },
    minimalmetadata: {
      headers: {
        Accept: 'application/json;odata=minimalmetadata'
      }
    },
    nometadata: {
      headers: {
        Accept: 'application/json;odata=nometadata'
      }
    }
  }
};

export const getRequestDigest = (): string => {
  return '__proxy_can_do_it_without_digest';
};

export const getAuthConf = (config: ITestSetup) => {
  const proxySettings =
    typeof (config as IPrivateTestSetup).configPath !== 'undefined'
    ? { // Local test mode
      configPath: (config as IPrivateTestSetup).configPath
    }
    : { // Headless/CI mode
      authConfigSettings: {
        headlessMode: true,
        authOptions: {
          siteUrl: (config as ICiTestSetup).siteUrl,
          ...(config as ICiTestSetup).authOptions
        } as any,
      }
    };
  return proxySettings;
};
