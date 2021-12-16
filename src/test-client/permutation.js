// object permutation
class Permutation {
    // data is an array of arrays
    // inner array contains objects that will be combined
    constructor(data) {
        this.data = data;

        // count total permutations
        this.total = 1;
        for (let i = 0; i < data.length; ++i) {
            this.total *= data[i].length;
        }

        // calculate dimension sizes
        this.dimSizes = [1];
        for (let i = 1; i < data.length; ++i) {
            this.dimSizes[i] = this.dimSizes[i - 1] * data[i - 1].length;
        }
    }

    resolve(idx) {
        // wrap idx
        idx = idx % this.total;

        // get dimension coords
        const coords = [];
        for (let i = this.data.length - 1; i >= 0; --i) {
            const coord = Math.floor(idx / this.dimSizes[i]);
            coords.unshift(coord);
            idx = idx % this.dimSizes[i];
        }

        // build resulting permutated object
        const result = { };
        for (let i = 0; i < this.data.length; ++i) {
            Object.assign(result, this.data[i][coords[i]]);
        }

        return result;
    }
}

export {
    Permutation
};
