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

"use strict";

const fetch = require("@adobe/node-fetch-retry");
const { TooManyRequestsError } = require('./error');
const ASSET_COMPUTE_PROD_URL = "https://asset-compute.adobe.io";
const { retry } = require("./retry");
const clone = require('clone');

/**
 * @typedef {Object} AssetComputeSource
 * @property {String} url URL pointing to the source binary. Supports AWS/Azure pre-signed URLs.
 * @property {String} name File name. File extension in the name might be used if no mime type can be detected. Takes precedence over filename in URL path or filename in content-disposition header of the binary resource. Defaults to "file".
 * @property {Number} size File size. Takes precedence over content-length header of the binary resource.
 * @property {String} mimetype Mime type. Takes precedence over the content-type header of the binary resource.
 */
/**
 * @typedef {Object} AssetComputeTarget
 * @property {String[]} urls array of strings, one for each pre-signed part URL
 * @property {Number} minPartSize the minimum size to use for one part = url
 * @property {Number} maxPartSize the maximum size to use for one part = url
 */
/**
 * @typedef {Object} AssetComputeDpi
 * @property {Number} xdpi X resolution (in dots/inch, e.g. 96)
 * @property {Number} ydpi Y resolution (in dots/inch, e.g. 96)
 */
/**
 * @typedef {Object} AssetComputeRendition
 * @property {String} name Filename of the rendition to create
 * @property {String} fmt Target format, can also be `text` for text extraction and `xmp` for extracting XMP metadata as xml.
 * @property {String|AssetComputeTarget} target URL or multi-part target where to store the generated rendition
 * @property {Number} wid Width in pixels, only for image renditions
 * @property {Number} hei Height in pixels, only for image renditions
 * @property {Number} qlt Specify JPEG quality, in the range of 0 to 100. Only for image renditions.
 * @property {String} xmp Used only by XMP metadata writeback, contains the base64 encoded XMP that needs to be written back.
 * @property {Boolean} interlace If true creates an interlaced PNG or GIF, or progressive JPEG. Has no effect on other formats.
 * @property {Number} jpegSize Approximate size of JPEG file in bytes. Overrides the `qlt` setting.
 * @property {Number|AssetComputeDpi} dpi X and Y dpi to set, a single number will set both X and Y dpi to the same value
 * @property {Number|AssetComputeDpi} convertToDpi X and Y dpi to resample to while maintaining physical size, a single number will set both X and Y dpi to the same value
 * @property {String} worker (advanced) use instead of `fmt` to reference a custom worker
 */
class AssetCompute {

    /**
     * @typedef {Object} AssetComputeOptions
     * @property {String} accessToken JWT access token
     * @property {String} org IMS organization
     * @property {String} apiKey API key used to communicate with Asset Compute
     * @property {String} [url=] Asset Compute url (defaults to https://asset-compute.adobe.io)
     * @property {Number} [interval=] Override interval at which to poll I/O events
     * @property {Object} [retryOptions=] Fetch retry options for `@adobe/node-fetch-retry` See README.md for more information
     */
    /**
     * Construct Asset Compute client
     *
     * @param {AssetComputeOptions} options Options
     */
    constructor(options) {
        this.accessToken = options.accessToken;
        this.org = options.org;
        this.apiKey = options.apiKey;
        this.url = options.url || ASSET_COMPUTE_PROD_URL;
        this.interval = options.interval;
        // retry options for node-fetch-retry
        this.retryOptions = options.retryOptions || true; // default retry options
        // custom retry options for 429 retry logic
        this.max429RetryCount = options.max429RetryCount;
        this.disable429Retry = options.disable429Retry;
    }

    /**
     * @typedef {Object} AssetComputeRegisterResponse
     *
     * @property {String} journal Journal URL to use with AssetComputeEventEmitter
     */
    /**
     * Register I/O events and journal
     *
     * @returns {AssetComputeRegisterResponse} Journal url
     */
    async register() {
        return retry(async(self) => {
            const response = await fetch(`${self.url}/register`, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${self.accessToken}`,
                    "x-gw-ims-org-id": self.org,
                    "x-ims-org-id": self.org,
                    "x-api-key": self.apiKey
                },
                retryOptions: self.retryOptions
            });
            if (!response.ok) {
                const responseText = await response.text();
                const message = `Unable to invoke /register: ${response.status} ${responseText}`;
                handleHttpResponseNotOk(response, message);
            } else {
                return response.json();
            }
        }, clone(this)); // to avoid `retry` changing `this`
    }

    /**
     * Unregister I/O events and journal
     */
    async unregister() {
        return retry(async(self) => {
            const response = await fetch(`${self.url}/unregister`, {
                method: "POST",
                headers: {
                    authorization: `Bearer ${self.accessToken}`,
                    "x-gw-ims-org-id": self.org,
                    "x-ims-org-id": self.org,
                    "x-api-key": self.apiKey
                },
                retryOptions: self.retryOptions
            });
            if (!response.ok) {
                const responseText = await response.text();
                const message = `Unable to invoke /unregister: ${response.status}: ${responseText} (details: ${JSON.stringify(response)})`;
                handleHttpResponseNotOk(response, message);
            } else {
                return response.json();
            }
        }, clone(this)); // to avoid `retry` changing `this`
    }

    /**
     * @typedef {Object} AssetComputeProcessResponse
     *
     * @property {String} activationId Activation Identifier
     */
    /**
     * Asynchronously process an asset. The result is returned as an event
     * emitted from AssetComputeEventEmitter.
     *
     * @param {AssetComputeSource|String} [source=] Source asset, may be null or undefined
     * @param {AssetComputeRendition[]} renditions Requested renditions
     * @param {Object} userData User data associated with the request
     * @param {Object} headers Headers for the request
     * @returns {AssetComputeProcessResponse} Response with the activation id
     */
    async process(source, renditions, userData, headers) {
        const options = {
            source,
            renditions,
            userData,
            url: this.url,
            accessToken: this.accessToken,
            org: this.org,
            apiKey: this.apiKey,
            retryOptions: this.retryOptions,
            max429RetryCount: this.max429RetryCount,
            disable429Retry: this.disable429Retry,
            headers
        };

        return retry(async(options) => {
            if (Array.isArray(source)) {
                userData = renditions;
                renditions = source;
                source = undefined;
            }
            const response = await fetch(`${options.url}/process`, {
                method: "POST",
                headers: {
                    ...options.headers,
                    authorization: `Bearer ${options.accessToken}`,
                    "x-gw-ims-org-id": options.org,
                    "x-ims-org-id": options.org,
                    "x-api-key": options.apiKey,
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    source: options.source,
                    renditions: options.renditions,
                    userData: options.userData
                }),
                retryOptions: options.retryOptions
            });
            if (!response.ok) {
                const responseText = await response.text();
                const message = `Unable to invoke /process: ${response.status} ${responseText}`;
                handleHttpResponseNotOk(response, message);
            } else {
                return response.json();
            }
        }, options);
    }

}
/**
     * Small helper function to handle HTTP response not OK
     * @param {*} response http response
     * @param {*} errorMessage error message to throw
     */
function handleHttpResponseNotOk(response, errorMessage) {
    if (response.status === 429) {
        throw new TooManyRequestsError(errorMessage, response.headers.get('retry-after'));

    }
    throw new Error(errorMessage);
}

module.exports = {
    AssetCompute
};
