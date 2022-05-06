
import { Permutation } from "./permutation.js";

const FRESNEL_NONE = 0;
const FRESNEL_SCHLICK = 2;
const SPECULAR_PHONG = 0;
const SPECULAR_BLINN = 1;

const materialPermutation = [
    // base
    [
        {
            diffuseMap: '$ccDiffuse',
            metalnessMap: '$ccOther',
            metalnessMapChannel: 'r',
            glossMap: '$ccOther',
            glossMapChannel: 'g',
            normalMap: '$ccNormal',
            metalness: 1,
            shininess: 90,
            bumpiness: 0.7,
            useMetalness: true
        }
    ],
    // fresnel model
    [
        { fresnelModel: FRESNEL_NONE },
        { fresnelModel: FRESNEL_SCHLICK }
    ],
    // shading model
    [
        { shadingModel: SPECULAR_PHONG },
        { shadingModel: SPECULAR_BLINN }
    ],
    // metalness
    [
        { useMetalness: false, specular: { r: 0.5, g: 0.5, b: 0.5, a: 1.0} },
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
        { diffuse: { r: 0.6, g: 0.6, b: 0.9, a: 1.0 }, diffuseTint: true }
    ],
    // useLighting
    [
        { useLighting: true },
        { useLighting: false }
    ]
];

class MaterialTests {
    static async register(testRegistry) {
        const permutation = new Permutation(materialPermutation);
        const totalFrames = Math.ceil(permutation.total / 64);
        let idx = 0;

        for (let frame = 0; frame < totalFrames; ++frame) {
            const test = {
                name: `material/${frame}`,
                engine: "https://code.playcanvas.com/playcanvas-stable.js",
                env: "assets/abandoned_tank_farm_01_2k.hdr",
                assets: [{
                    name: 'ccNormal',
                    type: 'texture',
                    url: 'assets/flakes5n.png'
                }, {
                    name: 'ccDiffuse',
                    type: 'texture',
                    url: 'assets/flakes5c.png'
                }, {
                    name: 'ccOther',
                    type: 'texture',
                    url: 'assets/flakes5o.png'
                }],
                materials: [],
                entities: []
            };

            for (let i = 0; i < 8; ++i) {
                for (let j = 0; j < 8; ++j) {
                    const id = `${frame}_${i}_${j}`;

                    test.materials.push({
                        name: `mat_${id}`,
                        options: permutation.resolve(idx++)
                    });

                    test.entities.push({
                        name: `sphere_${id}`,
                        componentType: 'render',
                        componentOptions: {
                            type: 'sphere',
                            material: `$mat_${id}`
                        },
                        position: [i - 3.5, j - 3.5, 0]
                    });
                }
            }

            testRegistry.register(test);
        }
    }
}

export {
    MaterialTests
};
