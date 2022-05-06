
class TestRegistry {
    constructor() {
        this.tests = {};
    }

    register(test) {
        this.tests[test.name] = test;
    }

    getIndex() {
        return Object.keys(this.tests);
    }

    getTest(test) {
        return this.tests[test];
    }
}

export {
    TestRegistry
};
