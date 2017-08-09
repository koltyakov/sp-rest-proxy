import { expect } from 'chai';
import * as mocha from 'mocha';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';
import { AxiosResponse } from 'axios';
import * as pnp from 'sp-pnp-js';
import { parseString as xmlStringToJson } from 'xml2js';
import { PnpNode, IPnpNodeSettings } from 'sp-pnp-node';

import RestProxy from '../../src/RestProxy';

import { trimMultiline } from '../../src/utils';
import { IProxySettings, IProxyContext } from '../../src/RestProxy';
import { TestsConfigs } from '../configs';

const testVariables = {
    newListName: 'SPRP List',
    newDocLibName: 'SPRP Library',
    headers: {
        verbose: {
            headers: {
                accept: 'application/json;odata=verbose'
            }
        },
        minimalmetadata: {
            headers: {
                accept: 'application/json;odata=minimalmetadata'
            }
        },
        nometadata: {
            headers: {
                accept: 'application/json;odata=nometadata'
            }
        }
    }
};

const getRequestDigest = (): string => {
    return '__proxy_can_do_it_without_digest';
};

describe(`Proxy tests`, () => {

    for (let testConfig of TestsConfigs) {

        describe(`Run tests in ${testConfig.environmentName}`, () => {

            let expressServer: any;
            let proxyContext: IProxyContext;
            let proxySettings: IProxySettings;

            let proxyRootUri: string;
            let webRelativeUrl: string;

            before('Start Proxy', function(done: any): void {
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

                    webRelativeUrl = `/${proxyContext.siteUrl.replace('://', '').split('/').slice(1, 100).join('/')}`;
                    proxyRootUri = `http://${settings.hostname}:${settings.port}${webRelativeUrl}`;

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

            after('Stop Proxy', function(done: any): void {
                this.timeout(30 * 1000);
                expressServer.close();
                // console.log(`Proxy has been stopped (${testConfig.environmentName})`)
                done();
            });

            it(`should get web's title`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                Promise.all([
                    axios.get(`${proxyRootUri}/_api/web?$select=Title`, testVariables.headers.verbose),
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

            it(`should work with shorthand URIs`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let shorthandUri: string = `http://${proxySettings.hostname}:${proxySettings.port}`;

                Promise.all([
                    axios.get(`${shorthandUri}/_api/web?$select=Title`, testVariables.headers.verbose),
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

            it(`should get lists on the web`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                Promise.all([
                    axios.get(`${proxyRootUri}/_api/web/lists?$select=Title`, testVariables.headers.verbose),
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

            it('should create a new list', function(done: MochaDone): void {
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

            it('should create a list item', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
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

            it('should update a list item', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                Promise.all([
                    axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose),
                    axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.headers.verbose)
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

            it('should delete a list item', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.headers.verbose)
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

            if (!testConfig.legacy) {

                it(`should fetch minimalmetadata`, function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    axios.get(`${proxyRootUri}/_api/web?$select=Id`, testVariables.headers.minimalmetadata)
                        .then(response => {
                            expect(response.data).to.have.property('odata.metadata');
                            expect(response.data).to.not.have.property('__metadata');
                            done();
                        })
                        .catch(done);

                });

                it(`should fetch nometadata`, function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    axios.get(`${proxyRootUri}/_api/web?$select=Id`, testVariables.headers.nometadata)
                        .then(response => {
                            expect(response.data).to.have.property('Id');
                            expect(response.data).to.not.have.property('odata.metadata');
                            expect(response.data).to.not.have.property('__metadata');
                            done();
                        })
                        .catch(done);

                });

                // Add test to check if items were physically created
                it('should create list items in a batch (local endpoints)', function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    let items = [ 'Batman', 'Iron man' ];

                    let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                    axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
                        .then((response: any) => {

                            const listItemEntityTypeFullName: string = response.data.d.ListItemEntityTypeFullName;
                            const boundary = `batch_${pnp.Util.getGUID()}`;
                            const changeset = `changeset_${pnp.Util.getGUID()}`;

                            const listEndpoint = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

                            let requestPayload = trimMultiline(`
                                --${boundary}
                                Content-Type: multipart/mixed; boundary="${changeset}"

                                ${items.map((item: string) => {
                                    return trimMultiline(`
                                        --${changeset}
                                        Content-Type: application/http
                                        Content-Transfer-Encoding: binary

                                        POST ${listEndpoint} HTTP/1.1
                                        Accept: application/json;
                                        Content-Type: application/json;odata=verbose;charset=utf-8

                                        {"__metadata":{"type":"${listItemEntityTypeFullName}"},"Title":"${item}"}
                                    `);
                                }).join('\n\n')}

                                --${changeset}--

                                --${boundary}--
                            `);

                            return axios.post(
                                `${proxyRootUri}/_api/$batch`,
                                requestPayload, {
                                    headers: {
                                        'X-RequestDigest': getRequestDigest(),
                                        'accept': 'application/json',
                                        'content-type': `multipart/mixed; boundary=${boundary}`
                                    }
                                }
                            );
                        })
                        .then(response => {
                            done();
                        })
                        .catch(done);

                });

                // Add test to check if items were physically created
                it('should create list items in a batch', function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    let dragons = [ 'Jineoss',  'Zyna', 'Bothir', 'Jummerth', 'Irgonth', 'Kilbiag',
                                    'Berget', 'Lord', 'Podocrurth', 'Jiembyntet', 'Rilrayrarth' ];

                    let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                    axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
                        .then((response: any) => {

                            const listItemEntityTypeFullName: string = response.data.d.ListItemEntityTypeFullName;
                            const boundary = `batch_${pnp.Util.getGUID()}`;
                            const changeset = `changeset_${pnp.Util.getGUID()}`;

                            const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

                            let requestPayload = trimMultiline(`
                                --${boundary}
                                Content-Type: multipart/mixed; boundary="${changeset}"

                                ${dragons.map((dragon: string) => {
                                    return trimMultiline(`
                                        --${changeset}
                                        Content-Type: application/http
                                        Content-Transfer-Encoding: binary

                                        POST ${listEndpoint} HTTP/1.1
                                        Accept: application/json;
                                        Content-Type: application/json;odata=verbose;charset=utf-8

                                        {"__metadata":{"type":"${listItemEntityTypeFullName}"},"Title":"${dragon}"}
                                    `);
                                }).join('\n\n')}

                                --${changeset}--

                                --${boundary}--
                            `);

                            return axios.post(
                                `${proxyRootUri}/_api/$batch`,
                                requestPayload, {
                                    headers: {
                                        'X-RequestDigest': getRequestDigest(),
                                        'accept': 'application/json',
                                        'content-type': `multipart/mixed; boundary=${boundary}`
                                    }
                                }
                            );
                        })
                        .then(response => {
                            done();
                        })
                        .catch(done);

                });

                // Add test to check if items were physically updated
                it('should update list items in a batch', function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                    Promise.all([
                        axios.get(`${listUri}/items?$select=Id,Title`, testVariables.headers.verbose),
                        axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
                    ])
                        .then((response: any): any => {

                            const listItemEntityTypeFullName: string = response[1].data.d.ListItemEntityTypeFullName;
                            const boundary = `batch_${pnp.Util.getGUID()}`;
                            const changeset = `changeset_n${pnp.Util.getGUID()}`;
                            let items = response[0].data.d.results;

                            if (items.length === 0) {
                                return 'No items to update';
                            }

                            const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

                            let requestPayload = trimMultiline(`
                                --${boundary}
                                Content-Type: multipart/mixed; boundary="${changeset}"

                                ${items.map((item: any) => {
                                    let body = `{"__metadata":{"type":"${listItemEntityTypeFullName}"},"Title":"${item.Title} _updated"}`;
                                    return trimMultiline(`
                                        --${changeset}
                                        Content-Type: application/http
                                        Content-Transfer-Encoding: binary

                                        MERGE ${listEndpoint}(${item.Id}) HTTP/1.1
                                        If-Match: *
                                        Accept: application/json;
                                        Content-Type: application/json;odata=verbose;charset=utf-8
                                        Content-Length: ${body.length}

                                        ${body}
                                    `);
                                }).join('\n\n')}

                                --${changeset}--

                                --${boundary}--
                            `);

                            return axios.post(
                                `${proxyRootUri}/_api/$batch`,
                                requestPayload, {
                                    headers: {
                                        'X-RequestDigest': getRequestDigest(),
                                        'accept': 'application/json',
                                        'content-type': `multipart/mixed; boundary=${boundary}`
                                    }
                                }
                            );
                        })
                        .then(response => {
                            done();
                        })
                        .catch(done);

                });

                // Add test to check if items were physically deleted
                it('should delete list items in a batch', function(done: MochaDone): void {
                    this.timeout(30 * 1000);

                    let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                    Promise.all([
                        axios.get(`${listUri}/items?$select=Id,Title`, testVariables.headers.verbose),
                        axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
                    ])
                        .then((response: any): any => {

                            const listItemEntityTypeFullName: string = response[1].data.d.ListItemEntityTypeFullName;
                            const boundary = `batch_${pnp.Util.getGUID()}`;
                            const changeset = `changeset_${pnp.Util.getGUID()}`;
                            let items = response[0].data.d.results;

                            if (items.length === 0) {
                                return 'No items to delete';
                            }

                            const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

                            let requestPayload = trimMultiline(`
                                --${boundary}
                                Content-Type: multipart/mixed; boundary="${changeset}"

                                ${items.map((item: any) => {
                                    return trimMultiline(`
                                        --${changeset}
                                        Content-Type: application/http
                                        Content-Transfer-Encoding: binary

                                        DELETE ${listEndpoint}(${item.Id}) HTTP/1.1
                                        If-Match: *
                                    `);
                                }).join('\n\n')}

                                --${changeset}--

                                --${boundary}--
                            `);

                            return axios.post(
                                `${proxyRootUri}/_api/$batch`,
                                requestPayload, {
                                    headers: {
                                        'X-RequestDigest': getRequestDigest(),
                                        'accept': 'application/json',
                                        'content-type': `multipart/mixed; boundary=${boundary}`
                                    }
                                }
                            );
                        })
                        .then(response => {
                            done();
                        })
                        .catch(done);

                });

            }

            it(`should add item's attachment`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
                axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
                    .then((response: any) => {
                        return axios.post(
                            `${listUri}/items`, {
                                __metadata: { type: response.data.d.ListItemEntityTypeFullName },
                                Title: 'Item with attachment'
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
                        let attachmentFile: string = path.join(__dirname, './attachments/image.png');
                        let fileName: string = `${path.parse(attachmentFile).name}${path.parse(attachmentFile).ext}`;
                        let fileBuffer: Buffer = fs.readFileSync(attachmentFile);
                        return axios.post(
                            `${listUri}/items(${response.data.d.Id})/AttachmentFiles/add(FileName='${fileName}')`,
                             fileBuffer, {
                                headers: {
                                    'X-RequestDigest': getRequestDigest(),
                                    'accept': 'application/json',
                                    'content-type': 'application/json;odata=verbose;charset=utf-8'
                                }
                            }
                        );
                    })
                    .then(response => {
                        done();
                    })
                    .catch(done);

            });

            // TODO: Download attachment and compare with local one

            it('should delete a list', function(done: MochaDone): void {
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

            it('should create a document library', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                axios.post(`${proxyRootUri}/_api/web/lists`, {
                    __metadata: { type: 'SP.List' },
                    Title: testVariables.newDocLibName,
                    Description: 'This document library was created for test purposes',
                    AllowContentTypes: false,
                    ContentTypesEnabled: false,
                    BaseTemplate: 101
                }, {
                    headers: {
                        'X-RequestDigest': getRequestDigest(),
                        'accept': 'application/json;odata=verbose',
                        'content-type': 'application/json;odata=verbose'
                    }
                })
                    .then(response => {
                        done();
                    })
                    .catch(done);

            });

            it('should add a document', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                let attachmentFile: string = path.join(__dirname, './attachments/image.png');
                let fileName: string = `${path.parse(attachmentFile).name}${path.parse(attachmentFile).ext}`;
                let fileBuffer: Buffer = fs.readFileSync(attachmentFile);

                let docLibFolder: string = `${webRelativeUrl}/${testVariables.newDocLibName}`;

                let methodUri = `${proxyRootUri}/_api/web/` +
                    `getFolderByServerRelativeUrl('${docLibFolder}')` +
                    `/files/add(overwrite=true,url='${fileName}')`;

                axios.post(
                    methodUri, fileBuffer, {
                        headers: {
                            'X-RequestDigest': getRequestDigest(),
                            'accept': 'application/json',
                            'content-type': 'application/json;odata=verbose;charset=utf-8'
                        }
                    }
                )
                    .then(response => {
                        done();
                    })
                    .catch(done);

            });

            // TODO: Download documents and compare with local one

            it('should delete a document library', function(done: MochaDone): void {
                this.timeout(30 * 1000);

                axios.post(`${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newDocLibName}')`, null, {
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

            it(`should get web's title with SOAP`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                const soapPackage = trimMultiline(`
                    <?xml version="1.0" encoding="utf-8"?>
                        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                            xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                            xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
                        <soap:Body>
                            <GetWeb xmlns="http://schemas.microsoft.com/sharepoint/soap/">
                                <webUrl>${proxyContext.siteUrl}</webUrl>
                            </GetWeb>
                        </soap:Body>
                    </soap:Envelope>
                `);

                Promise.all([
                    axios.post(`${proxyRootUri}/_vti_bin/Webs.asmx`, soapPackage, {
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/xml, text/xml, */*; q=0.01',
                            'Content-Type': 'text/xml;charset="UTF-8"',
                            'Content-Length': soapPackage.length
                        }
                    }),
                    pnp.sp.web.select('Title').get()
                ])
                    .then(response => {
                        xmlStringToJson(response[0].data, (err: any, soapResp: any) => {
                            if (err) {
                                done(err);
                            } else {
                                let webData = soapResp['soap:Envelope']['soap:Body'][0]
                                    .GetWebResponse[0].GetWebResult[0].Web[0].$;
                                let pnpResp: any = response[1];
                                expect(webData.Title).to.be.equal(pnpResp.Title);
                                done();
                            }
                        });
                    })
                    .catch(done);

            });

            it(`should get web's title with CSOM`, function(done: MochaDone): void {
                this.timeout(30 * 1000);

                const csomPackage = trimMultiline(`
                    <Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009"
                        SchemaVersion="15.0.0.0" LibraryVersion="15.0.0.0" ApplicationName="Javascript Library">
                        <Actions>
                            <ObjectPath Id="16" ObjectPathId="15" />
                            <Query Id="17" ObjectPathId="15">
                                <Query SelectAllProperties="true">
                                    <Properties />
                                </Query>
                            </Query>
                        </Actions>
                        <ObjectPaths>
                            <Property Id="15" ParentId="0" Name="Web" />
                            <StaticProperty Id="0" TypeId="{3747adcd-a3c3-41b9-bfab-4a64dd2f1e0a}" Name="Current" />
                        </ObjectPaths>
                    </Request>
                `);

                Promise.all([
                    axios.post(`${proxyRootUri}/_vti_bin/client.svc/ProcessQuery`, csomPackage, {
                        headers: {
                            'X-RequestDigest': getRequestDigest(),
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': '*/*',
                            'Content-Type': 'text/xml',
                            'Content-Length': csomPackage.length
                        }
                    }),
                    pnp.sp.web.select('Title').get()
                ])
                    .then(response => {
                        let csomResp: any = response[0].data[4];
                        let pnpResp: any = response[1];
                        expect(csomResp.Title).to.be.equal(pnpResp.Title);
                        done();
                    })
                    .catch(done);

            });

        });

    }

});
