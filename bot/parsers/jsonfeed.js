// vim: set ts=4 sw=4:

// https://www.jsonfeed.org/version/1.1/

import { DateParser } from './date.js';
import { Feed } from '../feed.js';
import { Item } from '../item.js';

class JSONFeedParser {
    static id = 'json';

    static parseItem(i) {
        if (this.itemCount >= 15)
            return;

        let item = new Item({
            description: i.content_html || i.content_text || i.summary,
            time: DateParser.parse(i.updated || i.date_published)
        });

        if (i.attachments && i.attachments.length > 0)
            this.media = true;

        this.addItem(item);
    }

    static parse(str) {
        const data = JSON.parse(str);

        let feed = new Feed({
            type: this.id,
            title: data.title,
            description: data.description
        });

        if (data.items && Array.isArray(data.items))
                data.items.forEach(this.parseItem, feed);

        return feed;
    }
}

export { JSONFeedParser };
