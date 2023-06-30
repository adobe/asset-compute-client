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

const EventEmitter = require("events");
const uuid = require("uuid");
const { AdobeAuth, AdobeIOEvents } = require("@adobe/asset-compute-events-client");
const { AssetCompute } = require("./assetcompute");
const { AssetComputeEventEmitter } = require("./eventemitter");
const { isOAuthServerToServerIntegration, 
    validateOAuthServerToServerIntegration,
    createOAuthServerToServerAccessToken } = require("./oauthservertoserver");

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
        client.emit("drained");
    }
}

function completeClientEvent(requestId, event, context) {
    if (event.requestId !== requestId) {
        return;
    }

    // determine index
    const userData = event &&
        event.rendition &&
        event.rendition.userData &&
        event.rendition.userData.assetComputeClient &&
        event.rendition.userData.assetComputeClient;

    if (!userData) {
        throw Error(`Request ${requestId}, expect userData with rendition: ${JSON.stringify(event)}`);
    }
    if (typeof userData.index !== 'number') {
        throw Error(`Request ${requestId}, expect index with rendition: ${JSON.stringify(event)}`);
    }
    if (typeof userData.length !== 'number') {
        throw Error(`Request ${requestId}, expect length with rendition: ${JSON.stringify(event)}`);
    }

    // initialize
    if (!context.pendingEvents) {
        context.pendingEvents = userData.length;
        context.events = new Array(userData.length);
    }

    if (!context.events[userData.index]) {
        context.events[userData.index] = event;
    } else {
        throw Error(`Request ${requestId}, duplicate event: ${JSON.stringify(event)}, previous: ${JSON.stringify(context.events[userData.index])}`);
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
     * @typedef {Object} OAuthServerToServerIntegration
     * @property {String} TYPE Type of integration: "oauthservertoserver"
     * @property {String} ORG_ID Organization id, such as "8765432DEAB65@AdobeOrg"
     * @property {String[]} CLIENT_SECRETS Client secrets of the technical account
     * @property {String} CLIENT_ID Client id (API key) of the technical account, such as "1234-5678-9876-5433"
     * @property {String[]} SCOPES Scopes associated with integration
     * @property {String} TECHNICAL_ACCOUNT_ID Id of the technical account, such as "12345667EDBA435@techacct.adobe.com"
     * @property {String} TECHNICAL_ACCOUNT_EMAIL Email of the technical account, such as "00000000-0000-0000-0000-000000000000@techacct.adobe.com
     */
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
      * @param {AssetComputeIntegration|OAuthServerToServerIntegration} integration Asset Compute Integration
      * @param {AssetComputeClientOptions} [options=] Options provided to the client
      */
    constructor(integration, options={}) {
        super();

        // validate integration
        if (isOAuthServerToServerIntegration(integration)) {
            if (!validateOAuthServerToServerIntegration(integration)) {
                throw Error(`Asset Compute OAuth Server-to-server integration details are required`);
            }
        } else if (!integration || !integration.metascopes || !integration.technicalAccount) {
            throw Error(`Asset Compute integration details are required`);
        }

        // exchange JWT access token
        this.adobeLoginHost = (options && options.imsEndpoint) || (integration && integration.imsEndpoint);
        this.auth = new AdobeAuth({
            adobeLoginHost: this.adobeLoginHost
        });

        this.integration = integration;
        this.options = options;
        this._registered = false;

        // identifier uniquely identifying us
        this.id = uuid.v1();
        this.pendingRenditions = 0;
    }

    /**
     * Initialize Asset Compute and calls /register
     */
    static async create(integration, options) {
        // validate integration
        if (isOAuthServerToServerIntegration(integration) && !validateOAuthServerToServerIntegration(integration)) {
            throw Error(`Asset Compute OAuth Server-to-server integration details are required`);
        } else if (!integration || !integration.metascopes || !integration.technicalAccount) {
            throw Error(`Asset Compute integration details are required`);
        }
        const assetComputeClient =  new AssetComputeClient(integration, options);
        // Register I/O event type and journal
        await assetComputeClient.register();
        return assetComputeClient;
    }

    /**
     * Set up Asset Compute
     */
    async initialize() {
        let accessToken;
        if (isOAuthServerToServerIntegration(this.integration)) {
            accessToken = await createOAuthServerToServerAccessToken(this.integration, this.adobeLoginHost);
        } else {
            accessToken = await this.auth.createAccessToken(
                this.integration.technicalAccount,
                this.integration.metascopes
            );
        }

        // Set-up asset compute
        const assetCompute = new AssetCompute({
            ...this.options,
            accessToken,
            org: this.integration.ORG_ID || this.integration.technicalAccount.org,
            apiKey: (this.options && this.options.apiKey) || this.integration.CLIENT_ID || this.integration.technicalAccount.clientId
        });
        this.assetCompute = assetCompute;
        this.accessToken = accessToken;
    }

    /**
     * Register I/O event type and journal and set up event emitter
     * This must be called before the first call to /process or after calling /unregister
     */
    async register() {
        if (!this.accessToken || !this.assetCompute) {
            await this.initialize();
        }

        // Register I/O event type and journal, emit events
        const response = await this.assetCompute.register();
        this.journal = response.journal;
        this._registered = true;

        if (this.eventEmitter) {
            await this.eventEmitter.close();
            this.eventEmitter = null; // new journal, must reset eventEmitter
        }
        return response;
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
                };

                clearEvents = () => {
                    clearTimeout(timer);
                    self.off("drained", resolve);
                };

                self.on("drained", listener);
            });
        }
    }

    /**
     * Stop the AssetCompute client
     */
    async close() {
        if (this.eventEmitter) {
            return this.eventEmitter.close();
        }
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
        if (!this._registered) {
            // note: use AssetComputeClient.create() for a simpler way to initialize the client and call register
            throw new Error('Must call register before calling /process');
        }

        if (!this.eventEmitter) {
            const eventEmitter = new AssetComputeEventEmitter({
                ...this.options,
                accessToken: this.accessToken,
                org: this.integration.ORG_ID || this.integration.technicalAccount.org,
                journal: this.journal
            });

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

            // NUI-878 protect against UnhandledPromiseRejectionWarning and polling interruption by having a listener by default
            this.on('error', error => {
                if (this.listenerCount('error') <= 1) {
                    // log if there is no other listener handling errors
                    console.log("Error polling event journal:", error.message || error);
                }
            });
        }


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
     * @param {String} requestId Activation identifier previously returned by process
     * @param {Number} [timeout=60000] Time to wait for activation
     * @returns {Promise} resolves to the rendition events received
     */
    async waitActivation(requestId, timeout=60000) {
        const self = this;
        return new Promise((resolve, reject) => {
            const context = {};
            // eslint-disable-next-line prefer-const
            let clearEvents;

            // set timer to implement timeout
            const timer = setTimeout(() => {
                clearEvents();
                reject(Error(`Request ${requestId} timed out after ${timeout} ms`));
            }, timeout);

            // event listener
            const listener = event => {
                try {
                    completeClientEvent(requestId, event, context);
                    if (context.events && (context.pendingEvents === 0)) {
                        clearEvents();
                        resolve(context.events);
                    }
                } catch (e) {
                    clearEvents();
                    reject(e);
                }
            };

            // clear events
            clearEvents = () => {
                clearTimeout(timer);
                self.off("rendition_created", listener);
                self.off("rendition_failed", listener);
            };

            // start listening to events
            self.on("rendition_created", listener);
            self.on("rendition_failed", listener);
        });
    }

    async unregister() {
        if (!this.assetCompute) {
            await this.initialize();
        }
        const response = await this.assetCompute.unregister();
        
        this._registered = false; // wait until successful unregister to set registered variable

        if (this.eventEmitter) {
            await this.eventEmitter.close();
            this.eventEmitter = null; // journal is removed, must stop eventEmitter
        }
        return response;
    }

    async isEventJournalReady() {
        const ioEvents = new AdobeIOEvents({
            accessToken: this.accessToken,
            orgId: this.integration.technicalAccount.org
        });
        try {
            await ioEvents.getEventsFromJournal(this.journal);
            return true;
        } catch(e) { // eslint-disable-line no-unused-vars
            return false;
        }
    }
}

module.exports = {
    AssetComputeClient
};
