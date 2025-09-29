// vim: set ts=4 sw=4:

// Atom 1.0 support, 0.3 is not supported
//
// Specification https://www.ietf.org/rfc/rfc4287.txt

import { DateParser } from './date.js';
import { NamespaceParser } from './namespace.js'
import { XPath } from './xpath.js';
import { Feed } from '../feed.js';
import { Item } from '../item.js';
import { JSDOM } from 'jsdom';
var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;

class AtomParser {
    static id = 'atom';
    static autoDiscover = [
        '/ns:feed/ns:entry'
    ];

    static parseEntry(node, ctxt) {
        if (ctxt.feed.itemCount >= 15)
            return;

        let item = new Item({
            description: XPath.lookup(node, 'ns:summary'),
            time: DateParser.parse(XPath.lookup(node, 'ns:updated'))
        });

        if (XPath.lookup(node, 'ns:content'))
            item.description = XPath.lookup(node, 'ns:content');

        NamespaceParser.parseItem(ctxt.root, node, item);

        ctxt.feed.addItem(item);
    }

    static parse(str) {
        const parser = new window.DOMParser();
        const doc = parser.parseFromString(str, 'application/xml');
        const root = NamespaceParser.getRootNode(doc);

        let feed = new Feed({
            type: 'atom',
            ns: NamespaceParser.getNamespaces(root, str),
            title: XPath.lookup(root, '/ns:feed/ns:title'),
            description : XPath.lookup(root, '/ns:feed/ns:summary')
        });

        XPath.foreach(root, '/ns:feed/ns:entry', this.parseEntry, { root, feed });

        return feed;
    }
}

export { AtomParser };