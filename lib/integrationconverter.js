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

const fs = require('fs-extra');
const YAML = require('json-to-pretty-yaml');

class IntegrationConverter {

    static async convert(integrationFile, privateKeyFile, outputFile='integration.yaml') {
        if (!integrationFile || !privateKeyFile) {
            throw new Error('Missing required files');
        }
        const { project } = await fs.readJSON(integrationFile);
        const privateKey = await fs.readFile(privateKeyFile, 'utf8');
    
        const json = {
            metascopes: project.workspace.details.credentials[0].jwt.meta_scopes,
            technicalAccount: {
                id: project.workspace.details.credentials[0].jwt.technical_account_id,
                org: project.org.ims_org_id,
                clientId: project.workspace.details.credentials[0].jwt.client_id,
                clientSecret: project.workspace.details.credentials[0].jwt.client_secret,
                privateKey: privateKey
            },
        };
    
        const data = YAML.stringify(json);
        fs.writeFile(outputFile, data);

    }
}

module.exports = {
    IntegrationConverter
};

