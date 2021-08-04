const { spawn } = require('child_process');
const Server = require('./server.js').Server;
const path = require('path');
const puppeteer = require('puppeteer');
const getBuffer = require('bent')('buffer');

// spawn wdio test harness
const spawnWdio = (port, doneCallback) => {
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

    test.on('error', (err) => {
        if (err) {
            console.error(err);
        }
        process.exit(err ? 1 : 0);
    });

    test.on('close', doneCallback);

    return test;
};

// spawn chrome browser
const spawnPuppeteer = (port, doneCallback) => {
    puppeteer.launch({
        devtools: false,
        args: [
            // see list of args at https://peter.sh/experiments/chromium-command-line-switches/
        ]
    }).then(async (browser) => {
        const page = await browser.newPage();
        // page.on('console', (message) => {
            // console.log(`> ${message.text()}`);
        // });
        await page.goto(`http://localhost:${port}/index.html`);
        await page.waitForSelector('#visual-regression-complete', {
            timeout: 1000 * 60 * 5
        });
        await browser.close();
        doneCallback();
    });
};

const spawnBrowser = (port, doneCallback) => {
    // use the HARNESS environment variable to select PUPPETEER or WDIO.
    // if the environment variable isn't specified default to puppetter on all
    // platforms except mac.
    const usePuppeteer = process.env.HARNESS ? (process.env.HARNESS === 'PUPPETEER') : (process.platform !== 'darwin');
    if (usePuppeteer) {
        spawnPuppeteer(port, doneCallback);
    } else {
        spawnWdio(port, doneCallback);
    }
};

// download the engine source, start a server and launch browser(s)
const run = (engineUrl, outputDirectory, port) => {
    getBuffer(engineUrl)
    .then((buffer) => buffer.toString('utf8'))
    .then((engineSource) => {
        // create the server
        const server = new Server(port, engineSource, outputDirectory);

        // spawn wdio session
        spawnBrowser(port, (code) => {
            server.close();
            console.log('done');
        });
    });
};

if (process.argv.length === 4) {
    run(process.argv[2], process.argv[3], 8080);
} else if (process.argv.length === 5) {
    run(process.argv[2], process.argv[3], parseInt(process.argv[4]));
} else {
    console.error('specify arguments: engineUrl outputDirectory [port]');
}
