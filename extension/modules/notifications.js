class Notifications {
    name = "Notifications"
    container

    constructor() {
        const target = document.querySelector("nav.as-navbar-main + .container-fluid") || document.body
        const container = document.querySelector(".feedbackPanel")
        this.container = container
        if (!container) {
            this.container = this.#createContainer()
            target.prepend(this.container)
        }
    }

    /**
     * Creates the notification container
     * @returns {HTMLElement} container
     */
    #createContainer() {
        const container = document.createElement("ul")
        container.className = "feedbackPanel"

        return container
    }

    /**
     * Creates a new notification and adds it to the page.
     * @param {string} message - the message to be displayed
     * @param {object} options
     */
    newNotification(message, options) {
        const notification = new Notification(message, options)
        this.container.append(notification.element)
        const duration = typeof options?.duration === "number" ? options.duration : 5000
        if (duration > 0) {
            window.setTimeout(() => {
                this.#dismiss(notification.element, options)
            }, duration)
        }
    }

    /**
     * Fades a notification out before removing it from the page.
     * @param {HTMLElement} element
     * @param {object} options
     */
    #dismiss(element, options) {
        if (!element || !element.parentNode) {
            return
        }

        const fadeDuration = typeof options?.fadeDuration === "number" ? options.fadeDuration : 250
        if (fadeDuration <= 0) {
            element.remove()
            return
        }

        element.classList.add("aes-notification-exit")
        window.setTimeout(() => {
            element.remove()
        }, fadeDuration)
    }

    /**
     * Shorthand for `newNotification`
     * @param {string} message
     * @param {object} options
     */
    add(message, options) {
        this.newNotification(message, options)
    }
}
