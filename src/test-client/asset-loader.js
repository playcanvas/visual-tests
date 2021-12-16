class AssetLoader {
    constructor(registry) {
        this.registry = registry;
        this.numLoads = 0;
        this.loadedAssets = [];
    }

    load(manifest, callback) {
        const keys = Object.keys(manifest);
        const assets = { };
        let remaining = keys.length;
        let lastError = null;

        const cb = (key, err, asset) => {
            if (err) {
                lastError = err;
            }
            assets[key] = err ? null : asset.resource;
            this.loadedAssets.push(asset);
            if (--remaining === 0) {
                callback(lastError, assets);
            }
        };

        keys.forEach((key) => {
            const entry = manifest[key]
            switch (entry.type) {
                case 'gltf':
                    this._loadGltf(entry, (err, result) => {
                        cb(key, err, result);
                    });
                    break;
                case 'texture':
                    this._loadTexture(entry, (err, result) => {
                        cb(key, err, result);
                    });
                    break;
            }
        });
    }

    // destroy loaded assets
    destroy() {
        this.loadedAssets.forEach((asset) => {
            this.registry.remove(asset);
            asset.unload();
        });
    }

    _loadGltf(entry, callback) {
        const name = `bm_${this.numLoads++}.glb`;
        const asset = new pc.Asset('gltf-file', 'container', {
            url: name,
            contents: entry.contents
        }, null, { });

        asset.on('load', () => {
            callback(null, asset);
        });

        asset.on('error', (err) => {
            callback(err, asset);
        });

        this.registry.add(asset);
        this.registry.load(asset);
    }

    _loadTexture(entry, callback) {
        // load equirectangular skybox
        const asset = new pc.Asset('skybox_equi', 'texture', {
            url: entry.url,
            contents: entry.contents
        });

        asset.on('load', () => {
            callback(null, asset);
        });

        asset.on('error', (err) => {
            callback(err, asset);
        });

        this.registry.add(asset);
        this.registry.load(asset);
    }
}

export {
    AssetLoader
};
