
const runGltfTests = (testEnv, doneCallback, modelIndex) => {
    // iterate over all models and variants
    let mindex = 0;
    let vindex = 0;

    const app = testEnv.app;

    const renderNext = () => {
        if (mindex === modelIndex.length) {
            doneCallback();
        } else {
            const model = modelIndex[mindex];
            const vkeys = Object.keys(model.variants);
            const variant = vkeys[vindex];
            const url = `${model.name}/${variant}/${model.variants[variant]}`;

            app.assets.loadFromUrl(url, "container", (err, asset) => {
                if (err) {
                    console.log(`error loading model err=${err}`);
                } else {
                    // add the entity to the scene
                    const entity = new pc.Entity();
                    entity.addComponent("model", {
                        type: "asset",
                        asset: asset.resource.model,
                        castShadows: true
                    });
                    testEnv.add(entity);

                    // frame 0
                    testEnv.update(1.0 / 60.0);
                    testEnv.render();

                    // frame model
                    testEnv.frame(entity?.model?.meshInstances || []);

                    // frame 1
                    testEnv.update();
                    testEnv.render();

                    // upload screenshot
                    testEnv.upload(`${model.name}/${variant}`);

                    // clean up
                    testEnv.remove(entity);
                    entity.destroy();

                    app.assets.remove(asset);
                    asset.unload();
                }

                if (++vindex === vkeys.length) {
                    vindex = 0;
                    ++mindex;
                }

                renderNext();
            });
        }
    }

    renderNext();
};

const gltfTests = (testEnv, doneCallback) => {
    // load the list of gltf models
    fetch('model-index.json')
    .then((response) => response.json())
    .then((json) => {
        runGltfTests(testEnv, doneCallback, json);
    });   
};

export {
    gltfTests
};
