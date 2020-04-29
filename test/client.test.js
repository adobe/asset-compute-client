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

describe( 'client.js tests', () => {
	beforeEach( () => {
		mockRequire("@adobe/asset-compute-events-client", {
			AdobeAuth: class AdobeAuthMock {
				constructor(config) {
					assert.equal(config.adobeLoginHost, 'https://ims-na1-stage.adobelogin.com');
				}
				async createAccessToken() {
					return '123456'
				}
			},
			AdobeIOEvents: class AdobeIOEventsMock {},
			AdobeIOEventEmitter: class AdobeIOEventEmitterMock {
				on() {
					return {
						event: {
							type: 'rendition_created'
						}
					}
				}
			}
		})
	})
	afterEach( () => {
		mockRequire.stopAll();
		nock.cleanAll();
	})
	it('should create asset compute client with custom retryOptions', async function() {
		const { createAssetComputeClient } = require('../lib/client');
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
			},
			imsEndpoint: 'https://ims-na1-stage.adobelogin.com'
		}
		const options = {
			retryOptions: {
				retryMaxDuration: 2000
			}
		}
		nock('https://asset-compute.adobe.io')
			.post('/register')
			.reply(200, {})

		const assetComputeClient = await createAssetComputeClient(integration, options);
		assert.equal(assetComputeClient.assetCompute.retryOptions.retryMaxDuration, 2000);
	})

	it('should create asset compute client with ims endpoint in integration', async function() {
		const { createAssetComputeClient } = require('../lib/client');
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
			},
			imsEndpoint: 'https://ims-na1-stage.adobelogin.com'
		}
		try {
			await createAssetComputeClient(integration);
		} catch (e) { /* eslint-disable-line no-unused-vars */
			// ignore errors that happen after initialization of AdobeAuth
		}
	})

	it('should create asset compute client with ims endpoint in options', async function() {
		const { createAssetComputeClient } = require('../lib/client');
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
		}
		try {
			await createAssetComputeClient(integration, { imsEndpoint: 'https://ims-na1-stage.adobelogin.com'});
		} catch (e) { /* eslint-disable-line no-unused-vars */
			// ignore errors that happen after initialization of AdobeAuth
		}
	})
})
