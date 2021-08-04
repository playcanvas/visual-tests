const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const crypto = require('crypto');

class Helpers {
    // extract from a screenshot image path its model, browser, engine and format
    static extractKey = (pathname) => {
        const bits = pathname.split('/').reverse();
        return bits[0] === '.DS_Store' ? null : {
            model: bits[2],
            browser: bits[0],
            engine: bits[3],
            variant: bits[1]
        };
    }

    // add a value if it doesn't already exist to the tree at the given path
    static add(tree, path, value) {
        path.forEach((p, i) => {
            if (!tree.hasOwnProperty(p)) {
                tree[p] = (i === path.length - 1) ? value : { };
            }
            tree = tree[p];
        });
        return tree;
    }
}

// compare two images, return a descriptive error message if they don't match
const imageDiff = (image1, image2) => {
    if (image1.width !== image2.width || image1.height !== image2.height) {
        return 'images have different dimensions';
    }

    let histogram = [];

    let i;

    for (i = 0; i < 16; ++i) {
        histogram.push(0);
    }

    for (i = 0; i < image1.width * image1.height * 4; ++i) {
        if (image1.data[i] !== image2.data[i]) {
            histogram[Math.floor(Math.abs(image1.data[i] - image2.data[i]) / 16)]++;
        }
    }

    const heights = [
         '▁', '▂', '▃', '▄', '▅', '▆', '▇'
    ];

    let err = false;
    let text = "";
    for (i = 0; i < histogram.length; ++i) {
        if (histogram[i] !== 0) {
            err = true;
            text += heights[Math.min(heights.length - 1, Math.floor(Math.log10(histogram[i])))];
        } else {
            text += ' ';
        }
    }

    return err ? ('mismatched pixel data |' + text + '|') : null;
};

class ImageDb {
    constructor() {
        this.tree = { };
        this.keys = { };
        this.tree2 = { };
    }

    addFile(pathname) {
        const key = Helpers.extractKey(pathname);
        if (key) {
            const hash = crypto.createHash('md5').update(fs.readFileSync(pathname)).digest('hex');
            Helpers.add(this.tree, [key.model, key.browser, hash], [ ]).push(pathname);
            Helpers.add(this.keys, ['models', key.model], 1);
            Helpers.add(this.keys, ['browsers', key.browser], 1);
            Helpers.add(this.keys, ['engines', key.engine], 1);
            Helpers.add(this.tree2, [key.model, key.browser, key.variant, key.engine], {
                hash: hash,
                pathname: pathname
            });
        }
    }

    addDirectory(dir) {
        const paths = [dir];
        while (paths.length > 0) {
            const p = paths.shift();
            const children = fs.readdirSync(p, { withFileTypes: true });
            children.forEach((child) => {
                const full = path.join(p, child.name);
                if (child.isDirectory()) {
                    paths.push(full);
                } else if (child.isFile) {
                    this.addFile(full);
                }
            })
        }
    }

    genReport(visitor) {
        const models = Object.keys(this.keys.models).sort();
        const browsers = Object.keys(this.keys.browsers).sort();
        const engines = Object.keys(this.keys.engines).sort();

        // render the report
        visitor.init(models, browsers);
        for (let m = 0; m < models.length; ++m) {
            for (let b = 0; b < browsers.length; ++b) {
                visitor.entry(m, b, this.tree[models[m]][browsers[b]]);
            }
        }
        visitor.done();

        let returnCode = 0;

        // check for missing screenshots or mismatched
        for (const [model, browsers] of Object.entries(this.tree2)) {
            for (const [browser, variants] of Object.entries(browsers)) {
                for (const [variant, enginesPresent] of Object.entries(variants)) {
                    // check if any screenshots are missing
                    engines.forEach((engine) => {
                        if (!enginesPresent.hasOwnProperty(engine)) {
                            visitor.error(`missing model=${model} browser=${browser} variant=${variant} engine=${engine}`);
                            returnCode = 1;
                        }
                    });

                    // check if screenshots match
                    const enginesPresentKeys = Object.keys(enginesPresent).sort();
                    const entry0 = enginesPresent[enginesPresentKeys[0]];
                    for (let i = 1; i < enginesPresentKeys.length; ++i) {
                        const entryI = enginesPresent[enginesPresentKeys[i]];
                        if (entryI.hash !== entry0.hash) {
                            const diffText = imageDiff(PNG.sync.read(fs.readFileSync(entry0.pathname)),
                                                       PNG.sync.read(fs.readFileSync(entryI.pathname)));
                            if (diffText) {
                                visitor.error(`${diffText} ${entry0.pathname} ${entryI.pathname}`);
                                returnCode = 1;
                            }
                        }
                    }
                }
            }
        }

        return returnCode;
    }
}

class ReportVisitor {
    constructor(outputPathname) {
        this.outputPathname = outputPathname;
        this.outputDir = path.dirname(outputPathname);

        this.models = null;
        this.browsers = null;
        this.table = [];

        this.html = [];
    }

    init(models, browsers) {
        this.models = models;
        this.browsers = browsers;
        for (let i = 0; i < models.length; ++i) {
            this.table[i] = [];
        }
    }

    entry(modelIndex, browserIndex, hashes) {
        this.table[modelIndex][browserIndex] = hashes;
    }

    done() {
        this.put(`<!DOCTYPE html>`);
        this.put(`<html>`);
        this.put(`<head>`);
        this.put(`    <title>diff</title>`);
        this.put(`    <meta charset="utf-8">`);
        this.put(`    <meta name="description" content="PC">`);
        this.put(`    <style>`)
        this.put(`        table, td {`);
        this.put(`            border: 1px solid #333;`);
        this.put(`        }`);
        this.put(`        thead, tfoor {`);
        this.put(`            background-color: #333;`);
        this.put(`            color: #fff;`)
        this.put(`        }`);
        this.put(`        img {`);
        this.put(`            width: 160px;`);
        this.put(`            height: 120px;`);
        this.put(`        }`);
        this.put(`    </style>`);
        this.put(`</head>`);
        this.put(`<body>`);

        this.open(`table`);
        this.open('thead');
        this.open('tr');
        this.tag('th', 'model');
        this.browsers.forEach((b) => {
            this.tag('th', b);
        });
        this.close('thead');
        this.open('tbody');
        for (let m = 0; m < this.models.length; ++m) {
            this.open('tr');
            this.tag('td', this.models[m]);
            for (let b = 0; b < this.browsers.length; ++b) {
                this.open(`td`);
                for (const [hash, images] of Object.entries(this.table[m][b])) {
                    const tags = images.reduce((a, i) => {
                        const key = Helpers.extractKey(i);
                        return a + (a ? '\n' : '') + `${key.engine}/${key.variant}`;
                    }, '');

                    const p = path.relative(this.outputDir, images[0]);
                    this.open(`a href="${p}" target="_blank" title="${tags}"`);
                    this.open(`img src="${p}"`);
                    this.close(`a`);
                }
                this.close(`td`);
            }
            this.close('tr');
        }
        this.close('tbody');
        this.close(`table`);

        this.close(`body`);
        this.close(`html`);

        // write the output file
        fs.writeFileSync(this.outputPathname, this.html.join('\n'), 'utf8');
    }

    put(text) {
        this.html.push(text);
    }

    open(tag) {
        this.put(`<${tag}>`);
    }

    close(tag) {
        this.put(`</${tag}>`);
    }

    tag(tag, value) {
        this.open(tag);
        this.put(value);
        this.close(tag);
    }

    error(msg) {
        console.error(msg);
    }
}

if (process.argv.length >= 5) {
    const imageDb = new ImageDb();
    for (let i = 3; i < process.argv.length; ++i) {
        imageDb.addDirectory(process.argv[i]);
    }
    const exitCode = imageDb.genReport(new ReportVisitor(process.argv[2]));
    process.exit(exitCode);
} else {
    console.error('specify arguments: outputFilename dir1 dir2 ...');
}
