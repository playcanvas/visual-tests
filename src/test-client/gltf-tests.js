
const run = (testEnv, doneCallback, modelIndex) => {
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

            if (url.indexOf('Sphere') === -1) {
                if (++vindex === vkeys.length) {
                    vindex = 0;
                    ++mindex;
                }
                renderNext();
            } else {
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
                        app.root.addChild(entity);

                        // frame 0
                        testEnv.update(1.0 / 60.0);
                        testEnv.render();

                        // frame 1
                        testEnv.placeCamera(entity?.model?.meshInstances || []);
                        testEnv.update();
                        testEnv.render();

                        // update
                        testEnv.upload(`${model.name}/${variant}`);

                        // clean up
                        app.root.removeChild(entity);
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
    }

    renderNext();
};

const GltfTests = (testEnv, doneCallback) => {
    // load the list of gltf models
    fetch('model-index.json')
    .then((response) => response.json())
    .then((json) => {
        run(testEnv, doneCallback, json);
    });
   
};

testList.push(GltfTests);
