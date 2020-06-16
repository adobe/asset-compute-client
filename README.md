# Adobe Asset Compute Client

[![Version](https://img.shields.io/npm/v/@adobe/<package-name>.svg)](https://npmjs.org/package/@adobe/asset-compute-client)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![Travis](https://travis-ci.com/adobe/<package-name>.svg?branch=master)](https://travis-ci.com/adobe/asset-compute-client)

## Overview

Javascript client for the Adobe Asset Compute Service. Currently only tested with Nodejs. The Javascript API is separated in 3 parts:

- [AssetCompute](lib/assetcompute.js) - A light-weight wrapper around the AssetCompute API.
- [AssetComputeEventEmitter](lib/eventemitter.js) - Listens to an I/O event journal and converts the events to `rendition_created` and `rendition_failed` events.
- [AssetComputeClient](lib/client.js) - A higher level client that provides a simpler API

AssetComputeClient has the following capabilities:

- Fully initialize Asset Compute through a previously provisioned integration
- Listens to I/O events on the integration
- Invoke Asset Compute process asynchronously
- Wait for a single Asset Compute process request to finish (default timeout is 60s)
- Wait for all Asset Compute process requests to finish (default timeout is 60s)

## Installation

```
npm i @adobe/asset-compute-client
```

## Usage

### Using the Class Initialization
After the client is set up, you must call `.register()` once before the first call to `.process()`.

If the integration does not already have an I/O Events journal registered, it may take some time after calling `.register()` to be able to recieve and send I/O Events so it is recommended to add some wait time before calling `.process()`.

If the integration already has an I/O Events journal registered, it is recommended to not wait before calling `.process()`.
```javascript
    const yaml = require("js-yaml");
    const { AssetComputeClient } = require("@adobe/asset-compute-client");
    const sleep = require('util').promisify(setTimeout);


    const integration = yaml.safeLoad(await fs.readFile("integration.yaml", "utf-8"));
    const assetCompute = new AssetComputeClient(integration);

    // Call register before first call the process
    await assetCompute.register();

    // add wait time for events provider to set up
    await sleep(45000); // 30s

    const { activationId } = await assetCompute.process(
        "https://presigned-source-url", [
            {
                name: "rendition.png",
                url: "https://presigned-target-url",
                fmt: "png",
                wid: 200,
                hei: 200
            }
        ]
    )
    const events = await assetCompute.waitActivation(activationId);
    if (events[0].type === "rendition_created") {
        // use the rendition
    } else {
        // failed to process
    }
```

### Using `AssetComputeClient.create()` for Initialization

This function creates a new instance of `AssetComputeClient` and calls the `.register()` method.
```javascript
    const yaml = require("js-yaml");
    const { AssetComputeClient } = require("@adobe/asset-compute-client");

    const integration = yaml.safeLoad(await fs.readFile("integration.yaml", "utf-8"));
    const assetCompute = await AssetComputeClient.create(integration);
    // add wait time if needed
    const { activationId } = await assetCompute.process(
        "https://presigned-source-url", [
            {
                name: "rendition.png",
                url: "https://presigned-target-url",
                fmt: "png",
                wid: 200,
                hei: 200
            }
        ]
    )
    const events = await assetCompute.waitActivation(activationId);
    if (events[0].type === "rendition_created") {
        // use the rendition
    } else {
        // failed to process
    }
```

### Register
After setting up the client, it is necessary to call `.register()` once before calling `.process()`.

If the integration already has an I/O Events journal registered, you __still must call register__. The journal url returned from register is necessary for the client to retrieve I/O Events.

If the integration does not have an I/O Events journal registered, make sure to add some wait time after calling `.register()` before calling `.process()`. (It is recommended to wait around ~45 seconds)
```js
const assetCompute = new AssetComputeClient(integration);
await assetCompute.register();
```

### Unregister
The unregister method will remove the I/O Events Journal created in `.register()`. It is necessary to call `.register()` again before attempting to use the client after unregistering.

Example usage:
```js
const assetCompute = new AssetComputeClient(integration);
await assetCompute.register();
await assetCompute.process(..renditions);

// unregister journal
await assetCompute.unregister();

// call to process will fail, must call `register()` again first
try {
    await assetCompute.process(..renditions);
} catch (e) {
    // expected error, must call `register()` first
}

await assetCompute.register();
sleep(45000); // sleep after registering to give time for journal to set up
await assetCompute.process(..renditions);
```

### @adobe/node-fetch-retry
Fetch retry options are documented [here](https://github.com/adobe/node-fetch-retry#optional-custom-parameters).


### Contributing
Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

### Licensing
This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
