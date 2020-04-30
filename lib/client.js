/*
Copyright 2020 Adobe. All rights reserved.
This file is licensed to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License. You may obtain a copy
of the License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under
the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
OF ANY KIND, either express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

"use strict";

const EventEmitter = require("events");
const uuid = require("uuid/v1");
const { AdobeAuth } = require("@adobe/asset-compute-events-client");
const { AssetCompute } = require("./assetcompute");
const { AssetComputeEventEmitter } = require("./eventemitter");

function getAssetComputeClientId(event) {
    return event.userData &&
        event.userData.assetComputeClient &&
        event.userData.assetComputeClient.id;
}

function completePendingRendition(client) {
    client.pendingRenditions -= 1;
    if (client.pendingRenditions < 0) {
        client.emit(
            "error",
            Error(`Internal error, pendingRenditions < 0: ${client.pendingRenditions}`)
        );
    } else if (client.pendingRenditions === 0) {
        client.emit("drained")
    }
}

function completeClientEvent(activationId, event, context) {
    if (event.requestId !== activationId) {
        return;
    }

    // determine index
    const userData = event &&
        event.rendition &&
        event.rendition.userData &&
        event.rendition.userData.assetComputeClient &&
        event.rendition.userData.assetComputeClient;

    if (!userData) {
        throw Error(`Request ${activationId}, expect userData with rendition: ${JSON.stringify(event)}`)
    }
    if (typeof userData.index !== 'number') {
        throw Error(`Request ${activationId}, expect index with rendition: ${JSON.stringify(event)}`)
    }
    if (typeof userData.length !== 'number') {
        throw Error(`Request ${activationId}, expect length with rendition: ${JSON.stringify(event)}`)
    }

    // initialize
    if (!context.pendingEvents) {
        context.pendingEvents = userData.length;
        context.events = new Array(userData.length);
    }

    if (!context.events[userData.index]) {
        context.events[userData.index] = event;
    } else {
        throw Error(`Request ${activationId}, duplicate event: ${JSON.stringify(event)}, previous: ${JSON.stringify(context.events[userData.index])}`);
    }

    // completed an event successfully
    --context.pendingEvents;
}

/**
 * Event fired for each event in the Adobe I/O event journal
 *
 * @event AssetCompute#rendition_created
 * @type {AssetComputeRenditionCreatedEvent}
 */
/**
 * Event fired for each event in the Adobe I/O event journal
 *
 * @event AssetCompute#rendition_failed
 * @type {AssetComputeRenditionFailedEvent}
 */
/**
 * Error event fired on polling failure, will cause polling to start from journalUrl
 *
 * @event AssetCompute#error
 * @type {Error}
 */
class AssetComputeClient extends EventEmitter {

    /**
     * Construct Asset Compute client
     *
     * @param {AssetCompute} assetCompute Asset Compute instance
     * @param {AssetComputeEventEmitter} eventEmitter Asset Compute event emitter
     */
    constructor(assetCompute, eventEmitter) {
        super();
        this.assetCompute = assetCompute;
        this.eventEmitter = eventEmitter;

        // event forwarding
        const self = this;
        this.eventEmitter.on('rendition_created', event => {
            if (getAssetComputeClientId(event) === self.id) {
                completePendingRendition(self);
                self.emit("rendition_created", event);
            }
        });
        this.eventEmitter.on('rendition_failed', event => {
            if (getAssetComputeClientId(event) === self.id) {
                completePendingRendition(self);
                self.emit("rendition_failed", event);
            }
        });
        this.eventEmitter.on('error', error => self.emit("error", error));

        // identifier uniquely identifying us
        this.id = uuid();
        this.pendingRenditions = 0;
    }

    /**
     * Wait for all pending renditions to finish
     *
     * @param {Number} [timeout=60000] Time to wait for activation
     */
    async wait(timeout = 60000) {
        if (this.pendingRenditions < 0) {
            throw Error(`Internal error, pendingRenditions < 0: ${this.pendingRenditions}`);
        } else if (this.pendingRenditions > 0) {
            const self = this;
            await new Promise((resolve, reject) => {
                // eslint-disable-next-line prefer-const
                let clearEvents;

                // set timer to implement timeout
                const timer = setTimeout(() => {
                    clearEvents();
                    reject(Error(`Timed out after ${timeout} ms`));
                }, timeout);

                // event listener
                const listener = () => {
                    clearEvents();
                    resolve();
                }

                clearEvents = () => {
                    clearTimeout(timer);
                    self.off("drained", resolve);
                }

                self.on("drained", listener);
            });
        }
    }

    /**
     * Stop the AssetCompute client
     */
    async close() {
        return this.eventEmitter.close();
    }

    /**
     * Asynchronously process an asset. The result is returned as an event
     * emitted from this class.
     *
     * @param {AssetComputeSource} source Source asset
     * @param {AssetComputeRendition[]} renditions Requested renditions
     * @param {Object} userData User data associated with the request
     * @returns {Object} Response with the activation id
     */
    async process(source, renditions, userData) {
        // assign user data to uniquely identify rendition by index
        // does not modify the incoming renditions
        renditions = renditions.map((rendition, index) => {
            return {
                ...rendition,
                userData: {
                    ...rendition.userData,
                    assetComputeClient: {
                        index,
                        length: renditions.length
                    }
                }
            };
        });

        // assign user data to uniquely identify client
        userData = {
            ...userData,
            assetComputeClient: {
                id: this.id
            }
        };

        const response = await this.assetCompute.process(source, renditions, userData);
        this.pendingRenditions += renditions.length;
        return response;
    }

    /**
     * Wait for all events related to a particular activation return.
     *
     * @param {String} activationId Activation identifier previously returned by process
     * @param {Number} [timeout=60000] Time to wait for activation
     * @returns {Promise} resolves to the rendition events received
     */
    async waitActivation(activationId, timeout=60000) {
        const self = this;
        return new Promise((resolve, reject) => {
            const context = {};
            // eslint-disable-next-line prefer-const
            let clearEvents;

            // set timer to implement timeout
            const timer = setTimeout(() => {
                clearEvents();
                reject(Error(`Request ${activationId} timed out after ${timeout} ms`));
            }, timeout);

            // event listener
            const listener = event => {
                try {
                    completeClientEvent(activationId, event, context);
                    if (context.events && (context.pendingEvents === 0)) {
                        clearEvents();
                        resolve(context.events);
                    }
                } catch (e) {
                    clearEvents();
                    reject(e);
                }
            }

            // clear events
            clearEvents = () => {
                clearTimeout(timer);
                self.off("rendition_created", listener);
                self.off("rendition_failed", listener);
            }

            // start listening to events
            self.on("rendition_created", listener);
            self.on("rendition_failed", listener);
        });
    }

}

/**
 * @typedef {Object} AdobeIdTechnicalAccount
 * @property {String} id Id of the technical account, such as "12345667EDBA435@techacct.adobe.com"
 * @property {String} org Organization id, such as "8765432DEAB65@AdobeOrg"
 * @property {String} clientId Client id (API key) of the technical account, such as "1234-5678-9876-5433"
 * @property {String} clientSecret Client secret of the the technical account
 * @property {String} privateKey Path to the private key file PEM encoded (either this or `privateKeyFile` is required)
 * @property {String} privateKeyFile Private key PEM encoded as string (either this or `privateKey` is required)
 */
/**
 * @typedef {Object} AssetComputeIntegration
 * @param {String[]} metascopes Metascopes associated with integration
 * @param {String} imsEndpoint IMS end point (defaults to https://ims-na1.adobelogin.com)
 * @param {AdobeIdTechnicalAccount} technicalAccount Technical account created for Asset Compute integration
 */
/**
 * @typedef {Object} AssetComputeClientOptions
 * @property {String} [apiKey=] Override the API key used to communicate with Asset Compute. Used only on non-production.
 * @property {String} [url=] Asset Compute url (defaults to https://asset-compute.adobe.io)
 * @property {Number} [interval=] Override interval at which to poll I/O events
 * @property {String} [imsEndpoint=] IMS service to authenticate with
 * @property {Object} [retryOptions=] Fetch retry options for `@adobe/node-fetch-retry` See README.md for more information
 */
/**
 * Create a high-level asset compute client.
 *
 * @param {AssetComputeIntegration} integration Asset Compute Integration
 * @param {AssetComputeClientOptions} [options=] Options provided to the client
 */
async function createAssetComputeClient(integration, options) {
    // validate integration
    if (!integration || !integration.metascopes || !integration.technicalAccount) {
        throw Error(`Asset Compute integration details are required`);
    }

    // exchange JWT access token
    const auth = new AdobeAuth({
        adobeLoginHost: (options && options.imsEndpoint) || (integration && integration.imsEndpoint)
    });
    const accessToken = await auth.createAccessToken(
        integration.technicalAccount,
        integration.metascopes
    );

    // Set-up asset compute
    const assetCompute = new AssetCompute({
        ...options,
        accessToken,
        org: integration.technicalAccount.org,
        apiKey: (options && options.apiKey) || integration.technicalAccount.clientId
    });

    // Register I/O event type and journal, emit events
    const { journal } = await assetCompute.register();
    const eventEmitter = new AssetComputeEventEmitter({
        ...options,
        accessToken,
        org: integration.technicalAccount.org,
        journal
    });

    return new AssetComputeClient(assetCompute, eventEmitter);
}

module.exports = {
    createAssetComputeClient
}
