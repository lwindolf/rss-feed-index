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

        static parseEntryLink(node, ctxt) {
                let href = XPath.lookup(node, '@href');
                let type = XPath.lookup(node, '@type');
                let rel  = XPath.lookup(node, '@rel');

                if(href) {
                        // Always prefer those types of links
                        if((ctxt.sourceType !== 'alternate_or_text/html') &&
                            ((rel && rel === 'alternate') ||
                             (type && type === 'text/html'))) {
                                ctxt.sourceType = 'alternate_or_text/html';
                                ctxt.source = href;
                                return
                        }

                        // But also allow for a plain link
                        if(!ctxt.source)
                                ctxt.source = href;
                }
        }

        static parseEntry(node, ctxt) {
                let item = new Item({
                        title       : XPath.lookup(node, 'ns:title'),
                        description : XPath.lookup(node, 'ns:summary'),
                        // FIXME support atom:content
                        sourceId    : XPath.lookup(node, 'ns:id'),
                        time        : DateParser.parse(XPath.lookup(node, 'ns:updated'))
                });

                NamespaceParser.parseItem(ctxt.root, node, item);

                XPath.foreach(node, 'ns:link', AtomParser.parseEntryLink, item);

                ctxt.feed.addItem(item);
        }

        static parse(str) {              
                const parser = new window.DOMParser();
                const doc = parser.parseFromString(str, 'application/xml');
                const root = NamespaceParser.getRootNode(doc);

                let feed = new Feed({
                        type        : 'atom',
                        ns          : NamespaceParser.getNamespaces(root),
                        error       : XPath.lookup(root, '/parsererror'),
                        title       : XPath.lookup(root, '/ns:feed/ns:title'),
                        icon        : XPath.lookup(root, '/ns:feed/ns:icon'),
                        description : XPath.lookup(root, '/ns:feed/ns:summary'),
                        homepage    : XPath.lookup(root, "/ns:feed/ns:link[@rel='alternate']/@href") ||
                                      XPath.lookup(root, "/ns:feed/ns:link/@href")
                });

                //XPath.foreach(root, '/ns:feed/ns:entry', this.parseEntry, { root, feed });

                return feed;
        }
}

export { AtomParser };