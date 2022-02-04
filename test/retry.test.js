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
const rewire = require('rewire');

const DEFAULT_INTEGRATION = {
    applicationId: 72515,
    consumerId: 105979,
    metascopes: ['mocked-metascope-1', 'mocked-metascope-2', 'mocked-metascope-3'],
    technicalAccount: {
        id: 'id',
        org: 'org',
        clientId: 'clientId',
        clientSecret: 'clientSecret',
        privateKey: 'privateKey'
    },
    imsEndpoint: 'https://mocked-ims-endpoint.com'
};

describe('retry on 429 tests', () => {
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
        mockRequire.reRequire('../lib/retry');
    });

    afterEach(() => {
        mockRequire.stopAll();
        nock.cleanAll();
    });
    it('retryWaitTime tests', async function () {
        const rewiredRetry = rewire('../lib/retry');
        const retryWaitTime = rewiredRetry.__get__('retryWaitTime');

        // retry-after is passed through
        let waitTime = retryWaitTime(3);
        assert.ok( waitTime >= 3000, waitTime <= 4000);
        // retry-after is passed through in seconds and convertted to ms
        waitTime = retryWaitTime(30);
        assert.ok( waitTime >= 30000, waitTime <= 40000);
        // retry-after is undefined
        waitTime = retryWaitTime();
        assert.ok(waitTime >= 30000, waitTime <= 61000);
    });
    it('should create asset compute client with retry on 429s and custom retry logic', async function () {
        const { AssetComputeClient } = require('../lib/client');
        const options = {
            max429RetryCount: 10
        };

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        await assetComputeClient.initialize();
        assert.equal(assetComputeClient.options.max429RetryCount, 10);
    });
    it('should create asset compute client without retry on 429s', async function () {
        const { AssetComputeClient } = require('../lib/client');
        const options = {
            disable429Retry: true
        };

        const assetComputeClient = new AssetComputeClient(DEFAULT_INTEGRATION, options);
        await assetComputeClient.initialize();
        assert.equal(assetComputeClient.options.disable429Retry, true);
    });
    it('should fail retrying calling /register on 429s', async function () {
        const { AssetComputeClient } = require('../lib/client');
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
            assert.ok(error.message.includes('Too many requests'));
            assert.ok(error.message.includes('429'));
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /register on 429s', async function () {
        const { AssetComputeClient } = require('../lib/client');
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
        const { AssetComputeClient } = require('../lib/client');
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
            assert.ok(error.message.includes('Too many requests'));
            assert.ok(error.message.includes('429'));
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /unregister on 429s', async function () {
        const { AssetComputeClient } = require('../lib/client');
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
        const { AssetComputeClient } = require('../lib/client');
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
            assert.ok(error.message.includes('Too many requests'));
            assert.ok(error.message.includes('429'));
        }
        assert.ok(nock.isDone());
    }).timeout(5000);
    it('should succeed after retrying call to /process on 429s', async function () {
        const { AssetComputeClient } = require('../lib/client');
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