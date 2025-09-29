// vim: set ts=4 sw=4:

export class Item {
    description;
    time;
    audio = false;  // true if item has audio content
    video = false;  // true if item has video content

    constructor(defaults) {
        Object.keys(defaults).forEach((k) => { this[k] = defaults[k] });
    }
}