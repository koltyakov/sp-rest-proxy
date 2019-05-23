import * as Mocha from 'mocha';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';
import axios, { AxiosResponse } from 'axios';
import { sp } from '@pnp/sp';
import * as Util from '@pnp/common';
import { parseString as xmlStringToJson } from 'xml2js';
import { PnpNode } from 'sp-pnp-node';
import * as request from 'request-promise';

import RestProxy, { IProxySettings, IProxyContext } from '../../src/core/RestProxy';
import { trimMultiline } from '../../src/utils/misc';
import { TestsConfigs, ICiTestSetup, IPrivateTestSetup } from '../configs';
import { LogLevel } from '../../src/utils/logger';

const testVariables = {
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

const getRequestDigest = (): string => {
  return '__proxy_can_do_it_without_digest';
};

// import * as CertStore from '@microsoft/gulp-core-build-serve/lib/CertificateStore';
// const CertificateStore = CertStore.CertificateStore || CertStore.default;
// const protocol: any = {
//   protocol: 'https',
//   ssl: {
//     cert: CertificateStore.instance.certificateData,
//     key: CertificateStore.instance.keyData
//   }
// };

describe(`Proxy tests`, () => {

  for (const config of TestsConfigs) {

    describe(`Run tests in ${config.environmentName}`, () => {

      let expressServer: any = null;
      let proxyContext: IProxyContext = null;
      let proxySettings: IProxySettings = null;

      let proxyRootUri: string = null;
      let webRelativeUrl: string = null;

      before('Start Proxy', function(done: any): void {
        this.timeout(30 * 1000);

        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

        // Local test mode
        if (typeof (config as IPrivateTestSetup).configPath !== 'undefined') {
          proxySettings = {
            configPath: (config as IPrivateTestSetup).configPath
          };
        } else { // Headless/CI mode
          proxySettings = {
            authConfigSettings: {
              headlessMode: true,
              authOptions: {
                siteUrl: (config as ICiTestSetup).siteUrl,
                ...(config as ICiTestSetup).authOptions
              } as any,
            }
          };
        }

        const proxy: RestProxy = new RestProxy({
          ...proxySettings,
          staticRoot: './static',
          logLevel: LogLevel.Off,
          protocol: 'http'
        });

        proxy.serve((server, context, settings) => {
          expressServer = server;
          proxyContext = context;
          proxySettings = settings;

          webRelativeUrl = `/${proxyContext.siteUrl.replace('://', '').split('/').slice(1, 100).join('/')}`;
          proxyRootUri = `${!settings.protocol ? 'http' : settings.protocol}://${settings.hostname}:${settings.port}${webRelativeUrl}`;

          // Init PnPjs for Node.js
          const fetchClientFactory = new PnpNode(proxyContext);
          sp.setup({
            sp: {
              fetchClientFactory: () => fetchClientFactory,
              headers: {
                Accept: 'application/json;odata=verbose'
              },
              baseUrl: proxyContext.siteUrl
            }
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

      it(`should get contextinfo`, function(done: Mocha.Done): void {
        this.timeout(60 * 1000);

        axios.post(`${proxyRootUri}/_api/contextinfo`, {}, {
          headers: {
            ...testVariables.headers.verbose.headers,
            'Content-Type': 'application/json;odata=verbose'
          }
        })
          .then(r => {
            expect(r.data.d.GetContextWebInformation).to.have.property('FormDigestValue');
            done();
          })
          .catch(done);

      });

      it(`should get web's title`, function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        Promise.all([
          axios.get(`${proxyRootUri}/_api/web?$select=Title`, testVariables.headers.verbose),
          sp.web.select('Title').get()
        ])
          .then(r => {
            const proxyResp: AxiosResponse = r[0];
            const pnpResp: any = r[1];

            expect(proxyResp.data.d.Title).to.equal(pnpResp.Title);
            done();
          })
          .catch(done);

      });

      it(`should work with shorthand URIs`, function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const shorthandUri: string = `${!proxySettings.protocol ? 'http' : proxySettings.protocol}://${proxySettings.hostname}:${proxySettings.port}`;

        Promise.all([
          axios.get(`${shorthandUri}/_api/web?$select=Title`, testVariables.headers.verbose),
          sp.web.select('Title').get()
        ])
          .then(r => {
            const proxyResp: AxiosResponse = r[0];
            const pnpResp: any = r[1];
            expect(proxyResp.data.d.Title).to.equal(pnpResp.Title);
            done();
          })
          .catch(done);

      });

      it(`should get lists on the web`, function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        Promise.all([
          axios.get(`${proxyRootUri}/_api/web/lists?$select=Title`, testVariables.headers.verbose),
          sp.web.lists.select('Title').get()
        ])
          .then(r => {
            const proxyResp: AxiosResponse = r[0];
            const pnpResp: any = r[1];

            expect(proxyResp.data.d.results.length).to.equal(pnpResp.length);
            done();
          })
          .catch(done);

      });

      it('should create a new list', function(done: Mocha.Done): void {
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
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          }
        })
          .then(_ => {
            return sp.web.lists.getByTitle(testVariables.newListName).select('Title').get();
          })
          .then(r => {
            expect(r.Title).to.equal(testVariables.newListName);
            done();
          })
          .catch(done);

      });

      it('should create a list item', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
        axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
          .then(r => {
            return axios.post(
              `${listUri}/items`, {
                __metadata: { type: r.data.d.ListItemEntityTypeFullName },
                Title: 'New item'
              }, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose'
                }
              }
            );
          })
          .then(_ => done())
          .catch(done);

      });

      it('should update a list item', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
        Promise.all([
          axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose),
          axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.headers.verbose)
        ])
          .then(r => {
            return axios.post(
              `${listUri}/items(${r[1].data.d.results[0].Id})`, {
                __metadata: { type: r[0].data.d.ListItemEntityTypeFullName },
                Title: 'Updated item'
              }, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose',
                  'If-Match': '*',
                  'X-HTTP-Method': 'MERGE'
                }
              }
            );
          })
          .then(_ => done())
          .catch(done);

      });

      it('should update a list item using PATCH', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
        Promise.all([
          axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose),
          axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.headers.verbose)
        ])
          .then(r => {
            return axios.patch(
              `${listUri}/items(${r[1].data.d.results[0].Id})`, {
                __metadata: { type: r[0].data.d.ListItemEntityTypeFullName },
                Title: 'Updated item'
              }, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose',
                  'If-Match': '*',
                  'X-HTTP-Method': 'MERGE'
                }
              }
            );
          })
          .then(_ => done())
          .catch(done);

      });

      it('should get list items using legacy REST', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        axios.get(`${proxyRootUri}/_vti_bin/ListData.svc/${testVariables.newListName.replace(/ /g, '')}`, {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          }
        })
          .then(_ => done())
          .catch(done);

      });

      it('should delete a list item', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
        axios.get(`${listUri}/items?$select=Id&$top=1`, testVariables.headers.verbose)
          .then(r => {
            return axios.post(
              `${listUri}/items(${r.data.d.results[0].Id})`, null, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose',
                  'If-Match': '*',
                  'X-HTTP-Method': 'DELETE'
                }
              }
            );
          })
          .then(_ => done())
          .catch(done);

      });

      if (!config.legacy) {

        it(`should fetch minimalmetadata`, function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          axios.get(`${proxyRootUri}/_api/web?$select=Id`, testVariables.headers.minimalmetadata)
            .then(r => {
              expect(r.data).to.have.property('odata.metadata');
              expect(r.data).to.not.have.property('__metadata');
              done();
            })
            .catch(done);

        });

        it(`should fetch nometadata`, function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          axios.get(`${proxyRootUri}/_api/web?$select=Id`, testVariables.headers.nometadata)
            .then(r => {
              expect(r.data).to.have.property('Id');
              expect(r.data).to.not.have.property('odata.metadata');
              expect(r.data).to.not.have.property('__metadata');
              done();
            })
            .catch(done);

        });

        // Add test to check if items were physically created
        it('should create list items in a batch (local endpoints)', function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          const items = ['Batman', 'Iron man'];

          const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
          axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
            .then(r => {

              const listItemEntityTypeFullName: string = r.data.d.ListItemEntityTypeFullName;
              const boundary = `batch_${Util.getGUID()}`;
              const changeset = `changeset_${Util.getGUID()}`;

              const listEndpoint = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

              const requestPayload = trimMultiline(`
                --${boundary}
                Content-Type: multipart/mixed; boundary="${changeset}"

                ${items.map(item => {
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
                    'Accept': 'application/json',
                    'Content-Type': `multipart/mixed; boundary=${boundary}`
                  }
                }
              );
            })
            .then(_ => done())
            .catch(done);

        });

        // Add test to check if items were physically created
        it('should create list items in a batch', function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          const dragons = ['Jineoss', 'Zyna', 'Bothir', 'Jummerth', 'Irgonth', 'Kilbiag',
            'Berget', 'Lord', 'Podocrurth', 'Jiembyntet', 'Rilrayrarth'];

          const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
          axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
            .then(r => {

              const listItemEntityTypeFullName: string = r.data.d.ListItemEntityTypeFullName;
              const boundary = `batch_${Util.getGUID()}`;
              const changeset = `changeset_${Util.getGUID()}`;

              const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

              const requestPayload = trimMultiline(`
                --${boundary}
                Content-Type: multipart/mixed; boundary="${changeset}"

                ${dragons.map(dragon => {
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
                    'Accept': 'application/json',
                    'Content-Type': `multipart/mixed; boundary=${boundary}`
                  }
                }
              );
            })
            .then(_ => done())
            .catch(done);

        });

        // Add test to check if items were physically updated
        it('should update list items in a batch', function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
          Promise.all([
            axios.get(`${listUri}/items?$select=Id,Title`, testVariables.headers.verbose),
            axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
          ])
            .then((response: any): any => {

              const listItemEntityTypeFullName: string = response[1].data.d.ListItemEntityTypeFullName;
              const boundary = `batch_${Util.getGUID()}`;
              const changeset = `changeset_n${Util.getGUID()}`;
              const items = response[0].data.d.results;

              if (items.length === 0) {
                return 'No items to update';
              }

              const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

              const requestPayload = trimMultiline(`
                --${boundary}
                Content-Type: multipart/mixed; boundary="${changeset}"

                ${items.map(item => {
                  const body = `{"__metadata":{"type":"${listItemEntityTypeFullName}"},"Title":"${item.Title} _updated"}`;
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
                    'Accept': 'application/json',
                    'Content-Type': `multipart/mixed; boundary=${boundary}`
                  }
                }
              );
            })
            .then(_ => done())
            .catch(done);

        });

        // Add test to check if items were physically deleted
        it('should delete list items in a batch', function(done: Mocha.Done): void {
          this.timeout(30 * 1000);

          const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
          Promise.all([
            axios.get(`${listUri}/items?$select=Id,Title`, testVariables.headers.verbose),
            axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
          ])
            .then((response: any): any => {

              // const listItemEntityTypeFullName: string = response[1].data.d.ListItemEntityTypeFullName;
              const boundary = `batch_${Util.getGUID()}`;
              const changeset = `changeset_${Util.getGUID()}`;
              const items = response[0].data.d.results;

              if (items.length === 0) {
                return 'No items to delete';
              }

              const listEndpoint = `${proxyContext.siteUrl}/_api/web/lists/getByTitle('${testVariables.newListName}')/items`;

              const requestPayload = trimMultiline(`
                --${boundary}
                Content-Type: multipart/mixed; boundary="${changeset}"

                ${items.map(item => {
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
                    'Accept': 'application/json',
                    'Content-Type': `multipart/mixed; boundary=${boundary}`
                  }
                }
              );
            })
            .then(_ => done())
            .catch(done);

        });

      }

      it(`should add item's attachment`, function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const listUri = `${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`;
        axios.get(`${listUri}?$select=ListItemEntityTypeFullName`, testVariables.headers.verbose)
          .then(r => {
            return axios.post(
              `${listUri}/items`, {
                __metadata: { type: r.data.d.ListItemEntityTypeFullName },
                Title: 'Item with attachment'
              }, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose'
                }
              }
            );
          })
          .then(r => {
            const attachmentFile: string = path.join(__dirname, './attachments/image.png');
            const fileName: string = `${path.parse(attachmentFile).name}${path.parse(attachmentFile).ext}`;
            const fileBuffer: Buffer = fs.readFileSync(attachmentFile);
            return axios.post(
              `${listUri}/items(${r.data.d.Id})/AttachmentFiles/add(FileName='${fileName}')`,
              fileBuffer, {
                headers: {
                  'X-RequestDigest': getRequestDigest(),
                  'Accept': 'application/json;odata=verbose',
                  'Content-Type': 'application/json;odata=verbose;charset=utf-8'
                }
              }
            );
          })
          .then(_ => done())
          .catch(done);

      });

      // TODO: Download attachment and compare with local one

      it('should delete a list', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        axios.post(`${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newListName}')`, null, {
          headers: {
            'X-RequestDigest': getRequestDigest(),
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'If-Match': '*',
            'X-HTTP-Method': 'DELETE'
          }
        })
          .then(_ => done())
          .catch(done);

      });

      it('should create a document library', function(done: Mocha.Done): void {
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
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose'
          }
        })
          .then(_ => done())
          .catch(done);

      });

      it('should add a document', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const attachmentFile: string = path.join(__dirname, './attachments/image.png');
        const fileName: string = `${path.parse(attachmentFile).name}${path.parse(attachmentFile).ext}`;
        const fileBuffer: Buffer = fs.readFileSync(attachmentFile);

        const docLibFolder: string = `${webRelativeUrl}/${testVariables.newDocLibName}`;

        const methodUri = `${proxyRootUri}/_api/web/` +
          `getFolderByServerRelativeUrl('${docLibFolder}')` +
          `/files/add(overwrite=true,url='${fileName}')`;

        axios.post(
          methodUri, fileBuffer, {
            headers: {
              'X-RequestDigest': getRequestDigest(),
              'Accept': 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose;charset=utf-8'
            }
          }
        )
          .then(_ => done())
          .catch(done);

      });

      it('should download a binary document', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const attachmentFile: string = path.join(__dirname, './attachments/image.png');
        const fileBuffer: Buffer = fs.readFileSync(attachmentFile);

        const fileUri = `${webRelativeUrl}/${testVariables.newDocLibName}/image.png`;

        const methodUri =
          `${proxyRootUri}/_api/Web/GetFileByServerRelativeUrl(@FileServerRelativeUrl)/$value` +
          `?@FileServerRelativeUrl='${fileUri}'`;

        request.get(
          methodUri, {
            headers: {
              'Accept': 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose;charset=utf-8'
            },
            encoding: null
          }
        )
          .then(data => {
            expect(data.byteLength).eq(fileBuffer.byteLength);
            done();
          })
          .catch(done);

      });

      it('should add a folder', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const docLibFolder: string = `${webRelativeUrl}/${testVariables.newDocLibName}`;
        const folderName = `New Folder (proxy)`;

        const methodUri = `${proxyRootUri}/_api/web/` +
          `getFolderByServerRelativeUrl('${docLibFolder}')` +
          `/folders/add('${folderName}')`;

        axios.post(methodUri, null,
          {
            headers: {
              'X-RequestDigest': getRequestDigest(),
              'Accept': 'application/json;odata=verbose',
              'Content-Type': 'application/json;odata=verbose;charset=utf-8'
            }
          }
        )
          .then(_ => done())
          .catch(done);

      });

      it('should delete a folder', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        const folderUrl: string = `${webRelativeUrl}/${testVariables.newDocLibName}/New Folder (proxy)`;

        const methodUri = `${proxyRootUri}/_api/web/getFolderByServerRelativeUrl('${folderUrl}')`;

        axios.post(methodUri, {}, {
          headers: {
            'X-RequestDigest': getRequestDigest(),
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'If-Match': '*',
            'X-HTTP-Method': 'DELETE'
          }
        })
          .then(_ => done())
          .catch(done);

      });

      it('should delete a document library', function(done: Mocha.Done): void {
        this.timeout(30 * 1000);

        axios.post(`${proxyRootUri}/_api/web/lists/getByTitle('${testVariables.newDocLibName}')`, null, {
          headers: {
            'X-RequestDigest': getRequestDigest(),
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'If-Match': '*',
            'X-HTTP-Method': 'DELETE'
          }
        })
          .then(_ => done())
          .catch(done);

      });

      it(`should get web's title with SOAP`, function(done: Mocha.Done): void {
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
              // 'Content-Length': soapPackage.length
            }
          }),
          sp.web.select('Title').get()
        ])
          .then(r => {
            xmlStringToJson(r[0].data, (err: any, soapResp: any) => {
              if (err) {
                done(err);
              } else {
                const webData = soapResp['soap:Envelope']['soap:Body'][0]
                  .GetWebResponse[0].GetWebResult[0].Web[0].$;
                const pnpResp: any = r[1];
                expect(webData.Title).to.be.equal(pnpResp.Title);
                done();
              }
            });
          })
          .catch(done);

      });

      it(`should get web's title with CSOM`, function(done: Mocha.Done): void {
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
              // 'Content-Length': csomPackage.length
            }
          }),
          sp.web.select('Title').get()
        ])
          .then(r => {
            const csomResp: any = r[0].data[4];
            const pnpResp: any = r[1];
            expect(csomResp.Title).to.be.equal(pnpResp.Title);
            done();
          })
          .catch(done);

      });

    });

  }

});
