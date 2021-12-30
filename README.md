# visual-tests

Generate screenshots of GLTF models and compare them across engine releases and/or GLTF variants.

### Installation
```
git clone https://github.sc-corp.net/PlayCanvas/visual-tests.git
cd gltf-test
npm install
git clone https://github.com/KhronosGroup/glTF-Sample-Models.git
```

### Running
```
npm run test
```
This will generate screenshots of all the example GLTF models. One set
of screenshots will be generated for the engine stable release and another for the
latest engine release. Three screenshots are generated per model, one each for:
chrome, firefox and safari.

The output HTML report is placed in `screenshots/report.html`.
