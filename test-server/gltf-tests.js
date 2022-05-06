import { readFile } from 'fs/promises';

// iterate over gltf models and generate a test for each

class GltfTests {
    static async register(testRegistry) {
        // load the list of gltf models
        const file = await readFile('public/gltf-sample-models/2.0/model-index.json');
        const manifest = JSON.parse(file);

        return manifest.forEach((model) => {
            Object.keys(model.variants).forEach((variant) => {
                const name = `${model.name}/${variant}/${model.variants[variant]}`;
                testRegistry.register({
                    name: `gltf/${name}`,
                    engine: "https://code.playcanvas.com/playcanvas-stable.js",
                    draco: "draco/draco.wasm.js",
                    env: "assets/abandoned_tank_farm_01_2k.hdr",
                    assets: [{
                        name: 'gltf',
                        type: 'container',
                        url: `gltf-sample-models/2.0/${name}`
                    }],
                    entities: [{
                        asset: '$gltf'
                    }]
                });
            });
        });
    }
}

export {
    GltfTests
};
