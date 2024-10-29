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

"use strict";

const fetch = require("@adobe/node-fetch-retry");
const FormData = require('form-data');

/**
 * Check if an integration configuration is an OAuth Server to Server integration
 * 
 * @param {*} integration Integration configuration
 * @returns {boolean} True if the integration is an OAuth Server to Server integration
 */
function isOAuthServerToServerIntegration(integration) {
    return integration ? integration.TYPE === 'oauthservertoserver' : false;
}

/**
 * Validate an OAuth Server to Server integration configuration
 * 
 * @param {*} integration Integration configuration
 * @returns {boolean} True if the integration is a valid OAuth Server to Server integration
 */
function validateOAuthServerToServerIntegration(integration) {
    return integration ? ((typeof integration.ORG_ID === "string") &&
        Array.isArray(integration.CLIENT_SECRETS) && (integration.CLIENT_SECRETS.length > 0) &&
        (typeof integration.CLIENT_ID === "string") && 
        Array.isArray(integration.SCOPES) && (integration.SCOPES.length > 0) &&
        (typeof integration.TECHNICAL_ACCOUNT_ID === "string") &&
        (typeof integration.TECHNICAL_ACCOUNT_EMAIL === "string")) : false;
}

/**
 * Create an access token for an OAuth Server to Server integration
 * 
 * @param {*} integration Integration configuration
 * @param {string} [adobeLoginHost] IMS host to use, defaults to https://ims-na1.adobelogin.com
 * @returns {string} access token
 */
async function createOAuthServerToServerAccessToken(integration, adobeLoginHost) {
    // API: https://wiki.corp.adobe.com/display/ims/IMS+API+-+Client+Credentials+Token

    const host = adobeLoginHost || "https://ims-na1.adobelogin.com";
    const clientId = integration.CLIENT_ID;
    const scopes = integration.SCOPES.join(',');

    for (const clientSecret of integration.CLIENT_SECRETS) {
        const formData = new FormData();
        formData.append('client_secret', clientSecret);
        formData.append('grant_type', 'client_credentials');
        formData.append('scope', scopes);

        const response = await fetch(`${host}/ims/token/v4?client_id=${clientId}`, {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const json = await response.json();
            if (json && json.access_token) {
                return json.access_token;
            } else {
                throw Error("Unexpected response from IMS");
            }
        } else {
            const json = await response.json();
            if (response.status === 400 && json.error === "invalid_client" && json.error_description === "invalid client_secret parameter") {
                console.warn("Invalid client_secret, trying next one");
            } else {
                throw Error(`Unable to create access token: ${response.status} ${response.statusText} ${JSON.stringify(json)}`);
            }
        }
    }

    throw Error("Unable to create access token, all client_secret tokens failed");
}

module.exports = {
    isOAuthServerToServerIntegration,
    validateOAuthServerToServerIntegration,
    createOAuthServerToServerAccessToken
};