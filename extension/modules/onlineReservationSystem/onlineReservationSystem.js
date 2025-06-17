class OnlineReservationSystem {

    constructor() {

    }

    init() {
        this.#addNumberToRating()
    }

    #addNumberToRating(){
        const cells = document.querySelectorAll('td.rating, td.aircraft');
        cells.forEach(td => {
            const img = td.querySelector('img');
            if (img) {
                const title = img.getAttribute('title');
                const number = title && title.match(/\d+/)?.[0];
                if (number) {
                    img.insertAdjacentElement('afterend', this.#generateSpanElement(number));
                }
            }
        });
    }

    #generateSpanElement(text) {
        const span = document.createElement('span');
        span.textContent = text;
        span.className = 'aes-text-left';
        return span;
    }
}

new OnlineReservationSystem().init();
