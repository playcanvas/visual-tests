
// get a browser string
const getBrowser = () => {
    const ua = navigator.userAgent;
    return ua.indexOf("Chrome") != -1 ? 'chrome' :
          (ua.indexOf("Safari") != -1 ? 'safari' :
          (ua.indexOf("Firefox") != -1 ? 'firefox' : 'unknown'));
};

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

class TestRunner {
    constructor() {
        this.platform = getBrowser();

        // create the test canvas
        this.canvas = document.getElementById("application-canvas");

        // create the app and start the update loop
        this.app = new pc.Application(this.canvas, {
            graphicsDeviceOptions: {
                alpha: true,
                preferWebGl2: true
            }
        });
        this.device = this.app.graphicsDevice;

        // fix canvas resolution
        this.app.setCanvasResolution(pc.RESOLUTION_FIXED, 1280, 720);

        // gamma correction
        this.app.scene.gammaCorrection = pc.GAMMA_SRGB;
        this.app.scene.skyboxMip = 1;

        // create a camera
        this.camera = new pc.Entity();
        this.camera.addComponent("camera", {
            fov: 45,
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        this.app.root.addChild(this.camera);

        // create a light
        this.light = new pc.Entity();
        this.light.addComponent("light", {
            type: "directional",
            color: new pc.Color(0, 0, 0),
            intensity: 0.2,
            castShadows: true,
            shadowBias: 0.2,
            shadowDistance: 5,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        this.light.setLocalEulerAngles(45, 30, 0);
        this.app.root.addChild(this.light);
    }

    async init() {
        await this.loadFont();
        await this.initEnvLighting();
    }

    async loadFont() {
        const asset = new pc.Asset('test_font', 'font', {
            url: '/assets/Inconsolata-Regular.json'
        });
        this.app.assets.add(asset);
        await loadAsset(asset);

        const screen = new pc.Entity();
        screen.addComponent('screen', {
            referenceResolution: new pc.Vec2(1280, 720),
            scaleBlend: 0.5,
            scaleMode: pc.SCALEMODE_BLEND,
            screenSpace: true
        });
        this.app.root.addChild(screen);

        const label = new pc.Entity();
        label.setLocalPosition(0, -300, 0);
        label.addComponent('element', {
            pivot: new pc.Vec2(0.5, 0.5),
            anchor: new pc.Vec4(0.5, 0.5, 0.5, 0.5),
            fontAsset: asset.id,
            fontSize: 42,
            text: "Basic Text",
            type: pc.ELEMENTTYPE_TEXT
        });
        screen.addChild(label);

        this.font = asset.resource;
        this.screen = screen;
        this.label = label;
    }

    async initEnvLighting() {
        // load equirectangular skybox
        const asset = new pc.Asset('skybox_equi', 'texture', {
            url: 'assets/abandoned_tank_farm_01_2k.hdr'
        });
        this.app.assets.add(asset);
        await loadAsset(asset);

        const texture = asset.resource;
        const skybox = pc.EnvLighting.generateSkyboxCubemap(texture);
        const lighting = pc.EnvLighting.generateLightingSource(texture);
        const envAtlas = pc.EnvLighting.generateAtlas(lighting);
        lighting.destroy();
        this.app.scene.envAtlas = envAtlas;
        this.app.scene.skybox = skybox;
    }

    update(ms) {
        this.app.systems.fire('update', ms);
        this.app.systems.fire('animationUpdate', ms);
        this.app.systems.fire('postUpdate', ms);
    }

    render() {
        this.app.root.syncHierarchy();
        this.app.batcher.updateAll();
        this.app.renderer.renderComposition(this.app.scene.layers);
    }

    frame(entity) {
        // collect mesh instances from entity hierarchy
        const meshInstances = entity.findComponents("render").map(c => c.meshInstances).flat();

        const bbox = new pc.BoundingBox();
        meshInstances.forEach((mi, i) => {
            bbox[i === 0 ? 'copy' : 'add'](mi.aabb);
        });

        const bboxMax = bbox.getMax();
        const distance = (bbox.halfExtents.length() * 1.4) / Math.sin(0.5 * this.camera.camera.fov * this.camera.camera.aspectRatio * pc.math.DEG_TO_RAD);
        this.camera.setPosition(bboxMax.x, bboxMax.y, bbox.center.z + distance);
        this.camera.lookAt(bbox.center);
        this.camera.camera.nearClip = distance / 10;
        this.camera.camera.farClip = distance * 10;

        this.light.light.shadowDistance = distance * 2;
    }

    upload(test) {
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

        const blob = dataURItoBlob(this.canvas.toDataURL());
        const formData = new FormData();
        formData.append('pngimage', blob);
        formData.append('test', test);
        formData.append('platform', this.platform);

        fetch("upload", {
            method: "POST",
            body: formData,
        })
        .then((response) => { });
    };

    add(entity) {
        this.app.root.addChild(entity);
    }

    remove(entity) {
        this.app.root.removeChild(entity);
    }

    // search the resource context from the given resource context node to the root
    findResource(name, type, resourceContext) {
        let rc = resourceContext;
        return (rc && rc.hasOwnProperty(type) && rc[type].hasOwnProperty(name) && rc[type][name]) ||
            this.findResource(name, type, rc.parent);
    }

    // create resources of the given test
    // stage has the following structure:
    // {
    //    name: string (upload name),
    //
    //    engine: string (url)
    //
    //    env: string (url)
    // 
    //    assets: [{
    //        name: string,
    //        type: 'texture', 'container',
    //        url: string
    //    }],
    //
    //    materials: [{
    //        name: string,
    //        options: options
    //    }],
    //
    //    entities: [{
    //        name: string,
    //        asset: string,
    //        componentType: 'render', 'light'
    //        componentOptions: object,
    //        position: [x, y, z],
    //        eulerAngles: [x, y, z]
    //        scale: [x, y, z],
    //    }]
    //
    //    children: [stage, stage...]
    //
    // }
    async createResources(stage, parentResourceContext) {
        const resourceContext = {
            parent: parentResourceContext,
            stage: stage,
            assets: {},
            materials: {},
            entities: []
        };

        const handleAsset = (assetDesc) => {
            const asset = new pc.Asset(assetDesc.name, assetDesc.type, {
                url: assetDesc.url
            });
            this.app.assets.add(asset);
            return loadAsset(asset);
        };

        const handleMaterial = (materialDesc) => {
            const result = new pc.StandardMaterial();
    
            for (const key in materialDesc) {
                if (result[key] === undefined) {
                    console.warn(`invalid material property '${key}'`);
                } else {
                    const rawValue = materialDesc[key];
                    const value = isString(rawValue) && rawValue[0] === '$' && this.findResource(rawValue.slice(1), 'assets', resourceContext).resource;
                    result[key] = value || rawValue;
                }
            }
    
            result.update();
            return result;
        };

        const handleEntity = (entityDesc) => {
            let entity = null;

            if (entityDesc.asset) {
                const asset = this.findResource(entityDesc.asset.slice(1), 'assets', resourceContext);
                if (!asset) {
                    console.warn(`invalid asset name=${entityDesc.asset}`);
                    return null;
                }
                entity = asset.resource.instantiateRenderEntity();
            } else {
                entity = new pc.Entity(entityDesc.name || 'testEntity');

                const componentOptions = Object.assign({}, entityDesc.componentOptions);
                for (const key in componentOptions) {
                    const rawValue = componentOptions[key];
                    const value = isString(rawValue) && rawValue[0] === '$' && this.findResource(rawValue.slice(1), 'materials', resourceContext);
                    componentOptions[key] = value || rawValue;
                }
                entity.addComponent(entityDesc.componentType, componentOptions);
            }

            const position = entityDesc.position;
            if (position) {
                entity.setLocalPosition(position[0], position[1], position[2]);
            }

            const eulerAngles = entityDesc.eulerAngles;
            if (eulerAngles) {
                entity.setLocalEulerAngles(eulerAngles[0], eulerAngles[1], eulerAngles[2]);
            }

            const scale = entityDesc.scale;
            if (scale) {
                entity.setLocalScale(scale[0], scale[1], scale[2]);
            }

            this.app.root.addChild(entity);

            return entity;
        };

        // load assets
        const assetsArray = await Promise.all((stage.assets || []).map((a) => handleAsset(a)));
        assetsArray.forEach((a) => {
            resourceContext.assets[a.name] = a;
        });

        // create materials
        (stage.materials || []).forEach((m) => {
            resourceContext.materials[m.name] = handleMaterial(m.options);
        });

        // create entities
        resourceContext.entities = (stage.entities || []).map((e) => handleEntity(e));

        return resourceContext;
    }

    destroyResources(resourceContext) {
        resourceContext.entities.forEach((e) => {
            this.remove(e);
            e.destroy();
        });

        for (const m in resourceContext.materials) {
            resourceContext.materials[m].destroy();
        }

        for (const a in resourceContext.assets) {
            const asset = resourceContext.assets[a];
            this.app.assets.remove(asset);
            asset.unload();
        }

        return resourceContext.parent;
    }

    getPathname(resourceContext) {
        return (resourceContext.parent ? `${this.getPathname(resourceContext.parent)}/` : '') + (resourceContext?.stage?.name || '');
    }

    async evaluateTest(testStage) {
        const evaluateStage = async (stage, parentResourceContext) => {
            const resourceContext = await this.createResources(stage, parentResourceContext);

            if (!stage.hasOwnProperty('children')) {
                // frame 0
                this.update(1.0 / 60.0);
                this.render();

                // frame model
                this.frame(this.app.root);

                // frame 1
                this.update();
                this.render();

                // upload screenshot
                this.upload(this.getPathname(resourceContext));
            }

            // recurse children
            const children = stage.children;
            if (children) {
                for (let i = 0; i <children.length; ++i) {
                    await evaluateStage(children[i], resourceContext);
                }
            }

            // destroy resources
            this.destroyResources(resourceContext);
        };

        await evaluateStage(testStage, {});
    }
};

export {
    TestRunner
};
