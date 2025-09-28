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
            if (!item.time)
                item.time = DateParser.parse(XPath.lookup(node, 'dc:date'));
        }

        // Content support
        if (nsList.includes('content')) {
            const n = XPath.lookupNode(node, 'content:encoded');
            if (n) {
                try {
                    // no parsing as we just want to know the length
                    item.description = n.innerHTML;
                } catch (e) {
                    console.log(`Failed to parse <content:encoded> (${e})!`);
                }
            }
        }

        // Media support
        if (nsList.includes('media')) {
            node.media = true;

            return nsList;
        }
    }
}