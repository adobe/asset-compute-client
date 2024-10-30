/*
 * Copyright 2024 Adobe. All rights reserved.
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
const sinon = require('sinon');
const {
    isOAuthServerToServerIntegration,
    validateOAuthServerToServerIntegration,
} = require('../lib/oauthservertoserver');

describe('OAuth Server to Server Integration', () => {
    describe('isOAuthServerToServerIntegration', () => {
        it('should return true for valid OAuth Server to Server integration', () => {
            const integration = { TYPE: 'oauthservertoserver' };
            assert.strictEqual(isOAuthServerToServerIntegration(integration), true);
        });

        it('should return false for invalid integration', () => {
            const integration = { TYPE: 'other' };
            assert.strictEqual(isOAuthServerToServerIntegration(integration), false);
        });

        it('should return false for null integration', () => {
            assert.strictEqual(isOAuthServerToServerIntegration(null), false);
        });
    });

    describe('validateOAuthServerToServerIntegration', () => {
        it('should return true for valid integration', () => {
            const integration = {
                ORG_ID: 'org_id',
                CLIENT_SECRETS: ['secret1'],
                CLIENT_ID: 'client_id',
                SCOPES: ['scope1'],
                TECHNICAL_ACCOUNT_ID: 'account_id',
                TECHNICAL_ACCOUNT_EMAIL: 'email@example.com'
            };
            assert.strictEqual(validateOAuthServerToServerIntegration(integration), true);
        });

        it('should return false for invalid integration', () => {
            const integration = {
                ORG_ID: 'org_id',
                CLIENT_SECRETS: [],
                CLIENT_ID: 'client_id',
                SCOPES: ['scope1'],
                TECHNICAL_ACCOUNT_ID: 'account_id',
                TECHNICAL_ACCOUNT_EMAIL: 'email@example.com'
            };
            assert.strictEqual(validateOAuthServerToServerIntegration(integration), false);
        });

        it('should return false for null integration', () => {
            assert.strictEqual(validateOAuthServerToServerIntegration(null), false);
        });
    });

    const proxyquire = require('proxyquire');

    describe('OAuth Server to Server Integration', () => {
        let fetchStub;
        let createOAuthServerToServerAccessToken;

        beforeEach(() => {
            fetchStub = sinon.stub();
            const oauthModule = proxyquire('../lib/oauthservertoserver', {
                '@adobe/node-fetch-retry': fetchStub
            });
            createOAuthServerToServerAccessToken = oauthModule.createOAuthServerToServerAccessToken;
        });

        afterEach(() => {
            sinon.restore();
        });

        it('should return access token for valid client secret', async () => {
            const integration = {
                CLIENT_ID: 'client_id',
                CLIENT_SECRETS: ['secret1'],
                SCOPES: ['scope1']
            };

            fetchStub.resolves({
                ok: true,
                json: async () => ({ access_token: 'access_token' })
            });

            const token = await createOAuthServerToServerAccessToken(integration);
            assert.strictEqual(token, 'access_token');
        });

        it('should throw error for invalid client secret', async () => {
            const integration = {
                CLIENT_ID: 'client_id',
                CLIENT_SECRETS: ['invalid_secret'],
                SCOPES: ['scope1']
            };

            fetchStub.resolves({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                json: async () => ({ error: 'invalid_client', error_description: 'invalid client_secret parameter' })
            });

            try {
                await createOAuthServerToServerAccessToken(integration);
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.strictEqual(error.message, 'Unable to create access token, all client_secret tokens failed');
            }
        });

        it('should throw error for unexpected response', async () => {
            const integration = {
                CLIENT_ID: 'client_id',
                CLIENT_SECRETS: ['secret1'],
                SCOPES: ['scope1']
            };

            fetchStub.resolves({
                ok: true,
                json: async () => ({})
            });

            try {
                await createOAuthServerToServerAccessToken(integration);
                assert.fail('Expected error was not thrown');
            } catch (error) {
                assert.strictEqual(error.message, 'Unexpected response from IMS');
            }
        });
    });
});