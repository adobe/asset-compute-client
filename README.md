# Asset Compute Client

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

Example code:

```javascript
    const yaml = require("js-yaml");
    const { createAssetComputeClient } = require("@adobe/asset-compute-client");

    const integration = yaml.safeLoad(await fs.readFile("integration.yaml", "utf-8"));
    const assetCompute = await createAssetComputeClient(integration);
    const { activationId } = await assetCompute.process(
        "https://source-url", [
            {
                name: "rendition.png",
                url: "https://target-url",
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
