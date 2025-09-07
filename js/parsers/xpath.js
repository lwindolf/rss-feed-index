// vim: set ts=4 sw=4:

import { JSDOM } from 'jsdom';

var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;
var document = jsdom.window.document;

// XPath convenience helpers

class XPath {
        static evaluate(node, expr) {                               
                // Workaround https://github.com/jsdom/jsdom/issues/2997
                if (!Object.getOwnPropertyDescriptor(globalThis, 'window')?.get?.toString().includes('[native code]') ?? false)
                        expr = expr.replaceAll('ns:', '');
                
                // Register a default resolver, otherwise we could not read Atom/RDF feeds
                let resolver = (function (element) {
                        let resolver = element.ownerDocument.createNSResolver(element);
                        let defaultNS = (new window.DOMParser).parseFromString(node.outerHTML, "text/xml").children[0].getAttribute("xmlns");

                        return function (prefix) {
                                return resolver.lookupNamespaceURI(prefix) || defaultNS;
                        };
                }(node));

                return node.ownerDocument.evaluate(
                        expr,
                        node,
                        resolver,
                        window.XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                        null,
                );
        }

        // Return textContent of 1st node match
        static lookupNode(node, expr) {
                const iter = XPath.evaluate(node, expr);
                return iter.iterateNext();
        }

        // Return textContent of 1st node match
        static lookup(node, expr) {
                const n = XPath.lookupNode(node, expr);
                return n ? n.textContent : undefined;
        }

        // Run callback on all matching nodes
        static foreach(node, expr, callback, data = null) {
                const iter = XPath.evaluate(node, expr);

                let n = iter.iterateNext();
                while (n) {
                        callback(n, data);
                        n = iter.iterateNext();
                }
        }
}

export { XPath };