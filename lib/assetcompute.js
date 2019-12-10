/*************************************************************************
* ADOBE CONFIDENTIAL
* ___________________
*
* Copyright 2019 Adobe
* All Rights Reserved.
*
* NOTICE: All information contained herein is, and remains
* the property of Adobe and its suppliers, if any. The intellectual
* and technical concepts contained herein are proprietary to Adobe
* and its suppliers and are protected by all applicable intellectual
* property laws, including trade secret and copyright laws.
* Dissemination of this information or reproduction of this material
* is strictly forbidden unless prior written permission is obtained
* from Adobe.
**************************************************************************/ 

"use strict";

const fetch = require("node-fetch");
const ASSET_COMPUTE_PROD_URL = "https://asset-compute.adobe.io";

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
     * @property {Number} [interval=] Override interval at which to poll I/O events (optional)
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
        const response = await fetch(`${this.url}/register`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${this.accessToken}`,
                "x-gw-ims-org-id": this.org,
                "x-ims-org-id": this.org,
                "x-api-key": this.apiKey
            }
        });
        if (!response.ok) {
            const msg = await response.text();
            throw Error(`Unable to invoke /register: ${response.status} ${msg}`);
        } else {
            return response.json();
        }
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
     * @returns {AssetComputeProcessResponse} Response with the activation id
     */
    async process(source, renditions, userData) {
        if (Array.isArray(source)) {
            userData = renditions;
            renditions = source;
            source = undefined;
        }
        const response = await fetch(`${this.url}/process`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${this.accessToken}`,
                "x-gw-ims-org-id": this.org,
                "x-ims-org-id": this.org,
                "x-api-key": this.apiKey,
                "content-type": "application/json"
            },
            body: JSON.stringify({
                // TODO: providing source name, and size confuses nui so just provide the url
                source: (source && source.url) || source,
                renditions,
                userData
            })
        });
        if (!response.ok) {
            const msg = await response.text();
            throw Error(`Unable to invoke /process: ${response.status} ${msg}`);
        } else {
            return response.json();
        }
    }

}

module.exports = {
    AssetCompute
}
