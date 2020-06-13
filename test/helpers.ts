import { AuthConfig } from 'node-sp-auth-config';
import { getAuth as getNodeAuth, IAuthResponse } from 'node-sp-auth';
import { ICiEnvironmentConfig, IPrivateEnvironmentConfig, IEnvironmentConfig } from './configs';
import { IProxySettings } from '../src/RestProxy';

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

export const getAuthConf = (config: IEnvironmentConfig): IProxySettings => {
  const proxySettings: IProxySettings =
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        }
      };
  return proxySettings;
};

export const getAuth = (config: IEnvironmentConfig): Promise<IAuthResponse> => {
  const authConf = getAuthConf(config);
  return new AuthConfig({
    configPath: authConf.configPath,
    ...authConf.authConfigSettings || {}
  })
    .getContext()
    .then(({ siteUrl, authOptions }) => getNodeAuth(siteUrl, authOptions));
};
