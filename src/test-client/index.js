
import { TestRunner } from "./test-runner.js";
import { gltfTests } from "./gltf-tests.js";
import { materialTests } from "./material-tests.js";

// initialize basis
const initBasis = () => {
    pc.basisInitialize({
        glueUrl: 'basis/basis.wasm.js',
        wasmUrl: 'basis/basis.wasm.wasm',
        fallbackUrl: 'basis/basis.js',
        lazyInit: true
    });
};

// load and initialize draco
const initDraco = () => {
    return new Promise((resolve) => {
        const moduleName = 'DracoDecoderModule';
        window[moduleName]({
            locateFile: () => 'draco/draco.wasm.wasm'
        }).then((instance) => {
            window[moduleName] = instance;
            resolve();
        });
    });
};

const test = {
    name: 'test',

    assets: [{
        name: 'avo',
        type: 'container',
        url: 'Avocado/glTF-Binary/Avocado.glb'
    }, {
        name: 'normal',
        type: 'texture',
        url: 'assets/flakes5n.png'
    }, {
        name: 'diffuse',
        type: 'texture',
        url: 'assets/flakes5c.png'
    }, {
        name: 'other',
        type: 'texture',
        url: 'assets/flakes5o.png'
    }],

    children: [{
        name: 'avo',

        materials: [{
            name: 'defaultMaterial',
            options: {}
        }],

        entities: [{
            name: 'entity1',
            asset: '$avo',
            position: [0, 0, 0],
            eulerAngles: [15, 30, 45],
            scale: [3, 2, 1]
        }]
    }, {
        name: 'material',
        materials: [{
            name: 'mat',
            options: {
                diffuseMap: '$diffuse',
                metalnessMap: '$other',
                metalnessMapChannel: 'r',
                glossMap: '$other',
                glossMapChannel: 'g',
                normalMap: '$normal',
                useMetalness: true,
                shininess: 100
            }
        }],
        entities: [{
            name: 'sphere',
            componentType: 'render',
            componentOptions: {
                type: 'sphere',
                material: '$mat'
            }
        }]
    }]
};

const main = async () => {
    await initBasis();
    await initDraco();

    const tests = [
        await gltfTests(),
        // await materialTests()
        test
    ].flat();

    // create test runner
    const testRunner = new TestRunner();
    await testRunner.init();

    // run tests
    for (let i = 0; i < tests.length; ++i) {
        await testRunner.evaluateTest(tests[i]);
    }

    // add named div so testing harness knows tests are complete
    const doneDiv = document.createElement('div');
    doneDiv.id = 'visual-regression-complete';
    document.body.appendChild(doneDiv);
}

main();