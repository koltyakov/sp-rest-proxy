import { expect } from 'chai';
import * as mocha from 'mocha';
import axios from 'axios';
import { AxiosResponse } from 'axios';
import * as pnp from 'sp-pnp-js';
import { PnpNode, IPnpNodeSettings } from 'sp-pnp-node';

import RestProxy from '../../src/RestProxy';

import { IProxySettings, IProxyContext } from '../../src/RestProxy';
import { TestsConfigs } from '../configs';

const testVariables = {
    newListName: 'sp-rest-proxy Temporary List',
    verboseHeaders: {
        headers: {
            accept: 'application/json;odata=verbose'
        }
    }
};

const getRequestDigest = (): string => {
    return '__proxy_can_do_it_without_digest';
};

for (let testConfig of TestsConfigs) {

    describe(`Run tests in ${testConfig.environmentName}`, () => {

        let expressServer: any;
        let proxyContext: IProxyContext;
        let proxySettings: IProxySettings;

        let proxyRootUri: string;

        before('Start Proxy', function (done: any): void {
            this.timeout(30 * 1000);

            (new RestProxy({
                configPath: testConfig.configPath,
                staticRoot: './static',
                rawBodyLimitSize: '4MB',
                silentMode: true
            })).serve((server: any, context: IProxyContext, settings: IProxySettings) => {
                expressServer = server;
                proxyContext = context;
                proxySettings = settings;

                let relativeUri = proxyContext.siteUrl.replace('://', '').split('/').slice(1, 100).join('/');
                proxyRootUri = `http://${settings.hostname}:${settings.port}/${relativeUri}`;

                // Init PnP JS Core for Node.js
                pnp.setup({
                    fetchClientFactory: () => {
                        return new PnpNode(proxyContext);
                    },
                    headers: {
                        accept: 'application/json;odata=verbose'
                    },
                    baseUrl: proxyContext.siteUrl
                });

                done();
            });
        });

        after('Stop Proxy', function (done: any): void {
            this.timeout(30 * 1000);
            expressServer.close();
            // console.log(`Proxy has been stopped (${testConfig.environmentName})`)
            done();
        });

        it(`should get web's title`, function (done: MochaDone): void {
            this.timeout(30 * 1000);

            Promise.all([
                axios.get(`${proxyRootUri}/_api/web?$select=Title`, testVariables.verboseHeaders),
                pnp.sp.web.select('Title').get()
            ])
                .then(response => {
                    const proxyResp: AxiosResponse = response[0];
                    const pnpResp: any = response[1];

                    expect(proxyResp.data.d.Title).to.equal(pnpResp.Title);
                    done();
                })
                .catch(done);

        });

        it(`should work with shorthand URIs`, function (done: MochaDone): void {
            this.timeout(30 * 1000);

            let shorthandUri: string = `http://${proxySettings.hostname}:${proxySettings.port}`;

            Promise.all([
                axios.get(`${shorthandUri}/_api/web?$select=Title`, testVariables.verboseHeaders),
                pnp.sp.web.select('Title').get()
            ])
                .then(response => {
                    const proxyResp: AxiosResponse = response[0];
                    const pnpResp: any = response[1];
                    expect(proxyResp.data.d.Title).to.equal(pnpResp.Title);
                    done();
                })
                .catch(done);

        });

        it(`should get lists on web`, function (done: MochaDone): void {
            this.timeout(30 * 1000);

            Promise.all([
                axios.get(`${proxyRootUri}/_api/web/lists?$select=Title`, testVariables.verboseHeaders),
                pnp.sp.web.lists.select('Title').get()
            ])
                .then(response => {
                    const proxyResp: AxiosResponse = response[0];
                    const pnpResp: any = response[1];

                    expect(proxyResp.data.d.results.length).to.equal(pnpResp.length);
                    done();
                })
                .catch(done);

        });

        it('should create a new list', function (done: MochaDone): void {
            this.timeout(30 * 1000);

            axios.post(`${proxyRootUri}/_api/web/lists`, {
                __metadata: { type: 'SP.List' },
                Title: testVariables.newListName,
                Description: 'This list was created for test purposes',
                AllowContentTypes: false,
                ContentTypesEnabled: false,
                BaseTemplate: 100
            }, {
                headers: {
                    'X-RequestDigest': getRequestDigest(),
                    'accept': 'application/json;odata=verbose',
                    'content-type': 'application/json;odata=verbose'
                }
            })
                .then(response => {
                    return pnp.sp.web.lists.getByTitle(testVariables.newListName).select('Title').get();
                })
                .then(response => {
                    expect(response.Title).to.equal(testVariables.newListName);
                    done();
                })
                .catch(done);

        });

        it('should create list item', function (done: MochaDone): void {
            this.timeout(30 * 1000);

            let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
            axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.verboseHeaders)
                .then((response: any) => {

                    return axios.post(
                        `${listUri}/items`, {
                            __metadata: { type: response.data.d.ListItemEntityTypeFullName },
                            Title: 'New item'
                        }, {
                            headers: {
                                'X-RequestDigest': getRequestDigest(),
                                'accept': 'application/json;odata=verbose',
                                'content-type': 'application/json;odata=verbose'
                            }
                        }
                    );
                })
                .then(response => {
                    done();
                })
                .catch(done);

        });

        it('should update list item', function (done: MochaDone): void {
            this.timeout(30 * 1000);

            let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
            Promise.all([
                axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.verboseHeaders),
                axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.verboseHeaders)
            ])
                .then((response: any) => {
                    return axios.post(
                        `${listUri}/items(${response[1].data.d.results[0].Id})`, {
                            __metadata: { type: response[0].data.d.ListItemEntityTypeFullName },
                            Title: 'Updated item'
                        }, {
                            headers: {
                                'X-RequestDigest': getRequestDigest(),
                                'accept': 'application/json;odata=verbose',
                                'content-type': 'application/json;odata=verbose',
                                'if-match': '*',
                                'x-http-method': 'MERGE'
                            }
                        }
                    );
                })
                .then(response => {
                    done();
                })
                .catch(done);

        });

        it('should delete list item', function (done: MochaDone): void {
            this.timeout(30 * 1000);

            let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
            axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.verboseHeaders)
                .then((response: any) => {
                    return axios.post(
                        `${listUri}/items(${response.data.d.results[0].Id})`, null, {
                            headers: {
                                'X-RequestDigest': getRequestDigest(),
                                'accept': 'application/json;odata=verbose',
                                'content-type': 'application/json;odata=verbose',
                                'if-match': '*',
                                'x-http-method': 'DELETE'
                            }
                        }
                    );
                })
                .then(response => {
                    done();
                })
                .catch(done);

        });

        it('should delete list', function (done: MochaDone): void {
            this.timeout(30 * 1000);

            axios.post(`${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`, null, {
                headers: {
                    'X-RequestDigest': getRequestDigest(),
                    'accept': 'application/json;odata=verbose',
                    'content-type': 'application/json;odata=verbose',
                    'if-match': '*',
                    'x-http-method': 'DELETE'
                }
            })
                .then(response => {
                    done();
                })
                .catch(done);

        });

    });

}
