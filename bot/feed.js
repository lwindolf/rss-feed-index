// vim: set ts=4 sw=4:

export class Feed {
    title;
    source;
    description;
    audio = false;          // true if audio content is present
    video = false;          // true if video content is present
    itemCount = 0;          // number of all items parsed
    itemContentSize = 0;    // sum of all items content in bytes
    mostRecentItemTime = 0; // timestamp of the most recent item

    // error code constants
    static ERROR_NONE = 0;
    static ERROR_AUTH = 1 << 0;
    static ERROR_NET = 1 << 1;
    static ERROR_DISCOVER = 1 << 2;
    static ERROR_XML = 1 << 3;

    constructor(defaults = {}) {
        Object.keys(defaults).forEach((k) => { this[k] = defaults[k] });
    }

    addItem(item) {
        this.itemCount++;
        if (item.description)
            this.itemContentSize += item.description.length;
        if (item.time > this.mostRecentItemTime)
            this.mostRecentItemTime = item.time;
        if (item.audio)
            this.audio = true;
        if (item.video)
            this.video = true;
    }
}
