const AES_RELEASE_NOTES_STORAGE_KEY = "aesReleaseNotesSeenVersion"
const AES_RELEASE_NOTES = {
    "0.8.4": {
        title: "Release Notes",
        releaseDate: "2026-06-07",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Added in-page AES error notifications for content scripts that fail while inserting or updating AirlineSim pages, so affected modules now report visible errors instead of failing silently.",
                    "Added daily AES diagnostic logs and Options-page log file management for downloading or clearing per-day logs."
                ]
            },
            {
                title: "Changed",
                items: [
                    "Improved Dashboard table selection actions so hiding checked rows and reading selected rows avoid scanning every visible row on large tables."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Flight Plan Assistant so the selected offset day remains selected after automated scheduling completes.",
                    "Fixed server date detection to avoid the CSS :has() selector, improving compatibility with browsers that do not support it consistently.",
                    "Fixed server date detection when AirlineSim renders an empty footer first by falling back to frontendSettings.server.time.",
                    "Fixed Aircraft Flights initialization so malformed non-flight rows no longer prevent the AES Aircraft Flights panel from rendering."
                ]
            }
        ]
    },
    "0.8.3": {
        title: "Release Notes",
        releaseDate: "2026-05-21",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Fixed",
                items: [
                    "Fixed Route Management Dashboard loading for upgraded users whose saved Dashboard settings were missing column definitions, which could show Unable to load route management data even after schedule extraction.",
                    "Hardened Route Management settings migration, reload, column saving, filter saving, and route analysis rendering so incomplete stored data no longer breaks the main table."
                ]
            }
        ]
    },
    "0.8.2": {
        title: "Release Notes",
        releaseDate: "2026-05-20",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Inventory Pricing now treats recommendation boundaries as hard limits, so prices below the minimum or above the maximum are adjusted even when current-price flight results are not available yet."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Route Management Dashboard reload so it re-reads stored schedule data and fails with a visible message instead of leaving the table area blank when stored data is incomplete."
                ]
            }
        ]
    },
    "0.8.1": {
        title: "Release Notes",
        releaseDate: "2026-05-20",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Fixed",
                items: [
                    "Fixed Aircraft Profitability on the Dashboard so invalid or mismatched fleet storage no longer leaves the tab stuck on loading. Issue #32.",
                    "Hardened Dashboard initialization, Route Management, and Competitor Monitoring against incomplete stored data so tabs fail gracefully instead of staying in a loading state.",
                    "Hardened Flights and Fleet Management storage merging so malformed saved flight records no longer interrupt aircraft profit and HUB summaries.",
                    "Fixed Personnel Management salary adjustment for older settings data that did not include salary preferences, which could leave the control stuck on adjusting."
                ]
            }
        ]
    },
    "0.8.0": {
        title: "Release Notes",
        releaseDate: "2026-05-18",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Added the Flight Plan Assistant for individual aircraft Flight Plan pages, including template extraction, saved-template deletion, compact 1-6 offset-day controls, assisted 7-plane-7-day scheduling from existing flight numbers, and timing extraction for short or overnight visual plan blocks.",
                    "Added page ownership arbitration so newer AES versions can take priority when multiple AES builds are enabled on the same AirlineSim page."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Fixed Personnel Management salary adjustment so negative values and immediate apply actions use the current form value reliably.",
                    "Fixed Personnel Management salary updates so AES updates the visible salary inputs first, then submits through the native page controls without getting stuck at adjusting.",
                    "Fixed Personnel Management salary detection so it remains compatible with pages modified by ASX or similar tools that may affect column layout.",
                    "Fixed Inventory Pricing so AES does not inject validation messages into AirlineSim's own error pages when an Inventory request unexpectedly returns an error view.",
                    "Fixed the AES footer version link placement for AirlineSim's updated footer structure, including alignment next to the game version and preventing AES clicks from also opening AirlineSim release notes."
                ]
            }
        ]
    },
    "0.7.8": {
        title: "Release Notes",
        releaseDate: "2026-04-18",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Added",
                items: [
                    "Release notes now open automatically after an update and can be reopened from the footer version link.",
                    "Grouped inventory tables are now supported, and reference recommendations can be enabled explicitly for routes whose current price has no flight results yet."
                ]
            },
            {
                title: "Changed",
                items: [
                    "The release notes dialog now adapts to dark, classic, and light AirlineSim themes and shows the release date next to the AES version.",
                    "Inventory Pricing now separates executable recommendations from optional reference recommendations, and recommendation prices are shown inline."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Inventory Pricing settings now persist reliably across pages instead of being overwritten by stale settings snapshots.",
                    "Inventory analysis now reloads automatically after toggling Group by flight, and grouped-mode fallback analysis no longer shows invalid zero prices."
                ]
            }
        ]
    },
    "0.7.7": {
        title: "Release Notes",
        releaseDate: "2026-04-13",
        summary: "Thanks for keeping AES up to date.",
        sections: [
            {
                title: "Changed",
                items: [
                    "Dashboard loading, filtering, and schedule table behavior were refined so each tab restores more cleanly and large datasets feel steadier while data loads.",
                    "The Flights page HUB override controls now sit more naturally within the native aircraft Flights page."
                ]
            },
            {
                title: "Fixed",
                items: [
                    "Dashboard tab initialization, filter normalization, and competitor schedule rendering issues that could leave tabs blank or throw runtime errors were fixed.",
                    "Dashboard sorting, zero-value rendering, and Aircraft Profitability row actions were corrected so formatted numbers sort correctly and undelivered aircraft can still be managed safely.",
                    "Fleet Management filtering and native selection link integration were fixed so all / none / invert works with AES filters and native table refreshes no longer break AES-added columns."
                ]
            }
        ]
    }
}

class ReleaseNotesDialog {
    #container
    #backdrop
    #closeButton
    #confirmButton
    #version

    constructor(version, notes) {
        this.#version = version
        this.#closeButton = this.#createCloseButton()
        this.#confirmButton = this.#createConfirmButton()
        this.#container = this.#createContainer(version, notes)
        this.#backdrop = this.#createBackdrop()
        document.body.append(this.#backdrop, this.#container)
        AES.markOwnedElements([this.#container, this.#backdrop])
        document.body.classList.add("modal-open")
        this.#bindEvents()
    }

    #createContainer(version, notes) {
        const container = document.createElement("div")
        container.id = "aes-release-notes-dialog"
        container.className = "modal fade in"
        container.setAttribute("role", "dialog")
        container.setAttribute("aria-modal", "true")
        container.style.display = "block"
        container.classList.add("aes-release-notes-theme-" + this.#getTheme())

        const dialog = document.createElement("div")
        dialog.className = "modal-dialog modal-lg"

        const content = document.createElement("div")
        content.className = "modal-content"

        const header = document.createElement("div")
        header.className = "modal-header aes-release-notes-header"
        const hero = document.createElement("div")
        hero.className = "aes-release-notes-hero"
        const heroBrand = document.createElement("div")
        heroBrand.className = "aes-release-notes-brand"
        const logo = document.createElement("img")
        logo.className = "aes-release-notes-logo"
        logo.src = chrome.runtime.getURL("images/AES-logo-128.png")
        logo.alt = "AES logo"
        const titleWrap = document.createElement("div")
        titleWrap.className = "aes-release-notes-title-wrap"
        const title = document.createElement("h3")
        title.className = "modal-title"
        title.textContent = notes.title
        const versionLabel = document.createElement("p")
        versionLabel.className = "aes-release-notes-version"
        versionLabel.textContent = this.#formatVersionLabel(version, notes.releaseDate)
        const badge = document.createElement("span")
        badge.className = "aes-release-notes-badge"
        badge.textContent = "What's new"

        titleWrap.append(badge, title, versionLabel)
        if (notes.summary) {
            const summary = document.createElement("p")
            summary.className = "aes-release-notes-summary"
            summary.textContent = notes.summary
            titleWrap.append(summary)
        }
        heroBrand.append(logo, titleWrap)
        hero.append(this.#closeButton, heroBrand)
        header.append(hero)

        const body = document.createElement("div")
        body.className = "modal-body aes-release-notes-body"
        const sections = document.createElement("div")
        sections.className = "aes-release-notes-sections"

        notes.sections.forEach(function(section) {
            const card = document.createElement("section")
            card.className = "aes-release-notes-card"
            const sectionTitle = document.createElement("h4")
            sectionTitle.className = "aes-release-notes-card-title"
            sectionTitle.textContent = section.title

            const list = document.createElement("ul")
            list.className = "aes-release-notes-list"
            section.items.forEach(function(item) {
                const listItem = document.createElement("li")
                listItem.textContent = item
                list.append(listItem)
            })

            card.append(sectionTitle, list)
            sections.append(card)
        })
        body.append(sections)

        const footer = document.createElement("div")
        footer.className = "modal-footer aes-release-notes-footer"

        const changelogLink = document.createElement("a")
        changelogLink.className = "btn btn-default aes-release-notes-link"
        changelogLink.href = "https://github.com/NEWLY2014/AirlineSim-Enhancement-Suite/blob/main/CHANGELOG.md"
        changelogLink.target = "_blank"
        changelogLink.rel = "noopener noreferrer"
        changelogLink.textContent = "View full changelog"

        footer.append(changelogLink, this.#confirmButton)
        content.append(header, body, footer)
        dialog.append(content)
        container.append(dialog)

        return container
    }

    #createBackdrop() {
        const backdrop = document.createElement("div")
        backdrop.className = "modal-backdrop fade in aes-release-notes-backdrop"
        return backdrop
    }

    #createCloseButton() {
        const button = document.createElement("button")
        button.setAttribute("type", "button")
        button.className = "close aes-release-notes-close"
        button.setAttribute("aria-label", "Close")
        button.innerHTML = "&times;"
        return button
    }

    #createConfirmButton() {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "btn btn-primary aes-release-notes-confirm"
        button.textContent = "Got it"
        return button
    }

    #bindEvents() {
        const dismiss = this.dismiss.bind(this)
        this.#closeButton.addEventListener("click", dismiss)
        this.#confirmButton.addEventListener("click", dismiss)
        this.#backdrop.addEventListener("click", dismiss)
        document.addEventListener("keydown", this.#onKeydown)
    }

    #onKeydown = (event) => {
        if (event.key === "Escape") {
            this.dismiss()
        }
    }

    dismiss() {
        chrome.storage.local.set({ [AES_RELEASE_NOTES_STORAGE_KEY]: this.#version }, () => {
            document.removeEventListener("keydown", this.#onKeydown)
            this.#container.remove()
            this.#backdrop.remove()
            document.body.classList.remove("modal-open")
        })
    }

    #formatVersionLabel(version, releaseDate) {
        if (!releaseDate) {
            return "Version " + version
        }
        return "Version " + version + " - Released " + releaseDate
    }

    #getTheme() {
        const theme = window.frontendSettings && window.frontendSettings.theme
        if (theme === "classic" || theme === "light") {
            return theme
        }
        return "dark"
    }
}

function maybeShowReleaseNotes() {
    if (window.top !== window.self) {
        return
    }

    const manifest = chrome.runtime.getManifest()
    const version = manifest.version_name || manifest.version
    const notes = AES_RELEASE_NOTES[version]

    if (!notes) {
        return
    }

    chrome.storage.local.get([AES_RELEASE_NOTES_STORAGE_KEY], function(result) {
        if (result[AES_RELEASE_NOTES_STORAGE_KEY] === version) {
            return
        }

        showReleaseNotesDialog(version, notes)
    })
}

function showReleaseNotesDialog(version, notes) {
    if (!AES.isPageOwner()) {
        return
    }
    if (document.getElementById("aes-release-notes-dialog")) {
        return
    }

    new ReleaseNotesDialog(version, notes)
}

function addReleaseNotesFooterLink() {
    if (!AES.isPageOwner()) {
        return false
    }

    const manifest = chrome.runtime.getManifest()
    const version = manifest.version_name || manifest.version
    const notes = AES_RELEASE_NOTES[version]
    if (!notes) {
        return false
    }

    const footer = document.querySelector("#footer, nav.as-navbar-bottom")
    if (!footer) {
        return false
    }

    const gameVersionAnchor = findGameVersionAnchor(footer)
    if (!gameVersionAnchor) {
        return false
    }

    let wrapper = document.getElementById("aes-footer-version")
    if (!wrapper) {
        wrapper = createFooterVersionLink(version, notes, gameVersionAnchor.wrapperTag)
    }

    AES.markOwnedElements(wrapper)

    return placeFooterVersionLink(wrapper, gameVersionAnchor)
}

function createFooterVersionLink(version, notes, wrapperTag) {
    wrapperTag = wrapperTag || "span"
    const wrapper = document.createElement(wrapperTag)
    wrapper.id = "aes-footer-version"
    wrapper.className = "as-footer-line-element aes-footer-version-element"

    const link = document.createElement("a")
    link.href = "#"
    link.className = "aes-footer-version-link"
    link.textContent = "AES: v" + version
    link.addEventListener("click", function(event) {
        event.preventDefault()
        event.stopPropagation()
        if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation()
        }
        showReleaseNotesDialog(version, notes)
    })
    wrapper.addEventListener("click", function(event) {
        event.stopPropagation()
    })

    wrapper.append(link)
    return wrapper
}

function findGameVersionAnchor(footer) {
    const explicitVersion = footer.querySelector("#version")
    if (explicitVersion) {
        return createElementVersionAnchor(explicitVersion)
    }

    const currentVersion = window.frontendSettings && window.frontendSettings.currentVersionNumber
    const versionCandidates = Array.from(footer.querySelectorAll("[data-version], .version, .as-footer-line-element, span, div"))
        .filter(function(element) {
            return element.id !== "aes-footer-version" && !element.closest("#aes-footer-version")
        })

    const dataVersionCandidate = versionCandidates.find(function(element) {
        const dataVersion = element.getAttribute("data-version")
        return dataVersion && (!currentVersion || dataVersion === currentVersion)
    })
    if (dataVersionCandidate) {
        return createElementVersionAnchor(dataVersionCandidate)
    }

    const ownTextCandidate = versionCandidates.find(function(element) {
        return isGameVersionText(getOwnText(element), currentVersion)
    })
    if (ownTextCandidate) {
        return createElementVersionAnchor(ownTextCandidate)
    }

    const textNodeAnchor = findGameVersionTextNodeAnchor(footer, currentVersion)
    return textNodeAnchor || null
}

function createElementVersionAnchor(element) {
    return {
        parent: element.parentNode,
        beforeNode: element,
        wrapperTag: element.tagName === "DIV" ? "div" : "span"
    }
}

function findGameVersionTextNodeAnchor(footer, currentVersion) {
    const walker = document.createTreeWalker(footer, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT
            }
            if (node.parentElement && node.parentElement.closest("#aes-footer-version")) {
                return NodeFilter.FILTER_REJECT
            }
            return getGameVersionTokenIndex(node.nodeValue, currentVersion) >= 0
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT
        }
    })

    const textNode = walker.nextNode()
    if (!textNode) {
        return null
    }

    const tokenIndex = getGameVersionTokenIndex(textNode.nodeValue, currentVersion)
    const versionTextNode = tokenIndex > 0 ? textNode.splitText(tokenIndex) : textNode
    const versionContainer = findClosestGameVersionContainer(versionTextNode.parentElement, currentVersion)
    if (versionContainer) {
        return createElementVersionAnchor(versionContainer)
    }

    return {
        parent: versionTextNode.parentNode,
        beforeNode: versionTextNode,
        wrapperTag: "span"
    }
}

function getOwnText(element) {
    return Array.from(element.childNodes)
        .filter(function(node) {
            return node.nodeType === Node.TEXT_NODE
        })
        .map(function(node) {
            return node.nodeValue
        })
        .join(" ")
        .trim()
}

function findClosestGameVersionContainer(element, currentVersion) {
    while (element && !element.matches("#footer, nav.as-navbar-bottom")) {
        const dataVersion = element.getAttribute("data-version")
        if (dataVersion && (!currentVersion || dataVersion === currentVersion)) {
            return element
        }
        if (element.id === "version" || element.classList.contains("version")) {
            return element
        }
        if (isGameVersionText(getOwnText(element), currentVersion)) {
            return element
        }
        element = element.parentElement
    }
    return null
}

function isGameVersionText(text, currentVersion) {
    if (!text) {
        return false
    }

    const normalizedText = text.trim()
    if (currentVersion) {
        return normalizedText === currentVersion || normalizedText === "v" + currentVersion
    }

    return /^v?\d+\.\d+\.\d+$/.test(normalizedText)
}

function getGameVersionTokenIndex(text, currentVersion) {
    if (!text) {
        return -1
    }

    if (currentVersion) {
        const versionWithPrefix = "v" + currentVersion
        const prefixedIndex = text.indexOf(versionWithPrefix)
        if (prefixedIndex >= 0) {
            return prefixedIndex
        }
        return text.indexOf(currentVersion)
    }

    const match = text.match(/v?\d+\.\d+\.\d+/)
    return match ? match.index : -1
}

function placeFooterVersionLink(wrapper, gameVersionAnchor) {
    if (wrapper.parentNode !== gameVersionAnchor.parent || wrapper.nextSibling !== gameVersionAnchor.beforeNode) {
        gameVersionAnchor.parent.insertBefore(wrapper, gameVersionAnchor.beforeNode)
    }
    return true
}

function watchReleaseNotesFooterLink() {
    if (addReleaseNotesFooterLink()) {
        return
    }

    const observer = new MutationObserver(function() {
        if (addReleaseNotesFooterLink()) {
            observer.disconnect()
        }
    })
    observer.observe(document.body, { childList: true, subtree: true })
}

AES.runContentScript("module:release-notes", function() {
    watchReleaseNotesFooterLink()
    maybeShowReleaseNotes()
    AES.whenPageOwnershipLost(function() {
        AES.removeOwnedElements()
        document.body.classList.remove("modal-open")
    })
}, { ready: false });
