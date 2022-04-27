
// iterate over gltf models and generate a test for each

const gltfTests = async () => {
    // load the list of gltf models
    const response = await fetch('model-index.json');
    const gltfManifest = await response.json();
    return gltfManifest.map((model) => {
        return {
            name: model.name,
            children: Object.keys(model.variants).map((variant) => {
                const filename = model.variants[variant];
                return {
                    name: variant,
                    assets: [{
                        name: 'gltf',
                        type: 'container',
                        url: `${model.name}/${variant}/${filename}`
                    }],
                    entities: [{
                        asset: '$gltf'
                    }]
                };
            })
        };
    }).flat()
};

export {
    gltfTests
};
