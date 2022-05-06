import { TestServer } from './test-server.js';
import { TestRegistry } from './test-registry.js';
import { GltfTests } from './gltf-tests.js';
import { MaterialTests } from './material-tests.js';
import { readFile }from 'fs/promises';

const run = async (port) => {
    const testRegistry = new TestRegistry();
    await MaterialTests.register(testRegistry);
    await GltfTests.register(testRegistry);

    const htmlTemplate = await readFile('index-template.html', { encoding: 'utf8' });

    return new TestServer(port, testRegistry, htmlTemplate);
};

// specify server port
run(process.argv.length === 3 ? parseInt(process.argv[2]) : 8080);
