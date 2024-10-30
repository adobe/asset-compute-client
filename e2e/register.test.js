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
    let assetCompute;

    before(async function() {
        // set process.env.ASSET_COMPUTE_INTEGRATION_FILE_PATH as path of the OAuth 
        // integration. for instance 359WhiteTern-274796-OAuth Server-to-Server.json
        const integration = await getIntegrationConfiguration();
        assetCompute = new AssetComputeClient(integration);
    });
    it('register', async function () {
        const registerResp = await assetCompute.register();
        console.log('registerResp >>', registerResp);
        await assetCompute.close();
    }).timeout(60000);

    it('process', async function () {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        
        // add wait time for events provider to set up
        await sleep(45000); // 30s

        const { requestId } = await assetCompute.process(
            {url: 'data:text/html;base64,PHA+VGhpcyBpcyBteSBjb250ZW50IGZyYWdtZW50LiBXaGF0J3MgZ29pbmcgb24/PC9wPgo='}, [
                {
                    name: "rendition.png",
                    url: "https://presigned-target-url",
                    fmt: "png",
                    width: 200,
                    height: 200
                }
            ]
        );
        console.log('requestId >>', requestId);
        const events = await assetCompute.waitActivation(requestId);
        if (events[0].type === "rendition_created") {
            console.log("rendition created");
        } else {
            console.log("rendition failure");
        }
        await assetCompute.close();
    }).timeout(120000);
});