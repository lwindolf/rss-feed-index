// vim: set ts=4 sw=4:

export class Item {
        // maximum id currently used
        static maxId = 0;

        // state
        id = 0;
        nodeId = 0;
        read = false;
        starred = false;

        // item content
        title;
        description;
        time;
        source;
        sourceId;
        media = [];     // list of media content attached
        metadata = {};

        constructor(defaults) {
                Object.keys(defaults).forEach((k) => { this[k] = defaults[k] });

                if(Number.isInteger(this.id) && this.id > Item.maxId)
                    Item.maxId = this.id;

                if(0 === this.id) {
                    Item.maxId++;
                    this.id = Item.maxId;
                }
        }

        /**
         * Add a media enclosure to the item
         * 
         * @param {*} url       valid URL
         * @param {*} mime      MIME type or 'audio' or 'video'
         * @param {*} length    (optional) duration in [s]
         */
        addMedia(url, mime, length = NaN) {
            let l = NaN;
            
            try {
                l = parseInt(length, 10);
            // eslint-disable-next-line no-empty
            } catch { }

            if(!url || !mime)
                return;

            /* gravatars are often supplied as media:content with medium='image'
               so we do not treat such occurences as enclosures */
            if (-1 !== url.indexOf('www.gravatar.com'))
                return;

            /* Never add enclosures for images already contained in the description */
            if (this.description && -1 !== this.description.indexOf(url))
                return;

            this.media.push({ url, mime, length: l });
        }
}