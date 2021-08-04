const fs = require('fs');
const path = require('path');
const PNG = require('pngjs').PNG;
const crypto = require('crypto');

class Helpers {
    // given a path to a screenshot, extract the model, browser, engine and format
    static extractKey = (pathname) => {
        const bits = pathname.split('/').reverse();
        return bits[0] === '.DS_Store' ? null : {
            model: bits[2],
            browser: bits[0],
            engine: bits[3],
            variant: bits[1]
        };
    }

    // add a value (if it doesn't already exist) to the tree at the given tree path
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
    }

    addFile(pathname) {
        const key = Helpers.extractKey(pathname);
        if (key) {
            const hash = crypto.createHash('md5').update(fs.readFileSync(pathname)).digest('hex');
            Helpers.add(this.tree, [key.model, key.browser, hash], [ ]).push(pathname);
            Helpers.add(this.keys, ['models', key.model], 1);
            Helpers.add(this.keys, ['browsers', key.browser], 1);
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

        visitor.init(models, browsers);

        for (let m = 0; m < models.length; ++m) {
            for (let b = 0; b < browsers.length; ++b) {
                visitor.entry(m, b, this.tree[models[m]][browsers[b]]);
            }
        }

        visitor.done();
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
}

if (process.argv.length === 5) {
    const imageDb = new ImageDb();
    imageDb.addDirectory(process.argv[2]);
    imageDb.addDirectory(process.argv[3]);
    imageDb.genReport(new ReportVisitor(process.argv[4]));
} else {
    console.error('specify arguments: dir1 dir2 [outputFilename]');
}