export class RssFeedIndexSearch extends HTMLElement{
        // state
        #flatIndex;

        // shadow DOM
        #basePath;
        #searchInput;
        #results;

        constructor() {
                super();

                this.attachShadow({ mode: 'open' });
                this.shadowRoot.innerHTML = `
                        <input type="text" id="search" placeholder="Search for a domain / feed name...">
                        <div id="search-results">Embed failed</div>
                `;

                this.#basePath = this.getAttribute('base') || '/';
                const stylePath = this.getAttribute('style');
                if (stylePath) {
                        const link = document.createElement('link');
                        link.rel = 'stylesheet';
                        link.href = stylePath;
                        this.shadowRoot.appendChild(link);
                }

                this.#loadRandom();
                this.#results = this.shadowRoot.getElementById('search-results');
                this.#searchInput = this.shadowRoot.getElementById('search');
                this.#searchInput.addEventListener('input', this.#performSearch.bind(this));
                this.#searchInput.focus();
        }

        #addLink(parent, domain, url, name) {
                // Index does not contain default prefix "https://" and identical domains to safe space
                if (url[0] === '/')
                        url = domain + url;
                if (!url.includes('://'))
                        url = 'https://' + url;

                parent.className = 'feed-entry';

                const d = document.createElement('a');
                d.className = 'domain';
                d.href = 'https://' + domain;
                d.target = '_blank';
                d.textContent = domain;
                parent.appendChild(d);

                const link = document.createElement('a');
                link.className = 'feed';
                link.href = url;
                link.target = '_blank';
                link.textContent = name? name : '[no title]';
                parent.appendChild(link);
        }

        #loadRandom() {
                fetch(this.#basePath + 'url-title.json')
                .then(response => response.json())
                .then(data => {
                        let list = Object.keys(data);
                        const offset = Math.floor(Math.random() * (list.length - 100));
                        list = list.slice(offset, offset + 100);

                        this.#results.innerHTML = '<h2>100 Random Feeds</h2>';
                        list.forEach(domain => {
                                Object.entries(data[domain]).forEach(([url, name]) => {
                                        const div = document.createElement('div');
                                        this.#addLink(div, domain, url, name);
                                        this.#results.appendChild(div);
                                });                        
                        });
                });
        }

        #performSearch(event) {
                const query = event.target.value.toLowerCase();
                console.log(`Searching for ${query}`);
                fetch(this.#basePath + 'url-title.json')
                .then(response => response.json())
                .then(data => {
                        if(!this.#flatIndex) {
                                // flatten the data structure to a list of {domain, url, name}
                                this.#flatIndex = Object.keys(data).map(domain => {
                                        return Object.entries(data[domain]).map(([url, name]) => {
                                                return { domain, url, name };
                                        });
                                }).flat();
                        }
                        const list = this.#flatIndex.filter(e =>
                                e.url.toLowerCase().includes(query) || 
                                e.name.toLowerCase().includes(query) ||
                                e.domain.toLowerCase().includes(query)
                        );

                        this.#results.innerHTML = `<h2>Search Results (${list.length})</h2>`;

                        list.slice(0, 100).forEach(k => {
                                const div = document.createElement('div');
                                this.#addLink(div, k.domain, k.url, k.name);
                                this.#results.appendChild(div);
                        });

                        if(query.length > 2) {
                                // Highlight search term in results
                                const results = this.#results.querySelectorAll('.feed-entry a');
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
                });
        }
};

customElements.define('x-rss-feed-index-search', RssFeedIndexSearch);
