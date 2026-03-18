export class RssFeedIndexSearch extends HTMLElement{
        // state
        #flatIndex;
        #data;
        #meta;

        // shadow DOM
        #basePath;
        #searchInput;
        #results;

        constructor() {
                super();

                this.attachShadow({ mode: 'open' });
                this.shadowRoot.innerHTML = `
                        <form>
                                <input type="text" id="search" placeholder="Search for a domain / feed name..." disabled />
                                <div>
                                        <input type="checkbox" id="longtext" /> <label for="longtext" title="Search only feeds with long text content">Long Text</label>
                                        <input type="checkbox" id="audio" /> <label for="audio" title="Search only feeds with embedded audio">Podcast</label>
                                        <input type="checkbox" id="video" /> <label for="video" title="Search only feeds with embedded videos">Video</label>
                                        <input type="checkbox" id="indieweb" /> <label for="indieweb" title="Search only Indieweb feeds">Indieweb</label>
                                        <input type="checkbox" id="fediverse" /> <label for="fediverse" title="Search only Fediverse authors">Fediverse</label>
                                        <input type="checkbox" id="blogroll" /> <label for="blogroll" title="Search only feeds with a blogroll">Blogroll</label>
                                </div>
                        </form>

                        <div id="search-results">Loading ...</div>
                `;

                this.#basePath = this.getAttribute('base') || '/';
                const stylePath = this.getAttribute('style');
                if (stylePath) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = stylePath;
                        this.shadowRoot.appendChild(link);
                }

                this.#results = this.shadowRoot.getElementById('search-results');
                this.#searchInput = this.shadowRoot.getElementById('search');
                this.shadowRoot.addEventListener('input', this.#performSearch.bind(this));
                
                this.#loadIndex();
        }

        async #loadIndex() {
                const response = await fetch(this.#basePath + 'meta.json');
                this.#meta = await response.json();

                const response2 = await fetch(this.#basePath + 'url-title.json');
                console.log(response2.headers.get('Content-Length'));
                const reader = response2.body.getReader();

                let receivedLength = 0; // received that many bytes at the moment
                let chunks = []; // array of received binary chunks (comprises the body)
                while(true) {
                        const {done, value} = await reader.read();
                        if (done)
                                break;

                        chunks.push(value);
                        receivedLength += value.length;
                        this.#results.innerHTML = `Loading ... ${ (receivedLength / 1024 / 1024).toFixed(2) } MB`;
                }
                
                // concatenate chunks into single Uint8Array
                let chunksAll = new Uint8Array(receivedLength);
                let position = 0;
                for(let chunk of chunks) {
                        chunksAll.set(chunk, position);
                        position += chunk.length;
                }
                
                // decode into a string
                this.#data = JSON.parse(new TextDecoder("utf-8").decode(chunksAll));
                this.#searchInput.disabled = false;
                this.#searchInput.focus();
                this.#loadRandom();
        }

        #addLink(parent, domain, value) {
                // Index does not contain default prefix "https://" and identical domains to save space
                if (value.u[0] === '/')
                        value.u = domain + value.u;
                if (!value.u.includes('://'))
                        value.u = 'https://' + value.u;

                parent.className = 'feed-entry';

                const d = document.createElement('a');
                d.className = 'domain';
                d.href = domain.includes('://')?domain:'https://' + domain;
                d.target = '_blank';
                d.textContent = domain;
                parent.appendChild(d);

                const iconLink = document.createElement('a');
                iconLink.className = 'icon';
                iconLink.href = 'feed:' + value.u;
                iconLink.target = '_blank';
                parent.appendChild(iconLink);

                const icon = document.createElement('img');
                icon.className = 'icon';
                icon.src = 'feed.svg';
                icon.onerror = () => { icon.style.display = 'none'; };
                iconLink.appendChild(icon);

                const link = document.createElement('a');
                link.className = 'feed';
                link.href = value.u;
                link.target = '_blank';
                link.textContent = value.n ? value.n : '[no title]';
                parent.appendChild(link);

                const addLabel = (parent, text) => {
                        if(!parent || !text)
                                return;

                        const label = document.createElement('span');
                        label.className = 'label';
                        label.innerHTML = text;
                        //console.log(`Adding label ${text}`);
                        parent.appendChild(label);
                };

                if(value.t) addLabel(parent, 'long text');
                if(value.m & 1) addLabel(parent, '&#127911;'); // 🎧
                if(value.m & 2) addLabel(parent, '&#127916;'); // 🎬
                for(let i = 0; i < Object.keys(this.#meta.minorBitMask).length; i++) {
                        if(value.M & (1 << i)) addLabel(parent, this.#meta.minorBitMask[1 << i]);
                }
        }

        #loadRandom() {
                let list = Object.keys(this.#data);
                const offset = Math.floor(Math.random() * (list.length - 100));
                list = list.slice(offset, offset + 100);

                this.#results.innerHTML = '<h2>100 Random Feeds</h2>';
                list.forEach(domain => {
                        this.#data[domain].forEach(v => {
                                const div = document.createElement('div');
                                this.#addLink(div, domain, v);
                                this.#results.appendChild(div);
                        });                        
                });
        }

        #performSearch(event) {               
                const form = event.target.closest('form');
                const query = form.querySelector('#search').value.toLowerCase();
                const longtext = form.querySelector('#longtext').checked;
                const audio = form.querySelector('#audio').checked;
                const video = form.querySelector('#video').checked;
                const indieweb = form.querySelector('#indieweb').checked;
                const fediverse = form.querySelector('#fediverse').checked;
                const blogroll = form.querySelector('#blogroll').checked;

                console.log(`Searching for ${query}`, audio);

                if(!this.#flatIndex) {
                        // flatten the data structure to a list of {domain, url, name}
                        this.#flatIndex = Object.keys(this.#data).map(domain => {
                                return Object.entries(this.#data[domain]).map(([i, v]) => {
                                        return { domain, v };
                                });
                        }).flat();
                }
                const list = this.#flatIndex.filter(e =>
                        (e.v.u.toLowerCase().includes(query) ||
                         e.v.n.toLowerCase().includes(query) ||
                         e.domain.toLowerCase().includes(query))
                        && (!longtext || e.v.t)
                        && (!audio || e.v.m & 1)
                        && (!video || e.v.m & 2)
                        && (!indieweb || e.v.M & 2)
                        && (!fediverse || e.v.M & 1)
                        && (!blogroll || e.v.M & 64)

                );

                this.#results.innerHTML = `<h2>Search Results (${list.length})</h2>`;

                list.slice(0, 100).forEach(k => {
                        const div = document.createElement('div');
                        this.#addLink(div, k.domain, k.v);
                        this.#results.appendChild(div);
                });

                if(query.length > 2) {
                        // Highlight search term in results
                        const results = this.#results.querySelectorAll('.feed-entry a.domain, .feed-entry a.feed');
                        results.forEach(link => {
                                const regex = new RegExp(`(${query})`, 'gi');
                                const newContent = link.textContent.replace(regex, '<span class="highlight">$1</span>');
                                link.innerHTML = newContent;
                        });
                }

                if(list.length === 0)
                        this.#results.innerHTML += '<p>No results found. Try a different search term.</p>';
                if(list.length == 100)
                        this.#results.innerHTML += '<p>Showing first 100 results only. Please refine your search.</p>';

        }
};

customElements.define('x-rss-feed-index-search', RssFeedIndexSearch);
