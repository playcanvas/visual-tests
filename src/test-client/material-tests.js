
import { AssetLoader } from "./asset-loader.js";
import { Permutation } from "./permutation.js";

class MaterialTest {
    constructor(testRunner) {
        this.testRunner = testRunner;
        this.materials = [];
        this.entities = [];
    }

    get manifest() {
        return {
            env: { type: 'texture', url: 'assets/artist_workshop_2k.hdr' },
            ccNormal: { type: 'texture', url: 'assets/flakes5n.png' },
            ccDiffuse: { type: 'texture', url: 'assets/flakes5c.png' },
            ccOther: { type: 'texture', url: 'assets/flakes5o.png' },
        };
    }

    prepare(assets) {
        this.permutation = this.createPermutation(assets);
        this.idx = 0;

        this.testRunner.camera.setPosition(0, 0, 10);
        this.testRunner.camera.lookAt(0, 0, 0);
        this.testRunner.camera.camera.nearClip = 0.1;
        this.testRunner.camera.camera.farClip = 1000;

        return Math.ceil(this.permutation.total / 64);
    }

    frame(n) {
        for (let i = 0; i < 8; ++i) {
            for (let j = 0; j < 8; ++j) {
                const config = this.permutation.resolve(this.idx++);
                const material = this.createMaterial(config);
                const sphere = this.createSphere(material, {
                    x: i - 3.5,
                    y: j - 3.5,
                    z: 0
                });
                this.testRunner.add(sphere);
                this.materials.push(material);
                this.entities.push(sphere);
            }
        }
    }

    cleanup(n) {
        this.entities.forEach((entity) => {
            this.testRunner.remove(entity);
            entity.destroy();
        });
        this.materials.forEach((material) => {
            material.destroy();
        })

        this.entities = [];
        this.materials = [];
    }

    createPermutation(assets) {
        return new Permutation([
            // base
            [
                {
                    diffuseMap: assets.ccDiffuse,
                    metalnessMap: assets.ccOther,
                    metalnessMapChannel: 'r',
                    glossMap: assets.ccOther,
                    glossMapChannel: 'g',
                    normalMap: assets.ccNormal,
                    metalness: 1,
                    shininess: 90,
                    bumpiness: 0.7,
                    useMetalness: true
                }
            ],
            // fresnel model
            [
                { fresnelModel: pc.FRESNEL_NONE },
                { fresnelModel: pc.FRESNEL_SCHLICK }
            ],
            // shading model
            [
                { shadingModel: pc.SPECULAR_PHONG },
                { shadingModel: pc.SPECULAR_BLINN }
            ],
            // metalness
            [
                { useMetalness: false, specular: new pc.Color(0.5, 0.5, 0.5) },
                { useMetalness: true, metalness: 0 },
                { useMetalness: true, metalness: 0.5 },
                { useMetalness: true, metalness: 1 }
            ],
            // clearcoat
            [
                { },
                { clearCoat: 0.25, clearCoatGlossiness: 0.8 }
            ],
            // diffuse
            [
                { },
                { diffuse: new pc.Color(0.6, 0.6, 0.9), diffuseTint: true }
            ],
            // useLighting
            [
                { useLighting: true },
                { useLighting: false }
            ]
        ]);
    }

    createMaterial = (options) => {
        const result = new pc.StandardMaterial();

        for (const key in options) {
            if (result[key] === undefined) {
                console.warn(`invalid material property '${key}'`);
            }
            result[key] = options[key];
        }

        result.update();
        return result;
    }

    createSphere = (material, options) => {
        const sphere = new pc.Entity();
        sphere.addComponent("render", {
            material: material,
            type: "sphere"
        });
        if (options.hasOwnProperty("x")) {
            sphere.setLocalPosition(options.x, options.y, options.z);
        }
        if (options.hasOwnProperty("scale")) {
            sphere.setLocalScale(options.scale)
        }
        return sphere;
    }
}

const materialTests = async () => {
    const assetLoader = new AssetLoader(testRunner.app.assets);
    const test = new MaterialTest(testRunner);
    assetLoader.load(test.manifest, (err, assets) => {
        // prepare
        const totalFrames = test.prepare(assets);

        for (let frame = 0; frame < totalFrames; ++frame) {
            // test render
            test.frame(frame);

            // frame 0
            testRunner.update(1.0 / 60.0);
            testRunner.render();

            // frame 1
            testRunner.update();
            testRunner.render();

            // upload screenshot
            testRunner.upload(`engineMaterials/page_${frame}`);

            // test cleanup
            test.cleanup(frame);
        }

        // destroy assets
        assetLoader.destroy();
    });
}

export {
    materialTests
};
