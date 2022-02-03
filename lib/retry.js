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
const clone = require('clone');

const MAX_RETRY_ON_HTTP_429 = 4;
const MAX_RETRY_WAIT_TIME_MS = 60000; // maximum time in ms to wait before retrying if no `retry-after` header is sent
const MIN_RETRY_WAIT_TIME_MS = 30000; // minimum time in ms to wait before retrying if no `retry-after` header is sent
const TOO_MANY_REQUEST_ERROR = 'TooManyRequestsError';
const TOO_MANY_REQUEST_ERROR_CODE = 429;

/**
 * Filter out the retry options
 *
 * @param {Object} options Options
 * @returns {Object} Filtered options (without retryOptions)
 */
function filterOptions(options={}) {
    const newOpts = clone(options);
    if (newOpts) {
        delete newOpts.max429RetryCount;
        delete newOpts.disable429Retry;
    }
    return newOpts;
}


/**
     * Determine time in milliseconds to wait until retrying
     * @param {number} retryAfter optional amount in seconds to wait for until retrying
     * @returns waitTime in milliseconds to wait before retrying
     */
function retryWaitTime(retryAfter) {
    // randomly choose between 30-60 seconds waittime
    let waitTime = Math.floor(Math.random() * (MAX_RETRY_WAIT_TIME_MS - MIN_RETRY_WAIT_TIME_MS + 1)) + MIN_RETRY_WAIT_TIME_MS;

    // API gateway `retry-after` header is the amount of time in seconds to wait before retrying
    if (retryAfter && typeof(retryAfter) === 'number' && !isNaN(retryAfter)) {
        waitTime = retryAfter * 1000 + (Math.floor(Math.random() * 1000));
    }
    return waitTime;
}

/**
     * Determine if should retry on 429
     * 
     * It will return true if the response was a 429 error and it has not reached max retry count
     * @param {Number} attempt 
     * @param {Error} error instance of error object
     * @param {Object} retryOpts Retry options
     * @returns 
     */
function shouldRetry(attempt, error, retryOpts) {
    // if retry is disabled, return false
    if (retryOpts.disable429Retry) {
        return false;
    }
    if (error.code === TOO_MANY_REQUEST_ERROR_CODE && error.name === TOO_MANY_REQUEST_ERROR) {
        return attempt < retryOpts.max429RetryCount;
    } else {
        return false;
    }
}
/**
 * @typedef {Object} RetryOptions
 * @property {Number} [max429RetryCount=4] max amount of times to retry on 429s
 */
/**
 * Invoke a function with retry one failure support
 *
 * @param {Function} asyncFunc Asynchronous function to call
 * @param {Object} options Options to pass to asynchronous function
 * @param {RetryOptions} retryOpts Retry options
 */
async function retryInvoke(asyncFunc, options, retryOpts) {
    return new Promise((resolve, reject) => {
        async function invoke(attempt, ms) {
            try {
                if (attempt > 0) {
                    console.warn(`Attempting retry ${attempt} after waiting ${ms} milliseconds.`);
                }
                return resolve(await asyncFunc(options));
            } catch (error) {
                if (shouldRetry(attempt, error, retryOpts)) {
                    const ms = retryWaitTime(error.retryAfter);
                    console.warn(`Waiting ${ms} milliseconds to attempt retry ${attempt + 1}, failure: ${error.message}`);

                    setTimeout(invoke, ms, attempt + 1, ms);
                } else {
                    return reject(error);
                }
            }
        }
        setImmediate(invoke, 0, 0);
    });
}

/**
 * Add retry support to the given asynchronous function
 *
 * @param {Function} asyncFunc Asynchronous function
 * @returns Asynchronous function with retry support
 */
async function retry(asyncFunc, options) {
    const retryOpts = {
        max429RetryCount: options && options.max429RetryCount || MAX_RETRY_ON_HTTP_429,
        disable429Retry: options && options.disable429Retry || false
    };
    options = filterOptions(options); // remove retry options from options passed to actual fetch
    return retryInvoke(asyncFunc, options, retryOpts);
}

module.exports = {
    retry
};