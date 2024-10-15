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
const path = require('path');

const IntegrationConfiguration = require(`../lib/integrationConfiguration`);

const plainTextFile = path.join(process.cwd(), "test", "resources/plain-text-file.txt");
const yamlFile = path.join(process.cwd(), "test", "resources/integration.yaml");
const jsonFile = path.join(process.cwd(), "test", "resources/integration.json");
const jsonFileOAuthS2S = path.join(process.cwd(), "test", "resources/oauthServerToServer.json");
const privateKeyFile = path.join(process.cwd(), "test", "resources/privatekey.pem");

describe('integrationConfiguration.js tests', () => {

    describe('YAML Input', () => {

        const expectedYaml = {
            metascopes: ['Meta Scope 1', 'Meta Scope 2', 'Meta Scope 3'],
            technicalAccount: {
                id: 'Tech Id',
                org: 'IMS Org Id',
                clientId: 'Client Id',
                clientSecret: 'Client Secret',
                privateKey: new RegExp(/-----BEGIN PRIVATE KEY-----\r?\n-----END PRIVATE KEY-----\r?\n/)
            }
        };

        it('Input file is YAML', async () => {
            const actual = await IntegrationConfiguration.getIntegrationConfiguration(yamlFile);

            assert.strictEqual(actual.metascopes[0], expectedYaml.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedYaml.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedYaml.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedYaml.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedYaml.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedYaml.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedYaml.technicalAccount.clientSecret);
            assert.strictEqual(expectedYaml.technicalAccount.privateKey.test(actual.technicalAccount.privateKey), true);
        });

        it('Input file is YAML - ASSET_COMPUTE_INTEGRATION_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = yamlFile;
            const actual = await IntegrationConfiguration.getIntegrationConfiguration();

            assert.strictEqual(actual.metascopes[0], expectedYaml.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedYaml.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedYaml.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedYaml.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedYaml.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedYaml.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedYaml.technicalAccount.clientSecret);
            assert.strictEqual(expectedYaml.technicalAccount.privateKey.test(actual.technicalAccount.privateKey), true);
        });

        it('Input file is missing properties', async () => {
            const yamlFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.yaml");
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(yamlFile),
                expected
            );
        });

        it('Input file is neither JSON nor YAML', async () => {
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(plainTextFile),
                expected
            );
        });

        it('Input file does not exist', async () => {
            const expected = {
                constructor: Error,
                message: "Missing required files"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration("fake-file.file"),
                expected
            );
        });

        it('Input file does not exist - ASSET_COMPUTE_INTEGRATION_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = "fake-file.file";
            const expected = {
                constructor: Error,
                message: "Missing required files"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(),
                expected
            );
        });
    });

    describe('JSON Input', () => {

        const expectedJson = {
            metascopes: ['Meta Scope 1', 'Meta Scope 2', 'Meta Scope 3'],
            technicalAccount: {
                id: 'Tech Id',
                org: 'IMS Org Id',
                clientId: 'Client Id',
                clientSecret: 'Client Secret',
                privateKey: new RegExp(/PRIVATE KEY FILE\r?\n/)
            }
        };

        it('Input file is JSON', async () => {
            const actual = await IntegrationConfiguration.getIntegrationConfiguration(jsonFile, privateKeyFile);

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(expectedJson.technicalAccount.privateKey.test(actual.technicalAccount.privateKey), true);
        });

        it('Input file is JSON - ASSET_COMPUTE_INTEGRATION_FILE_PATH & ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = jsonFile;
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
            const actual = await IntegrationConfiguration.getIntegrationConfiguration();

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(expectedJson.technicalAccount.privateKey.test(actual.technicalAccount.privateKey), true);
        });

        it('Input file is JSON - ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
            const actual = await IntegrationConfiguration.getIntegrationConfiguration(jsonFile);

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(expectedJson.technicalAccount.privateKey.test(actual.technicalAccount.privateKey), true);
        });

        it('Input file is missing properties', async () => {
            const jsonFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.json");
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(jsonFile, privateKeyFile),
                expected
            );
        });

        it('Input file is neither JSON nor YAML', async () => {
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(plainTextFile, privateKeyFile),
                expected
            );
        });

        it('Private key file does not exist', async () => {
            const expected = {
                constructor: Error,
                message: "Missing required files"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(jsonFile, "fake-file.file"),
                expected
            );
        });

        it('Private key file does not exist - ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = "fake-file.file";
            const expected = {
                constructor: Error,
                message: 'Missing required files'
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(jsonFile),
                expected
            );
        });
    });

    describe('OAuth S2S JSON Input', () => {

        const expectedJson = {
            SCOPES: [
                "openid",
                "AdobeID",
                "read_organizations",
                "asset_compute",
                "event_receiver",
                "adobeio_api",
                "session",
                "additional_info",
                "additional_info.projectedProductContext",
                "additional_info.roles",
                "read_client_secret",
                "manage_client_secrets",
                "event_receiver_api"
            ],
            ORG_ID: "test-org@AdobeOrg",
            CLIENT_SECRETS: [
                "test-client-secret"
            ],
            CLIENT_ID: "test-client-id",
            TECHNICAL_ACCOUNT_ID: "test-tech-account-id",
            TECHNICAL_ACCOUNT_EMAIL: "test-tech-account-email"
        };

        it('Input file is JSON', async () => {
            const actual = await IntegrationConfiguration.getIntegrationConfiguration(jsonFileOAuthS2S);

            assert.strictEqual(actual.SCOPES[0], expectedJson.SCOPES[0]);
            assert.strictEqual(actual.SCOPES[1], expectedJson.SCOPES[1]);
            assert.strictEqual(actual.SCOPES[2], expectedJson.SCOPES[2]);

            assert.strictEqual(actual.ORG_ID, expectedJson.ORG_ID);
            assert.strictEqual(actual.CLIENT_SECRETS[0], expectedJson.CLIENT_SECRETS[0]);
            assert.strictEqual(actual.CLIENT_ID, expectedJson.CLIENT_ID);
            assert.strictEqual(actual.TECHNICAL_ACCOUNT_ID, expectedJson.TECHNICAL_ACCOUNT_ID);
            assert.strictEqual(actual.TECHNICAL_ACCOUNT_EMAIL, expectedJson.TECHNICAL_ACCOUNT_EMAIL);
            assert.strictEqual(actual.TYPE, "oauthservertoserver");
            
        });

        it('Input file is JSON - ASSET_COMPUTE_INTEGRATION_FILE_PATH & ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH are set', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = jsonFile;
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
            const actual = await IntegrationConfiguration.getIntegrationConfiguration(jsonFileOAuthS2S);

            assert.strictEqual(actual.SCOPES[0], expectedJson.SCOPES[0]);
            assert.strictEqual(actual.SCOPES[1], expectedJson.SCOPES[1]);
            assert.strictEqual(actual.SCOPES[2], expectedJson.SCOPES[2]);

            assert.strictEqual(actual.ORG_ID, expectedJson.ORG_ID);
            assert.strictEqual(actual.CLIENT_SECRETS[0], expectedJson.CLIENT_SECRETS[0]);
            assert.strictEqual(actual.CLIENT_ID, expectedJson.CLIENT_ID);
            assert.strictEqual(actual.TECHNICAL_ACCOUNT_ID, expectedJson.TECHNICAL_ACCOUNT_ID);
            assert.strictEqual(actual.TECHNICAL_ACCOUNT_EMAIL, expectedJson.TECHNICAL_ACCOUNT_EMAIL);
            assert.strictEqual(actual.TYPE, "oauthservertoserver");
        });

        it('Input file is missing properties', async () => {
            const s2sJsonFile = path.join(process.cwd(), "test", "resources/oauthServerToServer-missing-properties.json");
            const expected = {
                constructor: Error,
                message: "Incomplete OAuth Server to Server configuration"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(s2sJsonFile),
                expected
            );
        });

        it('Input file is not a JSON', async () => {
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getIntegrationConfiguration(plainTextFile),
                expected
            );
        });
    });
});
