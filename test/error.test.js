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

/* eslint-env mocha */
/* eslint mocha/no-mocha-arrows: "off" */

'use strict';

const { TooManyRequestsError } = require('../lib/error');
const assert = require('assert');
const rewire = require('rewire');

describe('error.js tests', () => {
    it('isStringifiedDate', function () {
        const rewiredError = rewire('../lib/error');
        const isStringifiedDate = rewiredError.__get__('isStringifiedDate');

        let strDate = (new Date(Date.now())).toString();
        assert.ok(isStringifiedDate(strDate));

        strDate = Date.now();
        assert.ok(isStringifiedDate(strDate));

        // technically a valid date
        strDate = '1';
        assert.ok(isStringifiedDate(strDate));
        
        strDate = new Date("02-20-1997");
        assert.ok(isStringifiedDate(strDate));
        
        strDate = (new Date("02-20-1997")).toString();
        assert.ok(isStringifiedDate(strDate));
        
        strDate = "02-20-1997";
        assert.ok(isStringifiedDate(strDate));

        // invalid dates
        strDate = "hello";
        assert.strictEqual(isStringifiedDate(strDate), false);
        
        strDate = new Date("hello");
        assert.strictEqual(isStringifiedDate(strDate), false);
        
        strDate = (new Date("hello")).toString();
        assert.strictEqual(isStringifiedDate(strDate), false);
        
        strDate = "invalid date";
        assert.strictEqual(isStringifiedDate(strDate), false);
        
        strDate = NaN;
        assert.strictEqual(isStringifiedDate(strDate), false);

        strDate = (Date.now()).toString();
        assert.strictEqual(isStringifiedDate(strDate), false);   
    });

    it('isStringifiedNumber', function () {
        const rewiredError = rewire('../lib/error');
        const isStringifiedNumber = rewiredError.__get__('isStringifiedNumber');

        let strNum = (1).toString();
        assert.strictEqual(isStringifiedNumber(strNum), 1);

        strNum = 1;
        assert.strictEqual(isStringifiedNumber(strNum), 1);

        strNum = "1";
        assert.strictEqual(isStringifiedNumber(strNum), 1);

        strNum = "0";
        assert.strictEqual(isStringifiedNumber(strNum), 0);

        strNum = Date.now();
        assert.strictEqual(isStringifiedNumber(strNum), strNum);

        // invalid numbers
        strNum = "hello";
        assert.strictEqual(isStringifiedNumber(strNum), false);

        strNum = NaN;
        assert.strictEqual(isStringifiedNumber(strNum), false);
    });

    it ('TooManyRequestsError with retry-after as 1', function () {
        const error = new TooManyRequestsError('429', '1');
        assert.ok(error instanceof TooManyRequestsError);
        assert.strictEqual(error.code, 429);
        assert.strictEqual(error.name, 'TooManyRequestsError');
        assert.strictEqual(error.retryAfter, 1);
    });
    it ('TooManyRequestsError with retry-after as date', function () {
        const error = new TooManyRequestsError('429', (new Date(Date.now() + 5).toString()));
        assert.ok(error instanceof TooManyRequestsError);
        assert.strictEqual(error.code, 429);
        assert.strictEqual(error.name, 'TooManyRequestsError');
        assert.ok(error.retryAfter < 6);
    });
    it ('TooManyRequestsError with retry-after missing', function () {
        const error = new TooManyRequestsError('429');
        assert.ok(error instanceof TooManyRequestsError);
        assert.strictEqual(error.code, 429);
        assert.strictEqual(error.name, 'TooManyRequestsError');
        assert.strictEqual(error.retryAfter, undefined);
    });
});