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
        const title = document.createElement("h3")
        title.className = "modal-title"
        title.textContent = notes.title
        const versionLabel = document.createElement("p")
        versionLabel.className = "aes-release-notes-version"
        versionLabel.textContent = "Version " + version
        header.append(this.#closeButton, title, versionLabel)

        const body = document.createElement("div")
        body.className = "modal-body aes-release-notes-body"

        const intro = document.createElement("p")
        intro.className = "aes-release-notes-summary"
        intro.textContent = notes.summary
        body.append(intro)

        notes.sections.forEach(function(section) {
            const sectionTitle = document.createElement("h4")
            sectionTitle.textContent = section.title
            body.append(sectionTitle)

            const list = document.createElement("ul")
            list.className = "aes-release-notes-list"
            section.items.forEach(function(item) {
                const listItem = document.createElement("li")
                listItem.textContent = item
                list.append(listItem)
            })
            body.append(list)
        })

        const footer = document.createElement("div")
        footer.className = "modal-footer aes-release-notes-footer"

        const changelogLink = document.createElement("a")
        changelogLink.className = "btn btn-link"
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
        button.className = "btn btn-default"
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
