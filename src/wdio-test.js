it('gltf-test', async () => {
    // get the browser window size
    const windowSize = await browser.getWindowSize();

    // get the browser viewport size
    const viewportSize = await browser.execute(() => {
        return {
            width: Math.max(
                document.documentElement.clientWidth,
                window.innerWidth || 0
            ),
            height: Math.max(
                document.documentElement.clientHeight,
                window.innerHeight || 0
            ),
        };
    });

    const dressingWidth = windowSize.width - viewportSize.width;
    const dressingHeight = windowSize.height - viewportSize.height;
    const port = process.env.GLTF_PORT || 8080;

    await browser.setWindowSize(800 + dressingWidth, 600 + dressingHeight);
    await browser.url(`http://localhost:${port}/index.html`);
    const element = await $('#visual-regression-complete');
    await element.waitForExist({ timeout: 1000 * 60 * 5 });
});
