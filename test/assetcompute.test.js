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

const assert = require('assert');
const nock = require('nock');

describe( 'assetcompute.js tests', () => {
	beforeEach( () => {
	})
	afterEach( () => {
		nock.cleanAll();
	});

	it('should call asset compute /register successfully', async function() {
		const { AssetCompute } = require('../lib/assetcompute');
		const options = {
			accessToken: 'accessToken',
			org: 'org',
			apiKey: 'apiKey'

		}
		const journal = 'https://api.adobe.io/events/organizations/journal/12345';
		const requestId = '1234567890';
		nock('https://asset-compute.adobe.io')
			.post('/register')
			.reply(200,{
				'ok': true,
				'journal': journal,
				'requestId': requestId
			})

		const assetCompute = new AssetCompute(options);
		const response = await assetCompute.register();
		assert.strictEqual(response.requestId, requestId);
		assert.strictEqual(response.journal, journal)
	});

	it('should call asset compute /unregister successfully', async function() {
		const { AssetCompute } = require('../lib/assetcompute');
		const options = {
			accessToken: 'accessToken',
			org: 'org',
			apiKey: 'apiKey'

		}
		const journal = 'https://api.adobe.io/events/organizations/journal/12345';
		const requestId = '1234567890';
		nock('https://asset-compute.adobe.io')
			.post('/register')
			.reply(200,{
				'ok': true,
				'journal': journal,
				'requestId': requestId
			})
		nock('https://asset-compute.adobe.io')
			.post('/unregister')
			.reply(200,{
				'ok': true,
				'requestId': requestId
			})

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

		}
		const requestId = '1234567890';
		nock('https://asset-compute.adobe.io')
			.post('/unregister')
			.reply(404,{
				'ok': true,
				'requestId': requestId
			})

		const assetCompute = new AssetCompute(options);
		try {
			await assetCompute.unregister();
		} catch (e) {
			assert.ok(e.message.includes('404'));
		}
	});


	it('should fail calling /process', async function() {
		const { AssetCompute } = require('../lib/assetcompute');
		const options = {
			accessToken: 'accessToken',
			org: 'org',
			apiKey: 'apiKey'

		}
		const requestId = '1234567890';
		nock('https://asset-compute.adobe.io')
			.post('/process')
			.reply(401,{
				'ok': false,
				'requestId': requestId,
				'message':'unauthorized'
			})

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
			assert.fail('Should have failed')
		} catch (e) {
			assert.ok(e.message.includes('401'));
		}
	});
})