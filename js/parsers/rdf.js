// vim: set ts=4 sw=4:

// RSS 1.0 parser

import { NamespaceParser } from './namespace.js'
import { XPath } from './xpath.js';
import { Feed } from '../feed.js';
import { Item } from '../item.js';
import { JSDOM } from 'jsdom';
var jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
var window = jsdom.window;

class RDFParser {
	static id = 'rdf';
	static autoDiscover = [
		'/rdf:RDF/ns:channel'
	];

	static parseItem(node, ctxt) {
		let item = new Item({
			title       : XPath.lookup(node, 'ns:title'),
			description : XPath.lookup(node, 'ns:description'),
			source      : XPath.lookup(node, 'ns:link'),
		});

		NamespaceParser.parseItem(ctxt.root, node, item);
		
		ctxt.feed.addItem(item);
	}

	static parse(str) {
		const parser = new window.DOMParser();
		const doc = parser.parseFromString(str, 'application/xml');
		const root = NamespaceParser.getRootNode(doc);
		let feed = new Feed({
			error: XPath.lookup(root, '/parsererror'),
		});

		// RSS 1.0
		if (doc.firstChild.nodeName === 'rdf:RDF') {
			feed.type 	     = 'rss1.0';
			feed.ns          = NamespaceParser.getNamespaces(root);
			feed.title       = XPath.lookup(root, '/rdf:RDF/ns:channel/ns:title');
			feed.description = XPath.lookup(root, '/rdf:RDF/ns:channel/ns:description');
			feed.homepage    = XPath.lookup(root, '/rdf:RDF/ns:channel/ns:link');

			XPath.foreach(root, '/rdf:RDF/ns:item', this.parseItem, { root, feed });
		}

		return feed;
	}
}

export { RDFParser };