
import { TestEnv } from "./test-env.js";
import { gltfTests } from "./gltf-tests.js";
import { materialTests } from "./material-tests.js";

// list of tests
const testList = [
    materialTests,
    gltfTests
];

// load and initialize draco
const moduleName = 'DracoDecoderModule';
window[moduleName]({
    locateFile: () => 'draco/draco.wasm.wasm'
}).then((instance) => {
    window[moduleName] = instance;

    const doneCallback = () => {
        const doneDiv = document.createElement('div');
        doneDiv.id = 'visual-regression-complete';
        document.body.appendChild(doneDiv);
    };

    const testEnv = new TestEnv(() => {
        // run through tests
        const runNextTest = (i) => {
            if (i === testList.length) {
                doneCallback();
            } else {
                testList[i](testEnv, () => runNextTest(i + 1));
            }
        };
        runNextTest(0);
    });
});
