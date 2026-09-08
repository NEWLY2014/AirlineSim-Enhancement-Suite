class AESMenu {
    #container
    #legacy
    #button
    #menu
    #onOutsideClick
    #onKeydown

    constructor(target: Element) {

        this.#legacy = target.tagName === "LI"
        this.#container = this.#createContainer(this.#legacy)
        this.#button = this.#createButton()
        this.#menu = this.#createMenu()
        this.#container.append(this.#button, this.#menu)

        target.after(this.#container);
        if (this.#legacy) {
            this.#container.addEventListener('mouseenter', () => this.#setOpen(true));
            this.#container.addEventListener('mouseleave', () => this.#setOpen(false));
        }
        this.#button.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            this.#setOpen(Boolean(this.#menu.hidden));
        });
        this.#onOutsideClick = (event: MouseEvent) => {
            if (event.target instanceof Node && !this.#container.contains(event.target)) this.#setOpen(false);
        };
        this.#onKeydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !this.#menu.hidden) {
                this.#setOpen(false);
                this.#button.focus();
            }
        };
        this.#menu.addEventListener('click', () => this.#setOpen(false));
        document.addEventListener('click', this.#onOutsideClick);
        document.addEventListener('keydown', this.#onKeydown);
        AES.markOwnedElements(this.#container)
    }

    /**
     * Creates the menu container
     * @returns {HTMLElement} container
     */
    #createContainer(legacy: boolean) {
        const container = document.createElement(legacy ? "li" : "div")
        container.id = "aes-menu"
        container.className = legacy ? "dropdown aes-navigation-legacy" : "aes-navigation"
        return container
    }

    /**
     * Creates the menu toggle button
     * @returns {HTMLElement} button
     */
    #createButton() {
        const button: HTMLElement = document.createElement(this.#legacy ? "a" : "button")
        if (this.#legacy) {
            button.setAttribute("href", "#")
            button.setAttribute("role", "button")
            button.addEventListener("keydown", event => {
                if (event.key === " ") {
                    event.preventDefault()
                    button.click()
                }
            })
        } else {
            button.setAttribute("type", "button")
        }
        button.setAttribute("tabindex", "0")
        button.setAttribute("aria-expanded", "false")
        button.setAttribute("aria-controls", "aes-menu-items")
        button.className = "dropdown-toggle"
        button.innerHTML = this.#legacy ? 'AES <span class="caret"></span>' : `
            <svg class="aes-menu-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            <span>AES</span>
            <svg class="aes-menu-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"/></svg>
        `

        return button
    }

    /**
     * Creates the menu
     * @returns {HTMLElement} menu
     */
    #createMenu() {
        const menu = document.createElement("ul")
        menu.className = this.#legacy ? "aes-menu-items dropdown-menu" : "aes-menu-items"
        menu.id = "aes-menu-items"
        menu.hidden = true
        const menuItems = []
        const content = [{
            label: "Community",
            isHeader: true
        },{
            label: "Forum Topic",
            href: "https://forums.airlinesim.aero/t/introducing-airlinesim-enhancement-suite-beta/",
            newWindow: true
        },{
            label: "Discord",
            href: "https://discord.com/channels/113555701774749696/1249639537450160138",
            newWindow: true
        },{
            isDivider: true
        },{
            label: "Support",
            isHeader: true
        },{
            label: "Report a Bug",
            href: `https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/issues/new?body=AES:%20v${chrome.runtime.getManifest().version_name}%0AChrome:%20v${window.navigator.userAgent.match(/Chrom(?:e|ium)\/([0-9]+)/)?.[1] || 'unknown'}%0A%0A`,
            newWindow: true,
            icon: { className: "fa-bug" }
        },{
            label: "Handbook",
            href: "https://docs.google.com/document/d/1hzMHb3hTBXSZNtuDKoBuvx1HP9CgB7wVYR59yDYympg/",
            newWindow: true,
            icon: { className: "fa-book" }
        },{
            label: "GitHub",
            href: "https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite",
            newWindow: true,
            icon: { className: "fa-github" }
        },{
            isDivider: true
        },{
            label: "About AES",
            icon: { className: "fa-info" },
            data: {
                toggle: "modal",
                target: "#aes-about-dialog"
            }
        }]
        for (const item of content) {
            let menuItem = this.#createMenuItem(item)
            menuItems.push(menuItem)
        }
        for (const item of menuItems) {
            menu.append(item)
        }

        return menu
    }

    /**
     * Creates a menu item
     * @param {object} content - object containing information required to build the item
     * @returns {HTMLElement} menuItem
     */
    #createMenuItem(content: AESModel.MenuItem) {
        const menuItem = document.createElement("li")
        let menuItemContent: string | HTMLElement = ""
        let icon: HTMLSpanElement | undefined
        if (content.label) {
            menuItemContent = content.label
        }
        if (content.isDivider) {
            menuItem.className = "divider"
            return menuItem
        }
        if (content.isHeader) {
            menuItem.className = "dropdown-header"
        }
        if (content.icon || content.newWindow) {
            icon = document.createElement("span")
            icon.setAttribute("aria-hidden", "true")
        }
        if (content.icon && icon) {
            icon.className = `fa ${content.icon.className}`
        }
        if (content.data?.toggle) {
            const button: HTMLElement = document.createElement(this.#legacy ? "a" : "button")
            if (this.#legacy) {
                button.setAttribute("href", "#")
                button.setAttribute("role", "button")
            } else {
                button.setAttribute("type", "button")
            }
            button.setAttribute("tabindex", "0")
            button.style.cursor = "pointer"
            if (icon) {
                button.append(icon)
            }
            button.append(content.label || "")
            button.addEventListener('click', event => {
                event.preventDefault();
                document.dispatchEvent(new CustomEvent('aes:show-about'));
            });
            menuItemContent = button
        }
        if (content.href) {
            const link = document.createElement("a")
            link.setAttribute("href", content.href)
            if (content.newWindow && !content.icon && icon) {
                icon.className = "fa fa-external-link"
            }
            if (content.newWindow) {
                link.setAttribute("target", "_blank")
                link.setAttribute("rel", "noreferrer noopener")
            }
            if (icon) {
                link.append(icon)
            }
            link.append(content.label || "")
            menuItemContent = link
        }
        menuItem.append(menuItemContent)
        return menuItem
    }

    #setOpen(open: boolean) {
        this.#menu.hidden = !open;
        this.#container.classList.toggle("open", open);
        this.#button.setAttribute('aria-expanded', String(open));
    }

    destroy() {
        document.removeEventListener('click', this.#onOutsideClick);
        document.removeEventListener('keydown', this.#onKeydown);
        if (this.#container) {
            this.#container.remove()
        }
    }
}

AES.runContentScript("module:aes-menu", function() {
    let aesMenu: AESMenu | null = null
    let refreshTimer = 0
    const observer = new MutationObserver(function() {
        window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(ensureAESMenu, 100)
    })

    function getInsertionTarget() {
        return document.querySelector("#as-navbar-main-collapse .navbar-nav > li:nth-child(5)") ||
            document.querySelector("#as-navbar-main-collapse .navbar-nav > li:last-child") ||
            document.querySelector(".as-navbar-main .navbar-nav > li:nth-child(5)") ||
            document.querySelector(".as-navbar-main .navbar-nav > li:last-child") ||
            document.querySelector('#header [role="menubar"]')
    }

    function ensureAESMenu() {
        if (document.getElementById("aes-menu")) {
            return true
        }

        const target = getInsertionTarget()
        if (!target) {
            return false
        }

        if (aesMenu && typeof aesMenu.destroy === "function") {
            aesMenu.destroy()
        }
        aesMenu = new AESMenu(target)
        return true
    }

    ensureAESMenu()
    observer.observe(document.documentElement, { childList: true, subtree: true })

    AES.whenPageOwnershipLost(function() {
        observer.disconnect()
        window.clearTimeout(refreshTimer)
        if (aesMenu && typeof aesMenu.destroy === "function") {
            aesMenu.destroy()
        }
    })
}, { ready: false });
