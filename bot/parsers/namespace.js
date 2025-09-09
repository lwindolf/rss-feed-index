// vim: set ts=4 sw=4:

// Generic RSS namespaces parser

import { DateParser } from './date.js';
import { XPath } from './xpath.js';
import { JSDOM } from 'jsdom';
var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;

export class NamespaceParser {
    /**
     * Returns the root node of a given document
     * 
     * @param {*} doc    the DOM document
     * @returns         the root node
     */
    static getRootNode(doc) {
        let root = doc.firstChild;
        while (root.nodeType != 1) {
            root = root.nextSibling;
        }
        return root;
    }

    /**
     * Returns list of all namespaces defined in root node
     * 
     * @param {*} root    the DOM root
     * @returns           list of namespace strings
     */
    static getNamespaces(root) {
        const nsList = [];
        if (!root.attributes) {
            console.debug("No attributes!", root);
            return nsList;
        }
        for (let i = 0; i < root.attributes.length; i++) {
            const attr = root.attributes[i];
            if (attr.name.startsWith('xmlns:')) {
                nsList.push(attr.name.substring(6));
            }
        }
        return nsList;
    }

    /**
     * Parse all RSS namespace childs of a given DOM node
     * 
     * @param {*} root        the DOM root
     * @param {*} node        the item DOM node
     * @param {*} item        the item
     */
    static parseItem(root, node, item) {
        // Make list of all namespaces defined in root node, we must only
        // match for present namespaces
        const nsList = this.getNamespaces(root);

        // Dublin Core support
        if (nsList.includes('dc')) {
            if (!item.description)
                item.description = XPath.lookup(node, 'dc:description');
            // FIXME: missing dc:content handling (e.g. https://www.tomshardware.com/feeds.xml)
            if (!item.time)
                item.time = DateParser.parse(XPath.lookup(node, 'dc:date'));
        }

        // Content support
        if (nsList.includes('content')) {
            const n = XPath.lookupNode(node, 'content:encoded');
            if (n) {
                try {
                    // Always override description
                    const parser = new window.DOMParser();
                    const doc = parser.parseFromString(`<a>${n.innerHTML}</a>`, 'text/xml');
                    // FIXME: limit extract to body only
                    item.description = doc.documentElement.textContent;
                } catch (e) {
                    console.log(`Failed to parse <content:encoded> (${e})!`);
                }
            }
        }

        // Media support
        if (nsList.includes('media')) {
            /*
                Maximual definition could look like this:
            
                <media:content 
                        url="http://www.foo.com/movie.mov" 
                        fileSize="12216320" 
                        type="video/quicktime"
                        medium="video"
                        isDefault="true" 
                        expression="full" 
                        bitrate="128" 
                        framerate="25"
                        samplingrate="44.1"
                        channels="2"
                        duration="185" 
                        height="200"
                        width="300" 
                        lang="en" />
                    
                (example quoted from specification)
            */
            XPath.foreach(node, '//media:content', (n) => {
                item.addMedia(
                    XPath.lookup(n, '@url'),
                    XPath.lookup(n, '@type') || XPath.lookup(n, '@medium'),
                    XPath.lookup(n, '@duration')
                );
            });

            return nsList;
        }
    }
}