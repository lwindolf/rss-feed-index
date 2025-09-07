// vim: set ts=4 sw=4:

// Date to epoch conversion
// Epoch to localized string

class DateParser {
    /**
     * Parse a given string (can be null)
     *
     * Will return undefined or the number of epoch seconds
     */
    static parse(str) {
            if(!str)
                    return undefined;

            // For now we rely solely on the browser RFC-822 + ISO8601 parsing support
            return new Date(str)?.getTime() / 1000;
    }


    // pretty print date from epoch
    static getShortDateStr(time) {
        /* Different formats based on the time difference
        
           Today 10:05
           Yesterday 10:05
           Wed 10:05
           Aug 05
           Mar 01, 2024
         */
        if (!time)
            return '';
        const date = new Date(time * 1000);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneYear = 356 * oneDay;
        if (diff < oneDay) {
            return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diff < 2 * oneDay) {
            return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } else if (diff < oneYear && date.getFullYear() === now.getFullYear()) {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        } else {
            return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
        }
    }

}

export { DateParser };