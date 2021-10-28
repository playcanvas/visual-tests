const express = require('express');
const fileupload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

class Server {
    constructor(port, engineSource, outputDirectory) {
        const app = express();

        // serve static files
        app.use('/', express.static('./glTF-Sample-Models/2.0/'));
        app.use('/index.html', express.static('./src/index.html'));
        app.use('/draco', express.static('./draco'));
        app.use('/playcanvas.js', (req, res, next) => {
            res.type('.js');
            res.send(engineSource);
        });

        // support file upload
        app.use(fileupload());

        // store file uploads
        app.post('*/upload', (req, res) => {
            const image = req.files.pngimage;
            const test = req.body.test;
            const platform = req.body.platform;
            const dir = path.join(outputDirectory, test);
            const filename = path.join(dir, platform + '.png');

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

        // debug output missed files
        app.use('/', (req, res, next) => {
            console.warn(`missing url=${req.url}`);
        });

        this.server = app.listen(port);

        console.log(`server is up on port=${port}`);
    }

    close() {
        this.server.close();
    }
}

exports.Server = Server;
