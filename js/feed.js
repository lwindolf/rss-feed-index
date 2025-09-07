// vim: set ts=4 sw=4:

// DAO for feeds
//
// emits
// - nodeUpdated(node)
// - itemsAdded(node)

import { FeedUpdater } from './feedupdater.js';

export class Feed {
    // state
    id;
    error;
    orig_source;
    last_updated;
    etag;
    items = [];

    // feed content
    title;
    source;
    description;
    icon;
    metadata = {};

    // error code constants
    static ERROR_NONE = 0;
    static ERROR_AUTH = 1 << 0;
    static ERROR_NET = 1 << 1;
    static ERROR_DISCOVER = 1 << 2;
    static ERROR_XML = 1 << 3;

    constructor(defaults = {}) {
        Object.keys(defaults).forEach((k) => { this[k] = defaults[k] });

        // Ensure we do not loose the original source URL on bogus HTTP redirects
        this.orig_source = this.source;
    }

    addItem(item) {
        this.items.push(item);
    }
}
