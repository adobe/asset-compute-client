/**
 * ADOBE CONFIDENTIAL
 * ___________________
 *
 *  Copyright 2020 Adobe
 *  All Rights Reserved.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Adobe and its suppliers, if any. The intellectual
 * and technical concepts contained herein are proprietary to Adobe
 * and its suppliers and are protected by all applicable intellectual
 * property laws, including trade secret and copyright laws.
 * Dissemination of this information or reproduction of this material
 * is strictly forbidden unless prior written permission is obtained
 * from Adobe.
 */

/* eslint-env mocha */
/* eslint mocha/no-mocha-arrows: "off" */

'use strict';

const mockRequire = require('mock-require');
const assert = require('assert');
const nock = require('nock');

describe( 'client.js tests', () => {
	beforeEach( () => {
		mockRequire("@nui/adobe-io-events-client", {
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
				org:'org',
				 clientId:'clientId',
				  clientSecret:'clientSecret',
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
				org:'org',
				 clientId:'clientId',
				  clientSecret:'clientSecret',
				  privateKey: 'privateKey'
			},
			imsEndpoint: 'https://ims-na1-stage.adobelogin.com'
		}
		try {
			await createAssetComputeClient(integration);
		} catch(e) {
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
		} catch(e) {
			// ignore errors that happen after initialization of AdobeAuth
		}
	})
})

