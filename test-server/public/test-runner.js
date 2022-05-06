
// load a script
const loadScript = async (url) => {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.setAttribute('src', url);
        s.onload = () => {
            resolve();
        };
        s.onerror = () => {
            reject(new Error(`Failed to load script='${url}'`));
        };
        document.body.appendChild(s);
    });
};

// load and initialize draco
const loadDraco = async (url) => {
    await loadScript(url);
    return new Promise((resolve) => {
        const moduleName = 'DracoDecoderModule';
        window[moduleName]({
            locateFile: () => url.replace('.wasm.js', '.wasm.wasm')
        }).then((instance) => {
            window[moduleName] = instance;
            resolve();
        });
    });
};

// load an asset
const loadAsset = (asset) => {
    return new Promise((resolve, reject) => {
        const unregister = () => {
            asset.off('load', onLoad);
            asset.off('error', onError);
        };
        const onLoad = () => {
            unregister();
            resolve(asset);
        };
        const onError = (err) => {
            unregister();
            reject(err);
        };
        asset.on('load', onLoad);
        asset.on('error', onError);
        asset.registry.load(asset);
    });
};

const isString = (v) => {
    return v && ((typeof v === 'string') || (v instanceof String));
};

// initialize playcanvas
const init = async (testData) => {
    const promises = [];

    // load PlayCanvas engine
    promises.push(loadScript(testData.engine));

    // load draco
    if (testData.draco) {
        promises.push(loadDraco(testData.draco));
    }

    // initialize engine, draco
    await Promise.all(promises);
    console.log(pc.version);

    // initialize basis
    if (testData.basis) {
        pc.basisInitialize(testData.basis);
    }
};

// create the PlayCanvas app and return the testing context
const createApp = (testData) => {
    // create the test canvas
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);

    // create the app and start the update loop
    const app = new pc.Application(canvas, {
        graphicsDeviceOptions: {
            alpha: true,
            preferWebGl2: true
        }
    });

    // fix canvas resolution
    app.setCanvasResolution(pc.RESOLUTION_FIXED, 1280, 720);

    // gamma correction
    app.scene.gammaCorrection = pc.GAMMA_SRGB;
    app.scene.skyboxMip = 1;

    // create a camera
    const camera = new pc.Entity();
    camera.addComponent("camera", {
        fov: 45,
        clearColor: new pc.Color(0.4, 0.45, 0.5)
    });
    app.root.addChild(camera);

    // create a light
    const light = new pc.Entity();
    light.addComponent("light", {
        type: "directional",
        color: new pc.Color(1, 1, 1),
        intensity: 0.2,
        castShadows: true,
        shadowBias: 0.2,
        shadowDistance: 5,
        normalOffsetBias: 0.05,
        shadowResolution: 2048
    });
    light.setLocalEulerAngles(45, 30, 0);
    app.root.addChild(light);

    return {
        canvas: canvas,
        app: app,
        camera: camera,
        light: light
    };
}

// load engine resources
const loadResources = async (testData, context) => {
    const resources = {};
    const promises = [];

    const createAsset = (name, type, url) => {
        const asset = new pc.Asset(name, type, {
            url: url
        });
        context.app.assets.add(asset);
        promises.push(loadAsset(asset));
        if (!resources.hasOwnProperty(type)) {
            resources[type] = {};
        }
        resources[type][name] = asset;
    };

    // font
    createAsset('font', 'font', 'assets/Inconsolata-Regular.json');

    // env
    if (testData.env) {
        createAsset('env', 'texture', testData.env);
    }

    // test assets
    testData.assets.forEach((asset) => {
        createAsset(asset.name, asset.type, asset.url);
    });

    await Promise.all(promises);

    return resources;
};

const createMaterial = (material, resources) => {
    const result = new pc.StandardMaterial();

    const getResource = (name, type) => {
        return resources?.[type]?.[name] || null;
    };

    for (const key in material.options) {
        if (result[key] === undefined) {
            console.warn(`invalid material property '${key}'`);
        } else {
            const rawValue = material.options[key];
            const value = isString(rawValue) && rawValue[0] === '$' && getResource(rawValue.slice(1), 'texture').resource;
            result[key] = value || rawValue;
        }
    }

    result.update();
    return result;
};

const createEntity = (entity, resources, materials) => {
    let result = null;

    const getResource = (name, type) => {
        return resources?.[type]?.[name] || null;
    };

    const getMaterial = (name) => {
        return materials?.[name];
    };

    if (entity.asset) {
        const asset = getResource(entity.asset.slice(1), 'container');
        if (!asset) {
            console.warn(`invalid asset name=${entity.asset}`);
            return null;
        }
        result = asset.resource.instantiateRenderEntity();
    } else {
        result = new pc.Entity(entity.name || 'testEntity');

        const componentOptions = Object.assign({}, entity.componentOptions);
        for (const key in componentOptions) {
            const rawValue = componentOptions[key];
            const value = isString(rawValue) && rawValue[0] === '$' && getMaterial(rawValue.slice(1));
            componentOptions[key] = value || rawValue;
        }
        result.addComponent(entity.componentType, componentOptions);
    }

    const position = entity.position;
    if (position) {
        result.setLocalPosition(position[0], position[1], position[2]);
    }

    const eulerAngles = entity.eulerAngles;
    if (eulerAngles) {
        result.setLocalEulerAngles(eulerAngles[0], eulerAngles[1], eulerAngles[2]);
    }

    const scale = entity.scale;
    if (scale) {
        result.setLocalScale(scale[0], scale[1], scale[2]);
    }

    return result;
}

const step = (context, ms) => {
    // update
    context.app.systems.fire('update', ms);
    context.app.systems.fire('animationUpdate', ms);
    context.app.systems.fire('postUpdate', ms);

    // render
    context.app.root.syncHierarchy();
    context.app.batcher.updateAll();
    context.app.renderer.renderComposition(context.app.scene.layers);
};

const frame = (context) => {
    const camera = context.camera;

    // collect mesh instances from entity hierarchy
    const meshInstances = context.app.root.findComponents("render").map(c => c.meshInstances).flat();

    const bbox = new pc.BoundingBox();
    meshInstances.forEach((mi, i) => {
        bbox[i === 0 ? 'copy' : 'add'](mi.aabb);
    });

    const bboxMax = bbox.getMax();
    const distance = (bbox.halfExtents.length() * 1.4) / Math.sin(0.5 * camera.camera.fov * camera.camera.aspectRatio * pc.math.DEG_TO_RAD);
    camera.setPosition(bboxMax.x, bboxMax.y, bbox.center.z + distance);
    camera.lookAt(bbox.center);
    camera.camera.nearClip = distance / 10;
    camera.camera.farClip = distance * 10;
    context.light.light.shadowDistance = distance * 2;
};

const send = (url, canvas) => {
    const dataURItoBlob = (dataURI) => {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const dw = new DataView(ab);
        for(let i = 0; i < byteString.length; i++) {
            dw.setUint8(i, byteString.charCodeAt(i));
        }
        return new Blob([ab], {type: mimeString});
    };

    const ua = navigator.userAgent;
    const browser =
        ua.indexOf("Chrome") != -1 ? 'chrome' :
        (ua.indexOf("Safari") != -1 ? 'safari' :
        (ua.indexOf("Firefox") != -1 ? 'firefox' : 'unknown'));

    const blob = dataURItoBlob(canvas.toDataURL());
    const formData = new FormData();
    formData.append('pngimage', blob);
    formData.append('platform', browser);

    return fetch(url, {
        method: "POST",
        body: formData,
    });
};

const createLabel = (text, root, resources) => {
    const screen = new pc.Entity();
    screen.addComponent('screen', {
        referenceResolution: new pc.Vec2(1280, 720),
        scaleBlend: 0.5,
        scaleMode: pc.SCALEMODE_BLEND,
        screenSpace: true
    });

    root.addChild(screen);

    const label = new pc.Entity();
    label.setLocalPosition(0, -300, 0);
    label.addComponent('element', {
        pivot: new pc.Vec2(0.5, 0.5),
        anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
        fontAsset: resources?.font?.font?.id,
        fontSize: 21,
        text: text,
        type: pc.ELEMENTTYPE_TEXT
    });
    screen.addChild(label);

    return screen;
};

const runTest = async (testData) => {
    // initialize engine and modules
    await init(testData);

    // create the app
    const context = await createApp(testData);

    // load resources
    const resources = await loadResources(testData, context);

    // set the environment
    if (resources.texture.env) {
        const texture = resources.texture.env.resource;
        const skybox = pc.EnvLighting.generateSkyboxCubemap(texture);
        const lighting = pc.EnvLighting.generateLightingSource(texture);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        context.app.scene.envAtlas = envAtlas;
        context.app.scene.skybox = skybox;
    }

    // create materials
    const materials = { };
    (testData.materials || []).forEach((material) => {
        materials[material.name] = createMaterial(material, resources);
    });

    // create entities
    (testData.entities || []).forEach((entity) => {
        context.app.root.addChild(createEntity(entity, resources, materials));
    });

    createLabel(testData.name, context.app.root, resources);

    // render frame 0
    step(context, 1.0 / 60.0);

    // frame model
    frame(context);

    // render frame 1
    step(context);

    if (testData.send) {
        // upload screenshot
        await send(testData.send, context.canvas);

        // add named div so testing harness knows tests are complete
        const doneDiv = document.createElement('div');
        doneDiv.id = 'visual-regression-complete';
        document.body.appendChild(doneDiv);

        console.log('done');
    } else {
        // continue rendering ad infinitum
        const animationFrame = () => {
            step(context);
            window.requestAnimationFrame(animationFrame);
        }
        window.requestAnimationFrame(animationFrame);
    }
};

export {
    runTest
};
