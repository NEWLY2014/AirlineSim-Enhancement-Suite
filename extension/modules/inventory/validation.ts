class Validation {
    valid = true
    errors: string[] = []
    
    constructor() {
        this.checkAllFlightNumbersSelected()
        this.checkApplyToSettings()
        this.checkServiceClasses()
        this.checkFlightStatus()
        this.checkLoad()
        this.checkGroupByFlight()
    }
    
    /**
     * Check if “All Flight Numbers” tab is active
     */
    checkAllFlightNumbersSelected() {
        let message = AESI18n.t("Please select \"All Flight Numbers\" under Current Inventory")
        let active = $('.col-md-10 > div > .as-panel:eq(1) > ul:eq(0) li:eq(0)').hasClass("active")
        if (!active) {
            this.valid = false
            this.errors.push(message)
        }
    }
    
    /**
     * Check “Apply settings to” are set correctly
     */
    checkApplyToSettings() {        
        let checkboxes = $<HTMLInputElement>('.col-md-10 > div > .as-panel:eq(1) > div > div > div:eq(0) fieldset:eq(2) > div input')
        let valid: boolean | undefined
        let messages: string[] = []
        if (checkboxes.length < 4) {
            this.valid = false
            this.errors.push(AESI18n.t("Unable to validate “Apply settings to”. The inventory page layout might have changed."))
            return
        }
        checkboxes.each(function(index) {
            switch (index) {
                case 0:
                    if (!this.checked) {
                        let message = AESI18n.t("Please check “Airport Pair” under “Apply settings to” in the “Settings”-panel")
                        valid = false
                        messages.push(message)
                    }
                    break
                case 1:
                    if (!this.checked) {
                        let message = AESI18n.t("Please check “Flight Numbers” under “Apply settings to” in the “Settings”-panel")
                        valid = false
                        messages.push(message)
                    }
                    break
                case 2:
                    if (this.checked) {
                        let message = AESI18n.t("Please uncheck “Return Airport Pair” under “Apply settings to” in the “Settings”-panel")
                        valid = false
                        messages.push(message)
                    }
                    break
                case 3:
                    if (this.checked) {
                        let message = AESI18n.t("Please uncheck “Return Flight Numbers” under “Apply settings to” in the “Settings”-panel")
                        valid = false
                        messages.push(message)
                    }
                    break
            }
        })
        
        if (valid === false) {
            this.valid = valid
            this.errors.push(...messages)
        }
    }
    
    /**
     * Check that all “Service Classes” are selected
     */
    checkServiceClasses() {
        let valid: boolean | undefined
        let messages: string[] = []
        let container = $('.col-md-10 > div > .as-panel:eq(1) > div > div > div:eq(1) .layout-col-md-3')
        let labels = $('fieldset:eq(0) label', container)
        
        labels.each(function() {
            const input = $<HTMLInputElement>('input', this)[0]
            if (input && !input.checked) {
                valid = false
                messages.push(AESI18n.t("Please check “{0}” under “Service Classes” in the “Data”-panel", {0:$(this).text()}))
            }
        })
        
        if (valid === false) {
            this.valid = valid
            this.errors.push(...messages)
        }
    }
    
    /**
     * Check that the correct “Flight Status” is selected
     */
    checkFlightStatus() {
        let valid: boolean | undefined
        let messages: string[] = []
        let container = $('.col-md-10 > div > .as-panel:eq(1) > div > div > div:eq(1) .layout-col-md-3')
        let labels = $('fieldset:eq(1) label', container)
        labels.each(function(index) {
            if (index === 1 || index === 2) {
                const input = $<HTMLInputElement>('input', this)[0]
                if (input && !input.checked) {
                    let message = AESI18n.t("Please check “{0}” under “Flight Status” in the “Data”-panel", {0: $(this).text()})
                    valid = false
                    messages.push(message)
                }
            }
        })
        
        if (valid === false) {
            this.valid = valid
            this.errors.push(...messages)
        }
    }
    
    /**
     * Check “Load” settings
     */
    checkLoad() {
        let valid: boolean | undefined
        let messages: string[] = []
        let container = $('.col-md-10 > div > .as-panel:eq(1) > div > div > div:eq(1) .layout-col-md-3')
        
        $('fieldset:eq(2) div', container).each(function(index) {
            let valueAsInteger = parseInt($('select option:selected', this).text(), 10)

            // Minimum
            if (index === 0) {
                if (valueAsInteger != 0) {
                    let message = AESI18n.t("Please select 0 for “{0}” under “Load” in the “Data”-panel", {0: $('label', this).text()})
                    valid = false
                    messages.push(message)
                }
            }
            // Max
            if (index === 1) {
                if (valueAsInteger != 100) {
                    let message = AESI18n.t("Please select 100 for “{0}” under “Load” in the “Data”-panel", {0: $('label', this).text()})
                    valid = false
                    messages.push(message)
                }
            }
        });
        
        if (valid === false) {
            this.valid = valid
            this.errors.push(...messages)
        }
    }
    
    /**
     * Check “Group by flight” settings
     */
    checkGroupByFlight() {
        return
    }
}
