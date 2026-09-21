class Notifications {
    name = "Notifications"
    container: Element
    static regions: Map<string,HTMLElement> = new Map()
    static announce(message:string,error:boolean) {
        const kind=error ? 'alert' : 'status'
        let region=this.regions.get(kind)
        if (!region?.isConnected) {
            region=document.createElement('div')
            region.className='aes-announcement'
            region.setAttribute('role',kind)
            region.setAttribute('aria-atomic','true')
            AES.markOwnedElements(region)
            document.body.append(region)
            this.regions.set(kind,region)
            AES.whenPageOwnershipLost(()=>region?.remove())
        }
        const target=region
        const revision=String(Number(target.dataset.revision || 0)+1)
        target.dataset.revision=revision
        target.textContent=''
        // Announce after the empty live region has been registered; collapse bursts.
        queueMicrotask(async()=>{
            if (!target.isConnected || !AES.isPageOwner()) return
            await AES.yieldToPage()
            if (target.isConnected && AES.isPageOwner() && target.dataset.revision===revision) target.textContent=AESI18n.t(message)
        })
    }

    constructor() {
        const target = AES.getPageContainer() || document.body
        const container = document.querySelector(".feedbackPanel")
        this.container = container || this.#createContainer()
        if (!container) {
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
    newNotification(message: string, options?: AESModel.NotificationOptions) {
        const notification = new AESNotification(message, options)
        this.container.append(notification.element)
        Notifications.announce(message,options?.type==='error')
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
    #dismiss(element: HTMLElement, options?: AESModel.NotificationOptions) {
        if (!element || !element.parentNode) {
            return
        }

        const fadeDuration = typeof options?.fadeDuration === "number" ? options.fadeDuration : 250
        if (fadeDuration <= 0) {
            element.remove()
            return
        }

        element.style.animationDuration = `${fadeDuration}ms`
        element.classList.add("aes-notification-exit")
        if (typeof element.getAnimations === 'function') {
            // Follow the actual animation, including cancellation or disabled motion.
            void Promise.allSettled(element.getAnimations().map(animation => animation.finished)).then(() => element.remove())
        } else {
            window.setTimeout(() => element.remove(), fadeDuration)
        }
    }

    /**
     * Shorthand for `newNotification`
     * @param {string} message
     * @param {object} options
     */
    add(message: string, options?: AESModel.NotificationOptions) {
        this.newNotification(message, options)
    }
}
