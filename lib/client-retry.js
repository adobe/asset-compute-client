/*
 * Copyright 2021 Adobe. All rights reserved.
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
const { AssetComputeClient } = require("./client");
const colors = require("colors/safe");
const sleep = require("util").promisify(setTimeout);

const MAX_RETRY_429 = 4;
const MAX_RETRY_WAIT_TIME_MS = 60000; // maximum time in ms to wait before retrying if no `retry-after` header is sent
const MIN_RETRY_WAIT_TIME_MS = 30000; // minimum time in ms to wait before retrying if no `retry-after` header is sent

/**
 * Small wrapper around AssetComputeClient adding retry logic on 429s based on `retry-after` header
 */
class AssetComputeClientRetry extends AssetComputeClient {
    constructor(integration, options) {
        super(integration, options);
        this.max429RetryCount = (options && options.max429RetryCount) || MAX_RETRY_429;
    }

    retryWaitTime(e) {
        // randomly choose between 30-60 seconds waittime
        let waitTime = Math.floor(Math.random() * (MAX_RETRY_WAIT_TIME_MS - MIN_RETRY_WAIT_TIME_MS + 1)) + MIN_RETRY_WAIT_TIME_MS;

        // API gateway `retry-after` header is the amount of time in seconds to wait before retrying
        if (e.retryAfter && typeof(e.retryAfter) === 'number' && !isNaN(e.retryAfter)) {
            waitTime = e.retryAfter * 1000 + (Math.floor(Math.random() * 1000));
        }
        return waitTime;
    }

    async register() {
        let response, error;
        let non429Response = false;
        let retryCount = 0;
        while (!non429Response && retryCount <= this.max429RetryCount) {
            retryCount++;
            try {
                response = await super.register();
                non429Response = true;
            } catch (e) {
                if (e.message.includes("429")) {
                    non429Response = false;
                    console.log(colors.red(`encountered a 429: ${e.message}.`));
                    const waitTime = this.retryWaitTime(e);
                    console.log(colors.red(`Waiting for ${waitTime}ms and trying again`));
                    await sleep(waitTime);
                } else {
                    non429Response = true;
                    error = e;
                }
            }
        }
        if (!non429Response) {
            throw new Error(`Running into 429s after ${retryCount} attempts. Will not continue retrying. Try again in a few minutes.`);

        }
        // pass through error
        if (error) {
            throw error;
        }
        return response;
    }

    // retry on 429s
    async unregister() {
        let response, error;
        let non429Response = false;
        let retryCount = 0;
        while (!non429Response && retryCount <= this.max429RetryCount) {
            retryCount++;
            try {
                response = await super.unregister();
                non429Response = true;
            } catch (e) {
                if (e.message.includes("429")) {
                    non429Response = false;
                    console.log(colors.red(`encountered a 429: ${e.message}.`));
                    const waitTime = this.retryWaitTime(e);
                    console.log(colors.red(`Waiting for ${waitTime}ms and trying again`));
                    await sleep(waitTime);
                } else {
                    non429Response = true;
                    error = e;
                }
            }
        }

        if (!non429Response) {
            throw new Error(`Running into 429s after ${retryCount} attempts. Will not continue retrying. Try again in a few minutes.`);

        }
        // pass through error
        if (error) {
            throw error;
        }
        return response;
    }
    async process(source, renditions, userData) {
        let response, error;
        let non429Response = false;
        let retryCount = 0;
        while (!non429Response && retryCount <= this.max429RetryCount) {
            retryCount++;
            try {
                response = await super.process(source, renditions, userData);
                console.log('Successful call to /process', retryCount);
                non429Response = true;
            } catch (e) {
                if (e.message.includes("429")) {
                    non429Response = false;
                    console.log(colors.red(`encountered a 429: ${e.message}.`));
                    const waitTime = this.retryWaitTime(e);
                    console.log(colors.red(`Waiting for ${waitTime}ms and trying again`));
                    await sleep(waitTime);
                } else {
                    non429Response = true;
                    error = e;
                }
            }
        }

        if (!non429Response) {
            throw new Error(`Running into 429s after ${retryCount} attempts. Will not continue retrying. Try again in a few minutes.`);

        }
        // pass through error
        if (error) {
            throw error;
        }
        return response;
    }
}

module.exports = {
    AssetComputeClientRetry
};