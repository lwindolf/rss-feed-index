// vim: set ts=4 sw=4:

export class Item {
    description;
    time;

    constructor(defaults) {
        Object.keys(defaults).forEach((k) => { this[k] = defaults[k] });
    }
}