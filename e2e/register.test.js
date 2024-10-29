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

const { AssetComputeClient, getIntegrationConfiguration } = require("../index.js");
require("dotenv").config();

describe('e2e', () => {
    it('register', async function () {
        // set process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH as path of the OAuth 
        // integration. for instance 359WhiteTern-274796-OAuth Server-to-Server.json
        const integration = await getIntegrationConfiguration();
        const assetCompute = new AssetComputeClient(integration);
        await assetCompute.register();
        await assetCompute.close();
    }).timeout(60000);
});