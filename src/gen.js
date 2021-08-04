const { spawn } = require('child_process');
const Server = require('./server.js').Server;
const path = require('path');
const getBuffer = require('bent')('buffer');

// helper to exit the app
const exit = function (err) {
    if (err) {
        console.error(err);
    }
    process.exit(err ? 1 : 0);
};

// spawn the wdio test harness
const spawnWdio = function (port) {
    const test = spawn('node', [
        path.join('node_modules', '@wdio', 'cli', 'bin', 'wdio.js'),
        'run',
        './wdio.conf.js'
    ], {
        env: { ...process.env, GLTF_PORT: port }
    });

    test.stdout.on('data', (data) => {
        console.log("wdio:" + data.toString());
    });

    test.stderr.on('data', (data) => {
        console.error("wdio:" + data.toString());
    });

    test.on('error', function (err) {
        exit("wdio:" + err);
    });

    return test;
};

const run = (port, engineSource, outputDirectory, callback) => {
    // create the server
    const server = new Server(port, engineSource, outputDirectory);

    // spawn wdio session
    spawnWdio(port).on('close', (code) => {
        server.close();
        callback();
    });
};

const gen = (engineUrl, outputDirectory, port) => {
    getBuffer(engineUrl)
    .then((buffer) => buffer.toString('utf8'))
    .then((engineSource) => {
        run(port, engineSource, outputDirectory, () => {
            console.log('done');
        });
    });
};

if (process.argv.length === 4) {
    gen(process.argv[2], process.argv[3], 8080);
} else if (process.argv.length === 5) {
    gen(process.argv[2], process.argv[3], parseInt(process.argv[4]));
} else {
    console.error('specify arguments: engineUrl outputDirectory [port]');
}
