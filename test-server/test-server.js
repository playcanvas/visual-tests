import express from 'express';
import path from 'path';
import url from 'url';

const __dirname = path.resolve();

class TestServer {
    constructor(port, testRegistry, htmlTemplate) {
        const app = express();

        const indexHtml = this.renderIndexHtml(testRegistry, htmlTemplate);

        // return test data based on referrer id
        app.use('/test/test.json', (req, res, next) => {
            const urlParts = url.parse(req.get('Referer'), true);

            const test = Object.assign(
                {},
                testRegistry.getTest(urlParts.query.id) || {},
                urlParts.query);

            res.json(test);
        });

        // tests map to public directory
        app.use('/test', express.static(`${__dirname}/public`));

        // base maps to index.html listing tests
        app.use('/', (req, res, next) => {
            res.send(indexHtml);
        });

        // debug output missed files
        app.use('*', (req, res, next) => {
            console.warn(`missing url=${req.url}`);
        });

        this.server = app.listen(port);

        console.log(`server is up on port=${port}`);
    }

    close() {
        this.server.close();
    }

    renderIndexHtml(testRegistry, htmlTemplate) {
        const htmlTestEntries = testRegistry.getIndex().map((index) => {
            return `<tr><th><a href="/test?id=${index}">${index}</a></th></tr>`
        }).join('\n');
    
        const bodyContent = `<table>${htmlTestEntries}\n</table>\n`;
    
        // generate index.html
        return htmlTemplate.replace('$BODY_CONTENT', bodyContent);
    }    
}

export {
    TestServer
};
