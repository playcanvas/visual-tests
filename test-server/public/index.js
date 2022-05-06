import { runTest } from './test-runner.js';

fetch('test.json')
    .then(response => response.json())
    .then(data => runTest(data));
