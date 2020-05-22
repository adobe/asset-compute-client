# Asset Compute Client

[![Version](https://img.shields.io/npm/v/@adobe/asset-compute-client.svg)](https://npmjs.org/package/@adobe/asset-compute-client)

## Overview
The Asset Compute Client is separated in 3 parts:

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
    await sleep(30000); // 30s

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

### Using `createAssetComputeClient()` for Initialization

This function creates a new instance of `AssetComputeClient` and calls `.register()` method.
```javascript
    const yaml = require("js-yaml");
    const { createAssetComputeClient } = require("@adobe/asset-compute-client");

    const integration = yaml.safeLoad(await fs.readFile("integration.yaml", "utf-8"));
    const assetCompute = await createAssetComputeClient(integration);
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

### @adobe/node-fetch-retry
Fetch retry options are documented [here](https://github.com/adobe/node-fetch-retry#optional-custom-parameters).


### Contributing
Contributions are welcomed! Read the [Contributing Guide](./.github/CONTRIBUTING.md) for more information.

### Licensing
This project is licensed under the Apache V2 License. See [LICENSE](LICENSE) for more information.
