const AES_RELEASE_NOTES_STORAGE_KEY = "aesReleaseNotesSeenVersion"
const AES_RELEASE_NOTES = {
    "0.7.7": {
        title: "Release Notes",
        summary: "Thanks for keeping AES up to date. Here are the main improvements in version 0.7.7.",
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
        versionLabel.textContent = "Version " + version
        const summary = document.createElement("p")
        summary.className = "aes-release-notes-summary"
        summary.textContent = notes.summary
        const badge = document.createElement("span")
        badge.className = "aes-release-notes-badge"
        badge.textContent = "What's new"

        titleWrap.append(badge, title, versionLabel, summary)
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
}

function maybeShowReleaseNotes() {
    if (window.top !== window.self) {
        return
    }

    if (document.getElementById("aes-release-notes-dialog")) {
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

        new ReleaseNotesDialog(version, notes)
    })
}

maybeShowReleaseNotes()
