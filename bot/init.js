// vim: set ts=4 sw=4:

import { JSDOM } from 'jsdom';

// window as global for ESM browser modules
globalThis.window = globalThis;

// feed-parser requires DOMParser in window
const jsdom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
globalThis.window = jsdom.window;
globalThis.document = jsdom.window.document;
globalThis.DOMParser = jsdom.window.DOMParser;


