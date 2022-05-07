import express from 'express';
import fileupload from 'express-fileupload';
import path from 'path';
import fs from 'fs';
import url from 'url';

const outputDirectory = 'screenshots';

class ShotServer {
    constructor(testServerUrl, port) {
        const app = express();

        // Add headers before the routes are defined
        app.use((req, res, next) => {
            // Website you wish to allow to connect
            res.setHeader('Access-Control-Allow-Origin', testServerUrl);

            // Request methods you wish to allow
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

            // Request headers you wish to allow
            res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

            // Set to true if you need the website to include cookies in the requests sent
            // to the API (e.g. in case you use sessions)
            // res.setHeader('Access-Control-Allow-Credentials', true);

            // Pass to next layer of middleware
            next();
        });
        
        // support file upload
        app.use(fileupload());

        // store file uploads
        app.post('/upload', (req, res) => {

            const image = req.files.pngimage;
            const id = req.query.id;
            const browser = req.body.browser;
            const dir = path.join(outputDirectory, id);
            const filename = path.join(dir, browser + '.png');

            console.log('writing file=' + filename);

            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            image.mv(filename, (error) => {
                if (error) {
                    console.error(error);
                    res.writeHead(500, {
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({ status: 'error', message: error }));
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'application/json'
                    });
                    res.end(JSON.stringify({ status: 'success', path: path.join('images', image.name) }));
                }
            });
        });

        this.server = app.listen(port);
    }

    close() {
        this.server.close();
    }
}

export {
    ShotServer
};
