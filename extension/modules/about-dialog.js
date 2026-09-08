class AboutDialog {
    #target
    #container
    #modalDialog
    #modalContent
    #closeButton
    #body
    #onShow

    constructor() {
        this.#closeButton = this.#createCloseButton()
        this.#body = this.#createBody()
        this.#body.prepend(this.#closeButton)
        this.#modalContent = this.#createModalContent()
        this.#modalContent.append(this.#body)
        this.#modalDialog = this.#createModalDialog()
        this.#modalDialog.append(this.#modalContent)
        this.#container = this.#createContainer()
        this.#container.append(this.#modalDialog)
        this.#target = this.#setTarget()
        this.#target.append(this.#container)
        AES.markOwnedElements(this.#container)

        this.#onShow = () => {
            if (!this.#container.open) this.#container.showModal();
        };
        document.addEventListener('aes:show-about', this.#onShow);
        this.#closeButton.addEventListener('click', () => this.#container.close());
        this.#container.addEventListener('click', event => {
            if (event.target === this.#container) this.#container.close();
        });
    }

    #createContainer() {
        const container = document.createElement("dialog")
        container.className = "bootstrap aes-about-modal"
        container.id = "aes-about-dialog"
        container.setAttribute("role", "dialog")
        container.setAttribute("aria-modal", "true")
        container.setAttribute("aria-label", "About AirlineSim Enhancement Suite")

        return container
    }

    #createModalDialog() {
        const modalDialog = document.createElement("div")
        modalDialog.className = "modal-dialog modal-md"

        return modalDialog
    }

    #createModalContent() {
        const modalContent = document.createElement("div")
        modalContent.className = "modal-content"

        return modalContent
    }

    #createCloseButton() {
        const icon = document.createElement("span")
        icon.setAttribute("aria-hidden", "true")
        icon.innerText = "×"
        const label = document.createElement("span")
        label.innerText = "Close"
        label.className = "sr-only"
        const button = document.createElement("button")
        button.setAttribute("type", "button")
        button.dataset.dismiss = "modal"
        button.className = "btn btn-default"
        button.append(icon, label)

        return button
    }

    #createBody() {
        const body = document.createElement("div")
        body.className = "modal-body"
        const manifest = chrome.runtime.getManifest()
        const description = manifest.description
        const versionName = manifest.version_name
        let version = manifest.version
        if (versionName) {
            version = versionName
        }

        body.innerHTML = `
            <img src="${chrome.runtime.getURL('images/AES-logo-128.png')}">
            <h2>AirlineSim Enhancement Suite</h2>
            <p>Version ${version}</p>
            <p>Copyright &copy; 2020-2026 AES Authors. MIT License.</p>
        `

        return body
    }

    #setTarget() {
        const target = document.querySelector("body")
        return target
    }

    destroy() {
        document.removeEventListener("aes:show-about", this.#onShow);
        if (this.#container) {
            this.#container.remove()
        }
    }
}

AES.runContentScript("module:about-dialog", function() {
    const aboutDialog = new AboutDialog()
    AES.whenPageOwnershipLost(function() {
        if (aboutDialog && typeof aboutDialog.destroy === "function") {
            aboutDialog.destroy()
        }
    })
}, { ready: false });
