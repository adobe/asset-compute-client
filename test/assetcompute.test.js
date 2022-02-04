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

const assert = require('assert');
const nock = require('nock');
const { AssetCompute } = require('../lib/assetcompute');

describe( 'assetcompute.js tests', () => {
    beforeEach( () => {
    });
    afterEach( () => {
        nock.cleanAll();
    });

    it('should call asset compute /register successfully', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey'

        };
        const journal = 'https://api.adobe.io/events/organizations/journal/12345';
        const requestId = '1234567890';
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': journal,
                'requestId': requestId
            });

        const assetCompute = new AssetCompute(options);
        const response = await assetCompute.register();
        assert.strictEqual(response.requestId, requestId);
        assert.strictEqual(response.journal, journal);
    });
    it('should fail calling asset compute /register with 401', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey'

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(401,{
                ok: false,
                message:'Unauthorized'
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            // make sure it didn't become a custom `TooManyRequestsError`
            assert.ok(error.code !== 429);
            assert.strictEqual(error.message, 'Unable to invoke /register: 401 {"ok":false,"message":"Unauthorized"}');
        }
    });
    it('should fail without retry when asset compute /register hits 429', async function() {
        // TODO, add option to not retry on 429
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 3
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /register: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}');
            assert.strictEqual(error.retryAfter, 3);
        }
    });
    it('should fail hitting 429 without retry (retry-after header is a date)', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': new Date(Date.now() + 50000)
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /register: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}');
            // should be around 50s so we just check it is above the default, 1s 
            assert.ok(error.retryAfter > 1);
        }
    });
    it('should fail hitting 429 without retry (retry-after header is a date in the past)', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': new Date(Date.now() - 50000)
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /register: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}');
            // should be a date in the past, making the retryAfter amount the minimum: 1s 
            assert.strictEqual(error.retryAfter, 1);
        }
    });
    it('should fail hitting 429 without retry (retry-after header is an invalid number and date)', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 'Not a real date or number'
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /register: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}'); 
            assert.strictEqual(error.retryAfter, undefined);
        }
    });
    it('should fail hitting 429 without retry (retry-after header missing)', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.register();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /register: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}');
            assert.strictEqual(error.retryAfter, undefined);
        }
    });

    it('should call asset compute /unregister successfully', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey'
        };
        const journal = 'https://api.adobe.io/events/organizations/journal/12345';
        const requestId = '1234567890';
        nock('https://asset-compute.adobe.io')
            .post('/register')
            .reply(200,{
                'ok': true,
                'journal': journal,
                'requestId': requestId
            });
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(200,{
                'ok': true,
                'requestId': requestId
            });

        const assetCompute = new AssetCompute(options);
        await assetCompute.register();
        const response = await assetCompute.unregister();
        assert.strictEqual(response.requestId, requestId);
    });

    it('should fail call asset compute /unregister before calling /register', async function() {
        const { AssetCompute } = require('../lib/assetcompute');
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey'

        };
        const requestId = '1234567890';
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(404,{
                'ok': true,
                'requestId': requestId
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.unregister();
        } catch (e) {
            assert.ok(e.message.includes('404'));
        }
    });

    it('should fail with asset compute /unregister hits 429', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true

        };
        nock('https://asset-compute.adobe.io')
            .post('/unregister')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 3
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.unregister();
        } catch (error) {
            assert.strictEqual(error.code, 429);
            assert.strictEqual(error.name, 'TooManyRequestsError');
            assert.strictEqual(error.message, 'Unable to invoke /unregister: 429: {"ok":false,"error_code":"429050","message":"Too many requests"} (details: {"size":0,"timeout":30000})');
            assert.strictEqual(error.retryAfter, 3);
        }
    });

    it('should fail calling /process with 401', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey'
        };
        const requestId = '1234567890';
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(401,{
                'ok': false,
                'requestId': requestId,
                'message':'unauthorized'
            });

        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.process({
                url: 'https://example.com/dog.jpg'
            },
            [
                {
                    name: 'rendition.jpg',
                    fmt: 'jpg'
                }
            ]);
            assert.fail('Should have failed');
        } catch (e) {
            assert.ok(e.message.includes('401'));
        }
    });
    it('should fail calling /process with 429', async function() {
        const options = {
            accessToken: 'accessToken',
            org: 'org',
            apiKey: 'apiKey',
            disable429Retry: true
        };
        nock('https://asset-compute.adobe.io')
            .post('/process')
            .reply(429,{
                ok: false,
                error_code:'429050',
                message:'Too many requests'
            }, {
                'retry-after': 3
            });


        const assetCompute = new AssetCompute(options);
        try {
            await assetCompute.process({
                url: 'https://example.com/dog.jpg'
            },
            [
                {
                    name: 'rendition.jpg',
                    fmt: 'jpg'
                }
            ]);
            assert.fail('Should have failed');
        } catch (e) {
            assert.strictEqual(e.code, 429);
            assert.strictEqual(e.name, 'TooManyRequestsError');
            assert.strictEqual(e.message, 'Unable to invoke /process: 429 {"ok":false,"error_code":"429050","message":"Too many requests"}');
            assert.strictEqual(e.retryAfter, 3);
        }
    });
});
