#!/usr/bin/env node

import * as fs from 'fs';
import { execSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const awesomerss = execSync('./opml-awesomerss.js', { encoding: 'utf-8' });
const rssblogrollnetwork = execSync('./opml-rss-blogroll-network.js', { encoding: 'utf-8' });
const atlasdeflux = execSync('./opml-atlas-des-flux.js', { encoding: 'utf-8' });
const curated = fs.readFileSync('./opml-curated.json', 'utf-8');
const index = fs.readFileSync('../index.json', 'utf-8');


let blogrolls = {
    ...JSON.parse(curated).blogrolls,
    ...JSON.parse(awesomerss).blogrolls,
    ...JSON.parse(rssblogrollnetwork).blogrolls,
    ...JSON.parse(atlasdeflux).blogrolls,
    ...JSON.parse(index).blogrolls
};

console.log(JSON.stringify({ blogrolls }));