// vim: set ts=4 sw=4:

// RSS 1.1 and 2.0 parser, 0.9x is not supported
// RSS 1.0 is parsed in rdf.js

import { DateParser } from './date.js';
import { NamespaceParser } from './namespace.js'
import { XPath } from './xpath.js';
import { Feed } from '../feed.js';
import { Item } from '../item.js';
import { JSDOM } from 'jsdom';
var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;

class RSSParser {
    static id = 'rss';
    static autoDiscover = [
        '/rss/channel',
        '/Channel/items'
    ];

    static parseItem(node, ctxt) {
        let item = new Item({
            title       : XPath.lookup(node, 'title'),
            description : XPath.lookup(node, 'description'),
            source      : XPath.lookup(node, 'link'),
            // RSS 2.0 only
            sourceId    : XPath.lookup(node, 'guid'),
            time        : DateParser.parse(XPath.lookup(node, 'pubDate'))
        });

        XPath.foreach(node, 'enclosure', (n) => 
            item.addMedia(
                XPath.lookup(n, '@url'),
                XPath.lookup(n, '@type')
            )
        );

        NamespaceParser.parseItem(ctxt.root, node, item);
        
        ctxt.feed.addItem(item);
    }

    static parse(str) {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(str, 'application/xml');
        const root = NamespaceParser.getRootNode(doc);
        let feed = new Feed({
            feed: 'rss',
            ns: NamespaceParser.getNamespaces(root),
            error: XPath.lookup(root, '/parsererror'),
        });

        // RSS 1.1
        if (doc.firstChild.nodeName === 'Channel') {
            feed.type        = 'rss1.1';
            feed.title       = XPath.lookup(root, '/Channel/title');
            feed.description = XPath.lookup(root, '/Channel/description');
            feed.homepage    = XPath.lookup(root, '/Channel/link');

            //XPath.foreach(root, '/Channel/items/item', this.parseItem, { root, feed });
        }

        // RSS 2.0
        if (doc.firstChild.nodeName === 'rss') {
            feed.type        = 'rss2.0';
            feed.lang        = XPath.lookup(root, '/rss/channel/language');
            feed.title       = XPath.lookup(root, '/rss/channel/title');
            feed.description = XPath.lookup(root, '/rss/channel/description');
            feed.homepage    = XPath.lookup(root, '/rss/channel/link');

            //XPath.foreach(root, '/rss/channel/item', this.parseItem, { root, feed });
        }

        return feed;
    }
}

export { RSSParser };