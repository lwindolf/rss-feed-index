export class RssFeedIndexSearch extends HTMLElement{
        // state
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
                        <style>
                                :host {
                                --highlight-fg: black;
                                --highlight-bg: #ffff00;
                                }

                                .highlight {
                                        color: var(--highlight-fg);
                                        background-color: var(--highlight-bg);
                                }

                                .feed-entry a.feed {
                                        display:inline-block;
                                        text-decoration: none;
                                }

                                .feed-entry a.domain {
                                        font-weight: bold;
                                        width: 25%;
                                        display: inline-block;
                                        overflow: hidden;
                                        text-overflow: ellipsis;
                                        white-space: nowrap;
                                }

                                .feed-entry img.icon {
                                        width: 1.2rem;
                                        height: 1.2rem;
                                        vertical-align: middle;
                                        margin-right: 0.3rem;
                                }

                                .feed-entry .label {
                                        display: block;
                                        float: right;
                                        font-size: 0.8em;
                                        padding: 0.2rem;
                                        margin-left: 0.5em;
                                        border-radius: 0.2rem;
                                }

                                input#search {
                                        width: 100%;
                                        padding: 0.5em;
                                        margin: 0.5em 0;
                                        border-radius: 4px;
                                        font-size: 1em;
                                        box-sizing: border-box;
                                }
                        </style>
                        <form>
                                <input type="text" id="search" placeholder="Search for a domain / feed name..." disabled />
                                <div>
                                        <input type="checkbox" id="longtext" /> <label for="longtext" title="Search only feeds with long text content">Long Text</label>
                                        <input type="checkbox" id="audio" /> <label for="audio" title="Search only feeds with embedded audio">Podcast</label>
                                        <input type="checkbox" id="video" /> <label for="video" title="Search only feeds with embedded videos">Video</label>
                                        <input type="checkbox" id="indieweb" /> <label for="indieweb" title="Search only Indieweb feeds">Indieweb</label>
                                        <input type="checkbox" id="fediverse" /> <label for="fediverse" title="Search only Fediverse authors">Fediverse</label>
                                        <input type="checkbox" id="wordpress" /> <label for="wordpress" title="Search only WordPress blogs">WordPress</label>
                                        <input type="checkbox" id="blogroll" /> <label for="blogroll" title="Search only feeds with a blogroll">Blogroll</label>
                                </div>
                        </form>

                        <div id="search-results">Loading ...</div>
                `;

                this.shadowRoot.adoptedStyleSheets = [...document.styleSheets].filter(sheet => sheet.cssRules).map(sheet => {
                        const newSheet = new CSSStyleSheet();
                        newSheet.replaceSync([...sheet.cssRules].map(rule => rule.cssText).join('\n'));
                        return newSheet;
                });
                this.#basePath = this.getAttribute('base');
                this.#results = this.shadowRoot.getElementById('search-results');
                this.#searchInput = this.shadowRoot.getElementById('search');
                this.shadowRoot.addEventListener('input', this.#performSearch.bind(this));
                
                this.#loadIndex();
        }

        async #loadIndex() {
                const response = await fetch(this.#basePath + 'meta.json');
                this.#meta = await response.json();

                const response2 = await fetch(this.#basePath + 'url-feeds.json');
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

        #addLink(parent, domain, feed) {
                // Index does not contain default prefix "https://" and identical domains to save space
                if (feed.u[0] === '/')
                        feed.u = domain + feed.u;
                if (!feed.u.includes('://'))
                        feed.u = 'https://' + feed.u;

                parent.className = 'feed-entry';

                const d = document.createElement('a');
                d.className = 'domain';
                d.href = domain.includes('://')?domain:'https://' + domain;
                d.target = '_blank';
                d.textContent = domain;
                parent.appendChild(d);

                const iconLink = document.createElement('a');
                iconLink.className = 'icon';
                iconLink.href = 'feed:' + feed.u;
                iconLink.target = '_blank';
                parent.appendChild(iconLink);

                const icon = document.createElement('img');
                icon.className = 'icon';
                icon.src = 'feed.svg';
                icon.onerror = () => { icon.style.display = 'none'; };
                iconLink.appendChild(icon);

                const link = document.createElement('a');
                link.className = 'feed';
                link.href = feed.u;
                link.target = '_blank';
                link.textContent = feed.n ? feed.n : '[no title]';
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

                if(feed.t) addLabel(parent, 'long text');
                if(feed.m & 1) addLabel(parent, '&#127911;'); // 🎧
                if(feed.m & 2) addLabel(parent, '&#127916;'); // 🎬
                for(let i = 0; i < Object.keys(this.#meta.minorBitMask).length; i++) {
                        if(this.#data[domain].M & (1 << i)) addLabel(parent, this.#meta.minorBitMask[1 << i]);
                }
        }

        #loadRandom() {
                let list = Object.keys(this.#data);
                const offset = Math.floor(Math.random() * (list.length - 100));
                list = list.slice(offset, offset + 100);

                this.#results.innerHTML = '<h2>100 Random Feeds</h2>';
                list.forEach(domain => {
                        this.#data[domain].f.forEach(v => {
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
                const wordpress = form.querySelector('#wordpress').checked;
                const blogroll = form.querySelector('#blogroll').checked;

                console.log(`Searching for ${query}`, audio);

                const list = Object.entries(this.#data).filter(([domain, value]) => {
                        // FIXME: get bits from meta.json
                        if ((indieweb  && !(value.M & 2)) ||
                            (fediverse && !(value.M & 1)) ||
                            (wordpress && !(value.M & 16)) ||
                            (blogroll  && !(value.M & 64)))
                            return false;

                        return value.f.some(feed => {
                                return (domain.toLowerCase().includes(query) ||
                                        feed.u.toLowerCase().includes(query) ||
                                        feed.n && feed.n.toLowerCase().includes(query))
                                        && (!longtext || feed.t)
                                        && (!audio || feed.m & 1)
                                        && (!video || feed.m & 2);
                        });
                });

                this.#results.innerHTML = `<h2>Search Results (${list.length})</h2>`;

                list.slice(0, 100).forEach(([domain, value]) => {
                        value.f.forEach(feed => {
                                const div = document.createElement('div');
                                this.#addLink(div, domain, feed);
                                this.#results.appendChild(div);
                        });
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
