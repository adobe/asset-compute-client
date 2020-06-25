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
                privateKey: '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n'
            }
        };

        it('Input file is YAML', async () => {
            const actual = await IntegrationConfiguration.getConfiguration(yamlFile);

            assert.strictEqual(actual.metascopes[0], expectedYaml.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedYaml.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedYaml.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedYaml.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedYaml.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedYaml.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedYaml.technicalAccount.clientSecret);
            assert.strictEqual(actual.technicalAccount.privateKey, expectedYaml.technicalAccount.privateKey);
        });

        it('Input file is YAML - ASSET_COMPUTE_INTEGRATION_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = yamlFile;
            const actual = await IntegrationConfiguration.getConfiguration();

            assert.strictEqual(actual.metascopes[0], expectedYaml.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedYaml.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedYaml.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedYaml.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedYaml.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedYaml.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedYaml.technicalAccount.clientSecret);
            assert.strictEqual(actual.technicalAccount.privateKey, expectedYaml.technicalAccount.privateKey);
        });

        it('Input file is missing properties', async () => {
            const yamlFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.yaml");
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration(yamlFile),
                expected
            );
        });

        it('Input file is neither JSON nor YAML', async () => {
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration(plainTextFile),
                expected
            );
        });

        it('Input file does not exist', async () => {
            const expected = {
                constructor: Error,
                message: "Missing required files"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration("fake-file.file"),
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
                () => IntegrationConfiguration.getConfiguration(),
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
                privateKey: 'PRIVATE KEY FILE\n'
            }
        };

        it('Input file is JSON', async () => {
            const actual = await IntegrationConfiguration.getConfiguration(jsonFile, privateKeyFile);

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(actual.technicalAccount.privateKey, expectedJson.technicalAccount.privateKey);
        });

        it('Input file is JSON - ASSET_COMPUTE_INTEGRATION_FILE_PATH & ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = jsonFile;
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
            const actual = await IntegrationConfiguration.getConfiguration();

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(actual.technicalAccount.privateKey, expectedJson.technicalAccount.privateKey);
        });

        it('Input file is JSON - ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH', async () => {
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
            const actual = await IntegrationConfiguration.getConfiguration(jsonFile);

            assert.strictEqual(actual.metascopes[0], expectedJson.metascopes[0]);
            assert.strictEqual(actual.metascopes[1], expectedJson.metascopes[1]);
            assert.strictEqual(actual.metascopes[2], expectedJson.metascopes[2]);

            assert.strictEqual(actual.technicalAccount.id, expectedJson.technicalAccount.id);
            assert.strictEqual(actual.technicalAccount.org, expectedJson.technicalAccount.org);
            assert.strictEqual(actual.technicalAccount.clientId, expectedJson.technicalAccount.clientId);
            assert.strictEqual(actual.technicalAccount.clientSecret, expectedJson.technicalAccount.clientSecret);
            assert.strictEqual(actual.technicalAccount.privateKey, expectedJson.technicalAccount.privateKey);
        });

        it('Input file is missing properties', async () => {
            const jsonFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.json");
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration(jsonFile, privateKeyFile),
                expected
            );
        });

        it('Input file is neither JSON nor YAML', async () => {
            const expected = {
                constructor: Error,
                message: "Not all integration configuration properties are present"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration(plainTextFile, privateKeyFile),
                expected
            );
        });

        it('Private key file does not exist', async () => {
            const expected = {
                constructor: Error,
                message: "Missing required files"
            };

            await assert.rejects(
                () => IntegrationConfiguration.getConfiguration(jsonFile, "fake-file.file"),
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
                () => IntegrationConfiguration.getConfiguration(jsonFile),
                expected
            );
        });
    });
});
