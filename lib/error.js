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

/**
 * If `date` is a stringified date, return it as a Date
 * @param {*} date stringified date
 * @returns Date or false if param is not a stringified date
 */
function isStringifiedDate(date) {
    const newDate = new Date(date);
    if (newDate !== "Invalid Date" && !isNaN(newDate)) {
        return newDate;
    }
    return false;
}

/**
 * If `num` is a stringified number, return it as a parsed integer
 * @param {String} num stringified number
 * @returns parsed integer or false
 */
function isStringifiedNumber(num) {
    const parsedRetryAfter = parseInt(num, 10);
    if (Number.isFinite(parsedRetryAfter)) {
        return parsedRetryAfter;
    }
    return false;
}

/**
 * Custom 429 error
 * @param message Error message
 * @param retryAfterHeader `retry-after` header from the response as a stringified number in seconds or a stringified date
 * @returns custom error:
 *  {
 *      name: "TooManyRequestsError"
 *      code: 429
 *      retryAfter: 3 // integer in seconds to wait before retrying
 *  }
 */
class TooManyRequestsError extends Error {
    constructor(message, retryAfterHeader) {
        super(message);

        Error.captureStackTrace(this, TooManyRequestsError);
        this.name = "TooManyRequestsError";
        this.code = 429;

        // `retry-after` header can be a stringified number in seconds or a stringified date
        if (typeof(retryAfterHeader) === 'string') {
            const retryAfterAsNumber = isStringifiedNumber(retryAfterHeader);
            const retryAfterAsDate = isStringifiedDate(retryAfterHeader);
            if (retryAfterAsNumber !== false) {
                this.retryAfter = retryAfterAsNumber;
            }
            else if (retryAfterAsDate !== false) {
                // determine seconds till retry-after date
                const timeTillRetrySeconds = Math.round(((retryAfterAsDate - Date.now()) / 1000));
                // in case seconds till retry is negative, default to 1 second
                this.retryAfter = timeTillRetrySeconds > 0? timeTillRetrySeconds : 1;

            }
        }
    }
}

module.exports = {
    TooManyRequestsError
};