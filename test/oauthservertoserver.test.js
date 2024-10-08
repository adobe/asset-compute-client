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

const { expect } = require('chai');
const sinon = require('sinon');
const fetch = require('@adobe/node-fetch-retry');
const {
    isOAuthServerToServerIntegration,
    validateOAuthServerToServerIntegration,
    createOAuthServerToServerAccessToken
} = require('./oauthservertoserver');

describe('OAuth Server to Server Integration', () => {
    describe('isOAuthServerToServerIntegration', () => {
        it('should return true for valid OAuth Server to Server integration', () => {
            const integration = { TYPE: 'oauthservertoserver' };
            expect(isOAuthServerToServerIntegration(integration)).to.be.true;
        });

        it('should return false for invalid integration', () => {
            const integration = { TYPE: 'other' };
            expect(isOAuthServerToServerIntegration(integration)).to.be.false;
        });

        it('should return false for null integration', () => {
            expect(isOAuthServerToServerIntegration(null)).to.be.false;
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
            expect(validateOAuthServerToServerIntegration(integration)).to.be.true;
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
            expect(validateOAuthServerToServerIntegration(integration)).to.be.false;
        });

        it('should return false for null integration', () => {
            expect(validateOAuthServerToServerIntegration(null)).to.be.false;
        });
    });

    describe('createOAuthServerToServerAccessToken', () => {
        let fetchStub;

        beforeEach(() => {
            fetchStub = sinon.stub(fetch, 'default');
        });

        afterEach(() => {
            fetchStub.restore();
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
            expect(token).to.equal('access_token');
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
            } catch (error) {
                expect(error.message).to.equal('Unable to create access token, all client_secret tokens failed');
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
            } catch (error) {
                expect(error.message).to.equal('Unexpected response from IMS');
            }
        });
    });
});