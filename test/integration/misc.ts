import { AuthConfig } from 'node-sp-auth-config';
import { getAuth as getNodeAuth } from 'node-sp-auth';
import { ICiEnvironmentConfig, IPrivateEnvironmentConfig, IEnvironmentConfig } from '../configs';

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

export const getAuthConf = (config: IEnvironmentConfig) => {
  const proxySettings =
    typeof (config as IPrivateEnvironmentConfig).configPath !== 'undefined'
    ? { // Local test mode
      configPath: (config as IPrivateEnvironmentConfig).configPath
    }
    : { // Headless/CI mode
      authConfigSettings: {
        headlessMode: true,
        authOptions: {
          siteUrl: (config as ICiEnvironmentConfig).siteUrl,
          ...(config as ICiEnvironmentConfig).authOptions
        }
      }
    };
  return proxySettings;
};

export const getAuth = (config: IEnvironmentConfig) => {
  const authConf = getAuthConf(config);
  return new AuthConfig({
    configPath: authConf.configPath,
    ...authConf.authConfigSettings || {}
  }).getContext()
    .then(({ siteUrl, authOptions }) => {
      return getNodeAuth(siteUrl, authOptions);
    });
};
