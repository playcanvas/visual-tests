import { ShotServer } from './shot-server.js';
import puppeteer from 'puppeteer';
import request from 'request';

const download = (url, options) => {
    console.log(url);
    return new Promise((resolve, reject) => {
        request(url, options, (err, res, body) => {
            if (err || (res.status && res.status !== 200)) {
                reject(new Error(err || `err code ${res.status}`));
            } else {
                resolve(body);
            }
        });
    });
};

const run = async (testServerUrl, shotServerPort) => {
    // start the server to receive test shots
    const shotServer = new ShotServer(testServerUrl, shotServerPort);

    // get the list of tests from test server
    const testIndex = await download(`${testServerUrl}/index.json`, { json: true });

    // launch a puppeteer instance
    const browser = await puppeteer.launch({
        devtools: process.env.DEVTOOLS === '1',
        args: [
            // see list of args at https://peter.sh/experiments/chromium-command-line-switches/
            // '--enable-webgl'
        ]
    });

    const page = await browser.newPage();

    page.on('console', (message) => {
        console.log(`> ${message.text()}`);
    });

    // run through tests
    for (let i = 0; i < testIndex.length; ++i) {
        const id = testIndex[i];
        await page.goto(`${testServerUrl}/test?id=${id}&send=http://localhost:${shotServerPort}/upload?id=${id}`);
        await page.waitForSelector('#visual-regression-complete', {
            timeout: 1000 * 60 * 5
        });
    }

    await browser.close();
};

const testServerUrl = process.argv[3] || 'http://localhost:8080';
const shotServerPort = parseInt(process.argv[4] || '8081');

run(testServerUrl, shotServerPort);
