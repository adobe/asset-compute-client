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

const IntegrationConfiguration = require('../lib/integrationConfiguration.js');

const plainTextFile = path.join(process.cwd(), "test", "resources/plain-text-file.txt");
const yamlFile = path.join(process.cwd(), "test", "resources/integration.yaml");
const jsonFile = path.join(process.cwd(), "test", "resources/integration.json");
const privateKeyFile = path.join(process.cwd(), "test", "resources/privatekey.pem");

describe('integrationConfiguration.js tests', () => {

    const expected = {
        metascopes: ['Meta Scope 1', 'Meta Scope 2', 'Meta Scope 3'],
        technicalAccount: {
            id: 'Tech Id',
            org: 'IMS Org Id',
            clientId: 'Client Id',
            clientSecret: 'Client Secret',
            privateKey: '-----BEGIN PRIVATE KEY-----\n-----END PRIVATE KEY-----\n'
        }
    };

    it('Input file does not exist', async () => {

        let actual;
        const expected = new Error("Missing required files");

        try {
            await IntegrationConfiguration.getConfiguration("fake-file.file");
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);

        try {
            await IntegrationConfiguration.getConfiguration(jsonFile, "fake-file.file");
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);

        try {
            process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = "fake-file.file";
            await IntegrationConfiguration.getConfiguration(jsonFile);
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);


        try {
            process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = "fake-file.file";
            await IntegrationConfiguration.getConfiguration();
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);
    });

    it('Input file is neither JSON nor YAML', async () => {

        let actual;
        const expected = new Error("Not all integration configuration properties are present");

        try {
            await IntegrationConfiguration.getConfiguration(plainTextFile, privateKeyFile);
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);

        try {
            await IntegrationConfiguration.getConfiguration(plainTextFile);
        } catch (e) {
            console.log(e);
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);
    });

    it('Input file is YAML', async () => {

        let actual = await IntegrationConfiguration.getConfiguration(yamlFile);

        assert.strictEqual(actual.metascopes[0], expected.metascopes[0]);
        assert.strictEqual(actual.metascopes[1], expected.metascopes[1]);
        assert.strictEqual(actual.metascopes[2], expected.metascopes[2]);

        assert.strictEqual(actual.technicalAccount.id, expected.technicalAccount.id);
        assert.strictEqual(actual.technicalAccount.org, expected.technicalAccount.org);
        assert.strictEqual(actual.technicalAccount.clientId, expected.technicalAccount.clientId);
        assert.strictEqual(actual.technicalAccount.clientSecret, expected.technicalAccount.clientSecret);
        assert.strictEqual(actual.technicalAccount.privateKey, expected.technicalAccount.privateKey);


        process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = yamlFile;
        actual = await IntegrationConfiguration.getConfiguration();

        assert.strictEqual(actual.metascopes[0], expected.metascopes[0]);
        assert.strictEqual(actual.metascopes[1], expected.metascopes[1]);
        assert.strictEqual(actual.metascopes[2], expected.metascopes[2]);

        assert.strictEqual(actual.technicalAccount.id, expected.technicalAccount.id);
        assert.strictEqual(actual.technicalAccount.org, expected.technicalAccount.org);
        assert.strictEqual(actual.technicalAccount.clientId, expected.technicalAccount.clientId);
        assert.strictEqual(actual.technicalAccount.clientSecret, expected.technicalAccount.clientSecret);
        assert.strictEqual(actual.technicalAccount.privateKey, expected.technicalAccount.privateKey);
    });

    it('Input file is JSON', async () => {

        expected.technicalAccount.privateKey = "PRIVATE KEY FILE\n";
        let actual = await IntegrationConfiguration.getConfiguration(jsonFile, privateKeyFile);

        assert.strictEqual(actual.metascopes[0], expected.metascopes[0]);
        assert.strictEqual(actual.metascopes[1], expected.metascopes[1]);
        assert.strictEqual(actual.metascopes[2], expected.metascopes[2]);

        assert.strictEqual(actual.technicalAccount.id, expected.technicalAccount.id);
        assert.strictEqual(actual.technicalAccount.org, expected.technicalAccount.org);
        assert.strictEqual(actual.technicalAccount.clientId, expected.technicalAccount.clientId);
        assert.strictEqual(actual.technicalAccount.clientSecret, expected.technicalAccount.clientSecret);
        assert.strictEqual(actual.technicalAccount.privateKey, expected.technicalAccount.privateKey);


        process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH = jsonFile;
        process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
        actual = await IntegrationConfiguration.getConfiguration();

        assert.strictEqual(actual.metascopes[0], expected.metascopes[0]);
        assert.strictEqual(actual.metascopes[1], expected.metascopes[1]);
        assert.strictEqual(actual.metascopes[2], expected.metascopes[2]);

        assert.strictEqual(actual.technicalAccount.id, expected.technicalAccount.id);
        assert.strictEqual(actual.technicalAccount.org, expected.technicalAccount.org);
        assert.strictEqual(actual.technicalAccount.clientId, expected.technicalAccount.clientId);
        assert.strictEqual(actual.technicalAccount.clientSecret, expected.technicalAccount.clientSecret);
        assert.strictEqual(actual.technicalAccount.privateKey, expected.technicalAccount.privateKey);


        process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH = privateKeyFile;
        actual = await IntegrationConfiguration.getConfiguration(jsonFile);

        assert.strictEqual(actual.metascopes[0], expected.metascopes[0]);
        assert.strictEqual(actual.metascopes[1], expected.metascopes[1]);
        assert.strictEqual(actual.metascopes[2], expected.metascopes[2]);

        assert.strictEqual(actual.technicalAccount.id, expected.technicalAccount.id);
        assert.strictEqual(actual.technicalAccount.org, expected.technicalAccount.org);
        assert.strictEqual(actual.technicalAccount.clientId, expected.technicalAccount.clientId);
        assert.strictEqual(actual.technicalAccount.clientSecret, expected.technicalAccount.clientSecret);
        assert.strictEqual(actual.technicalAccount.privateKey, expected.technicalAccount.privateKey);
    });

    it('Input file is missing properties', async () => {

        const yamlFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.yaml");
        const jsonFile = path.join(process.cwd(), "test", "resources/integration-missing-properties.json");


        let actual;
        const expected = new Error(`Not all integration configuration properties are present`);

        try {
            await IntegrationConfiguration.getConfiguration(jsonFile, privateKeyFile);
        } catch (e) {
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);

        try {
            await IntegrationConfiguration.getConfiguration(yamlFile);
        } catch (e) {
            actual = e;
        }

        assert.strictEqual(actual.name, expected.name);
        assert.strictEqual(actual.message, expected.message);
    });
});
