/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */
/* eslint mocha/no-mocha-arrows: "off" */

'use strict';

const mockRequire = require('mock-require');
const assert = require('assert');
const nock = require('nock');
const { EventEmitter } = require('events');

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

describe('client-retry.js retry on 429 tests', () => {
    before(() => {
        mockRequire.stopAll();
        nock.cleanAll();
        mockRequire("@adobe/asset-compute-events-client", {
            AdobeAuth: class AdobeAuthMock {
                constructor(config) {
                    this.adobeLoginHost = config.adobeLoginHost;
                }
                async createAccessToken() {
                    return '123456';
                }
            },
            AdobeIOEvents: class AdobeIOEventsMock {
                async getEventsFromJournal(url) {
                    if(url === 'JOURNAL_NOT_READY') {
                        throw Error('get journal events failed with 500 Internal server error');
                    } else {
                        return {
                            event: {
                                type: 'rendition_created'
                            }
                        };
                    }
                }
            },
            AdobeIOEventEmitter: class AdobeIOEventEmitterMock {
                on() {
                    return {
                        event: {
                            type: 'rendition_created'
                        }
                    };
                }
                stop() { }
            }
        });
        mockRequire.reRequire('../lib/client');
        mockRequire.reRequire('../lib/client-retry');
    });

    afterEach(() => {
        mockRequire.stopAll();
        nock.cleanAll();
    });
    it('should create asset compute client with default config retry on 429s', async function () {
        const { AssetComputeClientWithRetry } = require('../lib/client-retry');
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {});

        const assetComputeClient = new AssetComputeClientWithRetry(DEFAULT_INTEGRATION);
        await assetComputeClient.initialize();
        assert.equal(assetComputeClient.max429RetryCount, 4);
    });
    it('should create asset compute client with retry on 429s and custom retry logic', async function () {
        const { AssetComputeClientWithRetry } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 10
        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {});

        const assetComputeClient = new AssetComputeClientWithRetry(DEFAULT_INTEGRATION, options);
        await assetComputeClient.initialize();
        assert.equal(assetComputeClient.max429RetryCount, 10);
    });
    it('should fail retrying calling /register on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .twice()
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        try {
            await assetComputeClient.register();
            assert.fail('Should have failed');
        } catch (error) {
            assert.strictEqual(error.message, 'Running into 429s after 2 attempts. Will not continue retrying. Try again in a few minutes.');
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /register on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        const { requestId } = await assetComputeClient.register();
        assert.strictEqual(requestId, '1234');
        assert.ok(assetComputeClient._registered);
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should fail retrying calling /unregister on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .twice()
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        try {
            await assetComputeClient.unregister();
            assert.fail('Should have failed');
        } catch (error) {
            assert.strictEqual(error.message, 'Running into 429s after 2 attempts. Will not continue retrying. Try again in a few minutes.');
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /unregister on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        const { requestId } = await assetComputeClient.unregister();
        assert.strictEqual(requestId, '4321');
        assert.ok(!assetComputeClient._registered);
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should fail retrying calling /process on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .twice()
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        try {
            // call /register before calling /process
            await assetComputeClient.register();
            assert.ok(assetComputeClient._registered);

            await assetComputeClient.process({
                url: 'https://example.com/dog.jpg'
            },
            [
                {
                    name: 'rendition.jpg',
                    fmt: 'jpg'
                }
            ]);
            assert.fail('Should have failed');
        } catch (error) {
            assert.strictEqual(error.message, 'Running into 429s after 2 attempts. Will not continue retrying. Try again in a few minutes.');
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /process on 429s', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const options = {
            max429RetryCount: 1
        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        // retries once, resulting in exactly 2 calls to /register
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 1 // 1s is the smallest amount possible
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        // call /register before calling /process
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
        assert.ok(assetComputeClient.eventEmitter);
        assert.ok(nock.isDone());
    }).timeout(5000);
});
// Should work the exact same as AssetComputeClient
// run all the AssetComputeClient tests here using AssetComputeRetry
describe('client.js tests run with AssetComputeClientWithRetry', () => {
    before(() => {
        mockRequire.stopAll();
        nock.cleanAll();
        mockRequire("@adobe/asset-compute-events-client", {
            AdobeAuth: class AdobeAuthMock {
                constructor(config) {
                    this.adobeLoginHost = config.adobeLoginHost;
                }
                async createAccessToken() {
                    return '123456';
                }
            },
            AdobeIOEvents: class AdobeIOEventsMock {
                async getEventsFromJournal(url) {
                    if(url === 'JOURNAL_NOT_READY') {
                        throw Error('get journal events failed with 500 Internal server error');
                    } else {
                        return {
                            event: {
                                type: 'rendition_created'
                            }
                        };
                    }
                }
            },
            AdobeIOEventEmitter: class AdobeIOEventEmitterMock {
                on() {
                    return {
                        event: {
                            type: 'rendition_created'
                        }
                    };
                }
                stop() { }
            }
        });
        mockRequire.reRequire('../lib/client');
        mockRequire.reRequire('../lib/client-retry');
    });

    afterEach(() => {
        mockRequire.stopAll();
        nock.cleanAll();
    });
    it('[AssetComputeClientWithRetry] should create asset compute client with ims endpoint in options', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const integration = {
            applicationId: 72515,
            consumerId: 105979,
            metascopes: ['event_receiver_api', 'ent_adobeio_sdk', 'asset_compute_meta'],
            technicalAccount: {
                id: 'id',
                org: 'org',
                clientId: 'clientId',
                clientSecret: 'clientSecret',
                privateKey: 'privateKey'
            }
        };
        const options = {
            retryOptions: {
                retryMaxDuration: 1000
            },
            imsEndpoint: 'https://ims-na1-stage.adobelogin.com'
        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {});
        const assetComputeClient = new AssetComputeClient(integration, options);
        await assetComputeClient.initialize();
        assert.ok(assetComputeClient.auth);
        assert.equal(assetComputeClient.auth.adobeLoginHost, 'https://ims-na1-stage.adobelogin.com');
        assert.equal(assetComputeClient.assetCompute.retryOptions.retryMaxDuration, 1000);
    });
    it('[AssetComputeClientWithRetry] should fail to create asset compute client with missing integration', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        try {
            new AssetComputeClient();
        } catch (e) {
            assert.ok(e.message.includes('Asset Compute integration'));
        }
    });
    it('[AssetComputeClientWithRetry] should call /register and then /unregister', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        await assetComputeClient.register();
        const { requestId } = await assetComputeClient.unregister();
        assert.strictEqual(requestId, '4321');
    });

    it('[AssetComputeClientWithRetry] should call /register, /process, then /unregister', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });
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

    it('[AssetComputeClientWithRetry] should call /register, /process, then /unregister multiple times', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });
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

    it('[AssetComputeClientWithRetry] calling /register twice has no effect', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });
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

    it('[AssetComputeClientWithRetry] should fail to call /process without calling /register ', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

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

    it('[AssetComputeClientWithRetry] should implicitely call /register using AssetComputeClient.create()', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });

        const assetComputeClient = await AssetComputeClient.create(DEFAULT_INTEGRATION);
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
        assert.ok(nock.isDone());
    });

    it('[AssetComputeClientWithRetry] should fail calling /unregister without calling /register first', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(404, {
                'ok': true
            });
        try {
            await assetComputeClient.unregister();
            assert.fail('Should have failed');
        } catch (e) {
            assert.ok(e.message.includes('404'));
        }
    });

    it('[AssetComputeClientWithRetry] should fail /process after calling /unregister', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200, {
                'ok': true,
                'requestId': '4321'
            });

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        await assetComputeClient.register();
        await assetComputeClient.unregister();
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

    it('[AssetComputeClientWithRetry] should call `close()` when finished with asset compute client', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });

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

    it('[AssetComputeClientWithRetry] should throw error if event provider journal is not ready', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        assetComputeClient.journal = 'JOURNAL_NOT_READY';
        const isReady = await assetComputeClient.isEventJournalReady();
        assert.ok(!isReady);
        await assetComputeClient.close();
    });

    it('[AssetComputeClientWithRetry] should return valid event if provider ready', async function () {
        const { AssetComputeClientWithRetry: AssetComputeClient } = require('../lib/client-retry');
        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION);
        assetComputeClient.journal = 'JOURNAL_READY';
        const isReady = await assetComputeClient.isEventJournalReady();
        assert.ok(isReady);
        await assetComputeClient.close();
    });

});

describe('client.js event emitting run with AssetComputeClientWithRetry', () => {
    before(() => {
        mockRequire.stopAll();
        nock.cleanAll();
    });
    function buildEvent(event, assetComputeClient, requestId) {
        const userData = {
            assetComputeClient: {
                id: assetComputeClient.id,
                index: 0,
                length: 1
            }
        };
        event.userData = userData;
        event.rendition = event.rendition || {};
        event.rendition.userData = userData;
        event.requestId = requestId;
        return {
            event: event
        };
    }

    afterEach(function() {
        mockRequire.stopAll();
        nock.cleanAll();
    });

    it('[AssetComputeClientWithRetry] should retry on journal errors if no error listener is registered (NUI-878)', async function () {
        let ioEventEmitterMock;

        // mock underlying io events lib so we can emit our own events
        mockRequire("@adobe/asset-compute-events-client", {
            AdobeAuth: class AdobeAuthMock {
                createAccessToken() {
                    return '123456';
                }
            },
            AdobeIOEvents: class AdobeIOEventsMock {},
            AdobeIOEventEmitter: class AdobeIOEventEmitterMock extends EventEmitter {
                constructor() {
                    super();
                    ioEventEmitterMock = this;
                }
                stop() {}
            }
        });
        mockRequire.reRequire("../lib/eventemitter");
        mockRequire.reRequire("../lib/client");
        const { AssetComputeClientWithRetry } = mockRequire.reRequire('../lib/client-retry');

        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200, {
                'ok': true,
                'journal': 'https://api.adobe.io/events/organizations/journal/12345',
                'requestId': '1234'
            });
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(200, {
                'ok': true,
                'requestId': '3214'
            });

        const assetComputeClient = new AssetComputeClientWithRetry(DEFAULT_INTEGRATION);

        await assetComputeClient.register();
        const { requestId } = await assetComputeClient.process(
            {
                url: 'https://example.com/dog.jpg'
            },[{
                name: 'rendition.jpg',
                fmt: 'jpg'
            }]
        );

        const waitPromise = assetComputeClient.waitActivation(requestId, 100);

        // IMPORTANT - this test is NOT listening for 'error' events to test NUI-878
        //             hence this line below needs to stay commented out, just left for illustrational purposes
        //             we want to test with a consumer who does NOT listen for error events
        // assetComputeClient.on("error", e => console.log(e));

        // first simulate a network error
        ioEventEmitterMock.emit("error", new Error("Network issue"));

        // then simulate io event
        const event = { type: "rendition_created", custom: "Hello world" };
        ioEventEmitterMock.emit("event", buildEvent(event, assetComputeClient, requestId));

        const events = await waitPromise;
        await assetComputeClient.close();

        assert.strictEqual(events.length, 1);
        assert.strictEqual(events[0].type, "rendition_created");
        assert.strictEqual(events[0].custom, "Hello world");
    });
});