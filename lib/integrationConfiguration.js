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

'use strict';

const yaml = require('js-yaml');
const fs = require('fs-extra');

let integrationPath;
let privateKeyPath;

/**
 * Constructor for Asset Compute integration configuration
 *
 * @param {string} [integrationFile=] Configuration file path for integration (optional)
 *                                    If no file path is passed in, ENV will be checked
 * @param {string} [privateKeyFile=] Configuration file path for private key file when supplying JSON (optional)
 *                                    If no file path is passed in, ENV will be checked
 */
async function getIntegrationConfiguration(integrationFile, privateKeyFile) {

    privateKeyPath = privateKeyFile || process.env.ASSET_COMPUTE_PRIVATE_KEY_FILE_PATH;
    integrationPath = integrationFile || process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH;

    return validate();
}

async function validate() {

    if (! await fs.pathExists(integrationPath)) {
        throw new Error('Missing required files');
    }

    const data = await validateJson() || await validateYaml();
    validateData(data);
    return data;
}

function validateData(data) {
    if ((!data.metascopes || data.metascopes.length === 0)
            || (!data.technicalAccount || data.technicalAccount.length === 0)
            || !data.technicalAccount.id
            || !data.technicalAccount.org
            || !data.technicalAccount.clientId
            || !data.technicalAccount.clientSecret
            || !data.technicalAccount.privateKey
    ) {
        throw new Error("Not all integration configuration properties are present");
    }
}

async function validateJson() {
    let json;

    try {
        json = await fs.readJson(integrationPath);
    } catch (error) { // eslint-disable-line no-unused-vars
        return;
    }

    json.privateKey = await validatePrivateKeyFile();
    return mapConfiguration(json);
}

async function validateYaml() {
    try {
        return yaml.safeLoad(await fs.readFile(integrationPath, 'utf8'));
    } catch (error) { } // eslint-disable-line no-unused-vars
}

async function validatePrivateKeyFile() {
    if (! await fs.pathExists(privateKeyPath)) {
        throw new Error('Missing required files');
    }
    return fs.readFile(privateKeyPath, 'utf8');
}

function mapConfiguration(json) {
    return {
        metascopes: json.project.workspace.details.credentials[0].jwt.meta_scopes,
        technicalAccount: {
            id: json.project.workspace.details.credentials[0].jwt.technical_account_id,
            org: json.project.org.ims_org_id,
            clientId: json.project.workspace.details.credentials[0].jwt.client_id,
            clientSecret: json.project.workspace.details.credentials[0].jwt.client_secret,
            privateKey: json.privateKey
        }
    };
}

module.exports = { getIntegrationConfiguration };
