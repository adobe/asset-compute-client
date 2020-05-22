/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/* eslint-env mocha */
/* eslint mocha/no-mocha-arrows: "off" */

'use strict';

const mockRequire = require('mock-require');
const assert = require('assert');
const nock = require('nock');

const DEFAULT_INTEGRATION = {
    applicationId: 72515,
    consumerId: 105979,
    metascopes: ['event_receiver_api', 'ent_adobeio_sdk', 'asset_compute_meta'],
    technicalAccount: {
        id: 'id',
        org: 'org',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        privateKey: 'privateKey'
    },
    imsEndpoint: 'https://ims-na1-stage.adobelogin.com'
};

describe( 'client.js tests', () => {
    beforeEach( () => {
        mockRequire("@adobe/asset-compute-events-client", {
            AdobeAuth: class AdobeAuthMock {
                constructor(config) {
                    this.adobeLoginHost = config.adobeLoginHost;
                }
                async createAccessToken() {
                    return '123456';
                }
            },
            AdobeIOEvents: class AdobeIOEventsMock {},
            AdobeIOEventEmitter: class AdobeIOEventEmitterMock {
                on() {
                    return {
                        event: {
                            type: 'rendition_created'
                        }
                    };
                }
                stop() {}
            }
        });
    });

    afterEach( () => {
        mockRequire.stopAll();
        nock.cleanAll();
    });
    it('should create asset compute client with custom retryOptions', async function() {
        const { AssetComputeClient } = require('../lib/client');
        const options = {
            retryOptions: {
                retryMaxDuration: 1000
            }
        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {})

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        await assetComputeClient.initialize();
        assert.equal(assetComputeClient.assetCompute.retryOptions.retryMaxDuration, 1000);
    });

    it('should create asset compute client with ims endpoint in integration', async function() {
        const { AssetComputeClient } = require('../lib/client');
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        assert.ok(assetComputeClient.auth);
        assert.equal(assetComputeClient.auth.adobeLoginHost, 'https://ims-na1-stage.adobelogin.com');
    });

    it('should create asset compute client with ims endpoint in options', async function() {
        const { AssetComputeClient } = require('../lib/client');
        const integration = {
            applicationId: 72515,
            consumerId: 105979,
            metascopes: ['event_receiver_api', 'ent_adobeio_sdk', 'asset_compute_meta'],
            technicalAccount: {
                id: 'id',
                org:'org',
                clientId:'clientId',
                clientSecret:'clientSecret',
                privateKey: 'privateKey'
            }
        };
        const assetComputeClient = new AssetComputeClient(integration, { imsEndpoint: 'https://ims-na1-stage.adobelogin.com'});
        assert.ok(assetComputeClient.auth);
        assert.equal(assetComputeClient.auth.adobeLoginHost, 'https://ims-na1-stage.adobelogin.com');
    });

    it('should fail to create asset compute client with missing integration', async function() {
        const { AssetComputeClient } = require('../lib/client');
        try {
            new AssetComputeClient();
        } catch (e) { 
            assert.ok(e.message.includes('Asset Compute integration'));
        }
    });

    it('should call /register and then /unregister', async function() {
        const { AssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200,{
                'ok': true,
                'requestId': '4321'
            })
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        await assetComputeClient.register();
        const { requestId } = await assetComputeClient.unregister();
        assert.strictEqual(requestId, '4321');
    });

    it('should call /register, /process, then /unregister', async function() {
        const { AssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200,{
                'ok': true,
                'requestId': '3214'
            })
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200,{
                'ok': true,
                'requestId': '4321'
            })
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);

        // register integration
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);
        assert.ok(!assetComputeClient.eventEmitter);

        // process renditions
        const response = await assetComputeClient.process({
            url: 'https://example.com/dog.jpg'
        },
        [
            {
                name: 'rendition.jpg',
                fmt: 'jpg'
            }
        ]);
        assert.strictEqual(response.requestId, '3214');
        assert.ok(assetComputeClient.eventEmitter);
        // unregister integration
        const { requestId } = await assetComputeClient.unregister();
        assert.strictEqual(requestId, '4321');
        assert.ok(!assetComputeClient._registered);
    });

    it('should call /register, /process, then /unregister multiple times', async function() {
        const { AssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200,{
                'ok': true,
                'requestId': '3214'
            })
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200,{
                'ok': true,
                'requestId': '4321'
            })
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200,{
                'ok': true,
                'requestId': '4321'
            })
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);

        // register integration
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);
        assert.ok(!assetComputeClient.eventEmitter); // no event emitter until /process call

        // process renditions
        const response = await assetComputeClient.process({
            url: 'https://example.com/dog.jpg'
        },
        [
            {
                name: 'rendition.jpg',
                fmt: 'jpg'
            }
        ]);
        assert.strictEqual(response.requestId, '3214');
        assert.ok(assetComputeClient.eventEmitter); // no there is an event emitter to get events

        // register integration
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);
        assert.ok(!assetComputeClient.eventEmitter); // no event emitter since /register called again

        // unregister integration
        await assetComputeClient.unregister();
        assert.ok(!assetComputeClient._registered);

        // register integration again
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);
        assert.ok(!assetComputeClient.eventEmitter); // no event emitter since /register called again

        // unregister integration again
        await assetComputeClient.unregister();
        assert.ok(!assetComputeClient._registered);
        assert.ok(!assetComputeClient.eventEmitter);
    });

    it('calling /register twice has no effect', async function() {
        const { AssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200,{
                'ok': true,
                'requestId': '3214'
            })
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);

        // register integration
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);

        // register integration
        await assetComputeClient.register();
        assert.ok(assetComputeClient._registered);

        // process renditions
        const response = await assetComputeClient.process({
            url: 'https://example.com/dog.jpg'
        },
        [
            {
                name: 'rendition.jpg',
                fmt: 'jpg'
            }
        ]);
        assert.strictEqual(response.requestId, '3214');
    });

    it('should fail to call /process without calling /register ', async function() {
        const { AssetComputeClient } = require('../lib/client');

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        // process renditions
        try {
            await assetComputeClient.process({
                url: 'https://example.com/dog.jpg'
            },
            [
                {
                    name: 'rendition.jpg',
                    fmt: 'jpg'
                }
            ]);
            assert.fail('Should have failed.');
        } catch (e) {
            assert.ok(e.message.includes('Must call register before calling /process'));
            assert.ok(!assetComputeClient._registered);
        }
    });

    it('should implicitely call /register using createAssetComputeClient', async function() {
        const { createAssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200,{
                'ok': true,
                'requestId': '3214'
            })

        const assetComputeClient = await createAssetComputeClient(DEFAULT_INTEGRATION);
        // process renditions
        const response = await assetComputeClient.process({
                url: 'https://example.com/dog.jpg'
            },
            [
                {
                    name: 'rendition.jpg',
                    fmt: 'jpg'
                }
        ]);
        assert.strictEqual(response.requestId, '3214');
        assert.ok(assetComputeClient._registered);
    });

    it('should fail calling /unregister without calling /register first', async function() {
        const { AssetComputeClient } = require('../lib/client');

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(404,{
                'ok': true
            })
        try {
            await assetComputeClient.unregister();
            assert.fail('Should have failed');
        } catch (e) {
            assert.ok(e.message.includes('404'));
        }
    });

    it('should call `close()` when finished with asset compute client', async function() {
        const { AssetComputeClient } = require('../lib/client');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            })
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200,{
                'ok': true,
                'requestId': '3214'
            })

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        await assetComputeClient.register();
       // process renditions
       const response = await assetComputeClient.process({
            url: 'https://example.com/dog.jpg'
        },
        [
            {
                name: 'rendition.jpg',
                fmt: 'jpg'
            }
        ]);
        assert.ok(assetComputeClient._registered);
        assert.strictEqual(response.requestId, '3214');
        await assetComputeClient.close();
    });

});
