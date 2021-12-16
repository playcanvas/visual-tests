
// get a browser string
const getBrowser = () => {
    const ua = navigator.userAgent;

    if (ua.indexOf("Chrome") != -1) {
        return 'chrome';
    }

    if (ua.indexOf("Safari") != -1) {
        return 'safari';
    }

    if (ua.indexOf("Firefox") != -1) {
        return 'firefox';
    }

    return 'unknown';
};

class TestEnv {
    constructor(doneCallback) {
        this.platform = getBrowser();

        // create the test canvas
        this.canvas = document.getElementById("application-canvas");

        // create the app and start the update loop
        this.app = new pc.Application(this.canvas, {
            graphicsDeviceOptions: {
                alpha: false,
                preferWebGl2: true
            }
        });
        this.device = this.app.graphicsDevice;

        // fix canvas resolution
        this.app.setCanvasResolution(pc.RESOLUTION_FIXED, 800, 600);

        // gamma correction
        this.app.scene.gammaCorrection = pc.GAMMA_SRGB;
        this.app.scene.skyboxMip = 1;

        // create the camera
        this.camera = new pc.Entity();
        this.camera.addComponent("camera", {
            fov: 45,
            clearColor: new pc.Color(0.4, 0.45, 0.5)
        });
        this.app.root.addChild(this.camera);

        // create the entity
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

        // initialize environment lighting
        this.initEnvLighting(doneCallback);
    }

    initSkyboxFromTexture(texture) {
        if (pc.EnvLighting) {
            // new (1.51) lighting
            const skybox = pc.EnvLighting.generateSkyboxCubemap(texture);
            const lighting = pc.EnvLighting.generateLightingSource(texture);
            const envAtlas = pc.EnvLighting.generateAtlas(lighting);
            lighting.destroy();
            this.app.scene.envAtlas = envAtlas;
            this.app.scene.skybox = skybox;
        } else {
            // old (pre-1.51) lighting
            const app = this.app;
            const device = app.graphicsDevice;
    
            const cubemaps = [];
    
            const reprojectToCubemap = (src, size) => {
                // generate faces cubemap
                const faces = new pc.Texture(device, {
                    name: 'skyboxFaces',
                    cubemap: true,
                    width: size,
                    height: size,
                    type: pc.TEXTURETYPE_RGBM,
                    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
                    fixCubemapSeams: false,
                    mipmaps: false
                });
                pc.reprojectTexture(src, faces);
    
                return faces;
            };
    
            if (texture.cubemap) {
                // @ts-ignore TODO type property missing from pc.Texture
                if (texture.type === pc.TEXTURETYPE_DEFAULT || texture.type === pc.TEXTURETYPE_RGBM) {
                    // cubemap format is acceptable, use it directly
                    cubemaps.push(texture);
                } else {
                    // cubemap must be rgbm or default to be used on the skybox
                    cubemaps.push(reprojectToCubemap(skybox, texture.width));
                }
            } else {
                // @ts-ignore TODO type property missing from pc.Texture
                texture.projection = pc.TEXTUREPROJECTION_EQUIRECT;
                // reproject equirect to cubemap for skybox
                cubemaps.push(reprojectToCubemap(texture, texture.width / 4));
            }
    
            // generate prefiltered lighting data
            const sizes = [128, 64, 32, 16, 8, 4];
            const specPower = [1, 512, 128, 32, 8, 2];
            for (let i = 0; i < sizes.length; ++i) {
                const prefilter = new pc.Texture(device, {
                    cubemap: true,
                    name: 'skyboxPrefilter' + i,
                    width: sizes[i],
                    height: sizes[i],
                    type: pc.TEXTURETYPE_RGBM,
                    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
                    fixCubemapSeams: true,
                    mipmaps: false
                });
    
                pc.reprojectTexture(cubemaps[1] || texture, prefilter, {
                    numSamples: 4096,
                    specularPower: specPower[i]
                });
    
                cubemaps.push(prefilter);
            }
    
            // assign the textures to the scene
            app.scene.skyboxRotation.setFromEulerAngles(0, 90, 0);
            app.scene.setSkybox(cubemaps);
        }
    };

    initEnvLighting(doneCallback) {
        // load equirectangular skybox
        const asset = new pc.Asset('skybox_equi', 'texture', {
            url: 'assets/abandoned_tank_farm_01_2k.hdr'
        });
        asset.ready(() => {
            this.initSkyboxFromTexture(asset.resource);
            doneCallback();
        });
        this.app.assets.add(asset);
        this.app.assets.load(asset);
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

    frame(meshInstances) {
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

    dataURItoBlob(dataURI) {
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var dw = new DataView(ab);
        for(var i = 0; i < byteString.length; i++) {
            dw.setUint8(i, byteString.charCodeAt(i));
        }
        return new Blob([ab], {type: mimeString});
    }

    upload(test) {
        const blob = this.dataURItoBlob(this.canvas.toDataURL());

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
};


export {
    TestEnv
};
