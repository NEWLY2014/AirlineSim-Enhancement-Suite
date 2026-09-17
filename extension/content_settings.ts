"use strict";
(() => {
//MAIN
var settings: Record<string, unknown>;
let settingsArea: JQuery;
let cleanupSettings=()=>{};
const SETTINGS_SCRIPT_ENABLED = AES.runContentScript("content_settings", function() {
    chrome.storage.local.get(['settings'], function(result) {
        AES.waitForElement(() => $(AES.getPageContainer() || []), function() {
            if (!AES.isPageOwner()) return;
            settings = AES.isRecord(result.settings) ? result.settings : {};
            displaySettings();
        }, {
            scriptName: "content_settings",
            errorMessage: "Settings insertion target page content container was not found"
        });
    });
});
if (SETTINGS_SCRIPT_ENABLED) AES.whenPageOwnershipLost(()=>cleanupSettings());

function bindTabKeys(list: JQuery) {
    list.on('keydown.aesSettings', '[role="tab"]', function(event) {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key || '')) return;
        const tabs=list.find('[role="tab"]').toArray();
        const index=tabs.indexOf(this);
        const next=event.key==='Home' ? 0 : event.key==='End' ? tabs.length-1 : (index+(event.key==='ArrowRight' ? 1 : -1)+tabs.length)%tabs.length;
        event.preventDefault();tabs.forEach(tab=>tab.setAttribute('tabindex','-1'));tabs[next]?.setAttribute('tabindex','0');tabs[next]?.focus();
    });
}

function displaySettings() {
    cleanupSettings();
    const main=$(AES.getPageContainer() || []);
    const nativeTabs=main.find('.nav-tabs').filter((_,el)=>!!el.parentElement?.querySelector(':scope > .tab-content')).first();
    const nativeContent=nativeTabs.parent().children('.tab-content').first();
    const nativeItems=nativeTabs.children('li').toArray();
    const selected=nativeItems.find(item=>item.classList.contains('active'));
    const restore: Array<()=>void>=[];
    const remember=(element:Element,attributes:string[])=>{
        const values=attributes.map(name=>[name,element.getAttribute(name)] as const);
        restore.push(()=>values.forEach(([name,value])=>value===null ? element.removeAttribute(name) : element.setAttribute(name,value)));
    };
    const root=$('<section id="aes-settings-root" class="aes-settings-panel" role="tabpanel" aria-labelledby="aes-settings-tab" hidden></section>');
    const top=$(AESI18n.html('<li id="aes-settings-tab-item"><a id="aes-settings-tab" href="#aes-settings-root" role="tab" aria-controls="aes-settings-root" aria-selected="false" tabindex="-1">AES Settings</a></li>'));
    const tabs=nativeTabs.length ? nativeTabs : $('<ul class="nav nav-tabs"></ul>').appendTo(main[0]);
    remember(tabs[0],['role','aria-label']);tabs.attr({'role':'tablist','aria-label':AESI18n.t('Settings')});
    for(const item of nativeItems){
        remember(item,['class']);
        const link=item.querySelector('a');if(!link)continue;
        remember(link,['role','aria-selected','tabindex','id','aria-controls']);
        link.setAttribute('role','tab');link.setAttribute('aria-selected',String(item===selected));link.setAttribute('tabindex',item===selected ? '0' : '-1');
    }
    if(nativeContent.length) {
        remember(nativeContent[0],['hidden','class','id','role','aria-labelledby']);
        nativeContent.addClass('aes-settings-native-panel');
        const nativeLink=selected?.querySelector('a');
        if(nativeLink){
            nativeLink.id ||= 'aes-native-settings-tab';
            nativeContent.attr({id:nativeContent.attr('id') || 'aes-native-settings-panel',role:'tabpanel','aria-labelledby':nativeLink.id});
            nativeLink.setAttribute('aria-controls',nativeContent.attr('id')!);
        }
    }
    root.attr('lang', AESI18n.locale());
    tabs.append(top);tabs.after(root);
    const activate=(showAES:boolean)=>{
        root.prop('hidden',!showAES);
        if(nativeContent.length) nativeContent.prop('hidden',showAES);
        nativeItems.forEach(item=>{
            const active=!showAES && item===selected;item.classList.toggle('active',active);
            $(item).children('a').attr({'aria-selected':String(active),tabindex:active ? '0' : '-1'});
        });
        top.toggleClass('active',showAES).find('a').attr({'aria-selected':String(showAES),tabindex:showAES ? '0' : '-1'});
    };
    top.find('a').on('click',event=>{event.preventDefault();activate(true);});
    // The loaded native tab can be restored locally without discarding its form draft.
    // Other native links retain their original server navigation and modifier-click behavior.
    if(selected) $(selected).children('a').on('click.aesSettings',event=>{
        if(!root.prop('hidden') && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey){event.preventDefault();activate(false);}
    });
    tabs.on('keydown.aesSettings','[role="tab"]',function(event){if(event.key===' '){event.preventDefault();this.click();}});
    bindTabKeys(tabs);
    const toolbar=$('<div class="aes-settings-toolbar"></div>');
    const groups=$(AESI18n.html('<div class="aes-settings-groups" role="tablist" aria-label="AES settings sections"></div>'));
    const backup=$(AESI18n.html('<button type="button" class="btn btn-default">Backup &amp; Restore</button>'));
    const feedback=$('<span role="status" class="aes-settings-feedback"></span>');
    backup.on('click',()=>chrome.runtime.sendMessage({type:'AES_OPEN_OPTIONS'},response=>{
        if(chrome.runtime.lastError || !response?.ok) feedback.text(AESI18n.t('Unable to open Backup & Restore. Open AES extension options from Chrome.'));
    }));
    toolbar.append(groups,backup);root.append(toolbar,feedback);
    const panels: JQuery[]=[],buttons: JQuery[]=[];
    const names=['General Settings','Inventory Pricing','Flight Info'];
    names.forEach((name,index)=>{
        const button=$('<button type="button" role="tab" class="btn btn-default"></button>').attr({id:'aes-settings-group-'+index,'aria-controls':'aes-settings-section-'+index}).text(AESI18n.t(name));
        const panel=$('<div role="tabpanel"></div>').attr({id:'aes-settings-section-'+index,'aria-labelledby':'aes-settings-group-'+index});
        groups.append(button);root.append(panel);panels.push(panel);buttons.push(button);
        settingsArea=panel;
        if(name==='General Settings') {
            panel.append($('<h3></h3>').text(AESI18n.t('General Settings')), $('<div class="as-panel"></div>').append(AESI18n.selector()));
        } else if(name==='Inventory Pricing') displayInvPricingSettings();else displayFlightInfoSettings();
        button.on('click',()=>{
            showGroup(index);
            AES.updateSettings(current=>{current.settingsSection=name;},updated=>{settings=updated;});
        });
    });
    function showGroup(index:number){
        panels.forEach((panel,i)=>panel.prop('hidden',i!==index));
        buttons.forEach((button,i)=>button.attr({'aria-selected':String(i===index),tabindex:i===index ? '0' : '-1'}).toggleClass('active',i===index));
    }
    bindTabKeys(groups);
    showGroup(Math.max(0,names.indexOf(String(settings.settingsSection || ''))));
    activate(!nativeTabs.length);
    AES.markOwnedElements([root[0],top[0]]);
    cleanupSettings=()=>{
        tabs.off('.aesSettings');$(nativeItems).find('a').off('.aesSettings');
        root.remove();top.remove();restore.forEach(action=>action());
        if(!nativeTabs.length) tabs.remove();
    };
}
//FLight Info
function displayFlightInfoSettings() {
    let input = $<HTMLInputElement>('<input type="checkbox">');
    if (getSettingsSection(settings, "flightInfo").autoClose) {
        input.prop('checked', true);
    }
    $(input).click(function() {
        let autoClose = this.checked ? 1 : 0;
        AES.updateSettings(function(currentSettings) {
            getSettingsSection(currentSettings, "flightInfo").autoClose = autoClose;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    let span = $('<span></span>').text(AESI18n.t('Automatically close flight information page after extracting financial information.'));
    let label = $('<label></label>').append(input, span);
    let checkboxDiv = $('<div class="checkbox"></div>').append(label);
    let panelDiv = $('<div class="as-panel"></div>').append(checkboxDiv);
    let h3 = $(AESI18n.html('<h3>Flight Information</h3>'));
    let mainDiv = settingsArea;
    mainDiv.empty();
    mainDiv.append(h3, panelDiv);
}
//Pricing
function displayInvPricingSettings() {
    let mainDiv = settingsArea;
    mainDiv.empty();
    mainDiv.append(
        AESI18n.html(`
    <h3>Inventory Pricing</h3>
    <div class="as-panel">
      <div class="checkbox">
        <label>
          <input id="aes-input-inventory-automateSnapshotSave" type="checkbox">
          Automatically save analysis data when opening inventory page.
        </label>
        <br>
        <label>
          <input id="aes-input-automateInvPricing" type="checkbox">
          Automatically update price if there is any recommendation.
        </label>
        <br>
        <label>
          <input id="aes-input-inventory-automateCloseTab" type="checkbox">
          Automatically close inventory page if price or analysis is saved today (use when mass updating pricing/saving analysis)
        </label>
        <br>
        <label>
          <input id="aes-input-inventory-showReferenceRecommendation" type="checkbox">
          Show reference recommendation when current price has no flight results yet.
        </label>
      </div>
      <div class="form-group">
        <label class="control-label" for="aes-select-invPricing-cmp">
          <span>Compartment Recommendation Settings</span>
        </label>
        <select class="form-control" id="aes-select-invPricing-cmp">
          <option value="Y" selected="selected">Economy</option>
          <option value="C">Business</option>
          <option value="F">First</option>
          <option value="Cargo">Freight</option>
        </select>
      </div>
    </div>
    <div id="aes-div-recSettings">
    </div>

    `)
    );

    invPricingAutoPricingHandle();
    invPricingRecStepHandle();
    $("#aes-select-invPricing-cmp").change(function() {
        invPricingRecStepHandle();
    });
}
//Pricing sub functions
function invPricingAutoPricingHandle() {
    //Set autoprice toggle
    if (getSettingsSection(settings, "invPricing").autoAnalysisSave) {
        $("#aes-input-inventory-automateSnapshotSave").prop("checked", true);
    }
    if (getSettingsSection(settings, "invPricing").autoPriceUpdate) {
        $("#aes-input-automateInvPricing").prop("checked", true);
    }
    if (getSettingsSection(settings, "invPricing").autoClose) {
        $("#aes-input-inventory-automateCloseTab").prop("checked", true);
    }
    if (getSettingsSection(settings, "invPricing").showReferenceRecommendation) {
        $("#aes-input-inventory-showReferenceRecommendation").prop("checked", true);
    }
    //Add click event to auto price
    $<HTMLInputElement>("#aes-input-inventory-automateSnapshotSave").click(function() {
        let autoAnalysisSave = this.checked ? 1 : 0;
        AES.updateSettings(function(currentSettings) {
            getSettingsSection(currentSettings, "invPricing").autoAnalysisSave = autoAnalysisSave;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    $<HTMLInputElement>("#aes-input-automateInvPricing").click(function() {
        let autoPriceUpdate = this.checked ? 1 : 0;
        AES.updateSettings(function(currentSettings) {
            getSettingsSection(currentSettings, "invPricing").autoPriceUpdate = autoPriceUpdate;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    $<HTMLInputElement>("#aes-input-inventory-automateCloseTab").click(function() {
        let autoClose = this.checked ? 1 : 0;
        AES.updateSettings(function(currentSettings) {
            getSettingsSection(currentSettings, "invPricing").autoClose = autoClose;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });
    $<HTMLInputElement>("#aes-input-inventory-showReferenceRecommendation").click(function() {
        let showReferenceRecommendation = this.checked ? 1 : 0;
        AES.updateSettings(function(currentSettings) {
            getSettingsSection(currentSettings, "invPricing").showReferenceRecommendation = showReferenceRecommendation;
        }, function(updatedSettings) {
            settings = updatedSettings;
        });
    });


}

function invPricingRecStepHandle() {
    const selectedCabin = $("#aes-select-invPricing-cmp").val();
    if (selectedCabin !== "Y" && selectedCabin !== "C" && selectedCabin !== "F" && selectedCabin !== "Cargo") return;
    const cmp = selectedCabin;
    $('#aes-div-recSettings').empty().append(
        $('<h3></h3>').text(AESI18n.t("{0} Compartment Pricing Settings", {"0": cmp}))
    );
    let divRow = $('<div class="row as-panel"></div>')
    let divLeft = $('<div class="col-md-8"></div>')
    let divRight = $('<div class="col-md-4"></div>')
    let tableDiv = $('<div class="as-table-well"></div>')
    let table = $('<table id="aes-table-invPricing" class="table table-bordered table-striped table-hover"></table>');
    //Table head
    let thead = $('<thead></thead>');
    let headRow = $('<tr></tr>');
    headRow.append(AESI18n.html('<th>Name</th><th>From (Load %)</th><th>To (Load %)</th><th>Price Change %</th><th></th>'));
    thead.append(headRow);
    //table body
    let tbody = $('<tbody></tbody>');
    getSettingsRecommendation(cmp).steps.forEach(function(value) {
        let row = $('<tr></tr>');
        row.append($('<td></td>').append($('<input type="text" class="form-control">').val(value.name)));
        for (const number of [value.min, value.max, value.step]) {
            row.append($('<td></td>').append($('<div class="input-group"></div>').append(
                $('<input type="text" class="form-control number" style="min-width: 50px;">').val(number),
                $('<span class="input-group-addon">%</span>')
            )));
        }
        row.append(AESI18n.html('<td><a class="aes-a-invPricing-delete-row" ><span class="fa fa-trash" title="Delete row"></span></a></td>'));
        tbody.append(row);
    });
    //Table foot
    let tfoot = $('<tfoot></tfoot>');
    let footRow = $('<tr></tr>');
    footRow.append(AESI18n.html('<td colspan="8"><span>  </span><button id="aes-button-invPricing-add-row" class="btn btn-default">Add Row</button></td>'));
    tfoot.append(footRow);

    table.append(thead, tbody, tfoot);
    tableDiv.append(table);
    divLeft.append(tableDiv);
    divRow.append(divLeft, divRight);

    $('#aes-div-recSettings').append(divRow);

    $("#aes-table-invPricing").on("click", ".aes-a-invPricing-delete-row", function() {
        $(this).closest("tr").remove();
    });

    $("#aes-button-invPricing-add-row").click(function() {
        let row = $('<tr></tr>');
        row.append('<td><input type="text" class="form-control"></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append(AESI18n.html('<td><a class="aes-a-invPricing-delete-row" ><span class="fa fa-trash" title="Delete row"></span></a></td>'));
        $('#aes-table-invPricing tbody').append(row);
    });

    //Rights side
    divRight.append(AESI18n.html(`
    <fieldset id="aes-fieldset-invPricing">
      <legend>Min Max Price</legend>
      <div class="form-group">
        <label class="control-label">
            <span for="aes-input-invPricing-max-price">Maximum Price (% compared to default price)</span>
        </label>
        <div class="input-group">
        <input type="text" class="form-control number" id="aes-input-invPricing-max-price" value=` + getSettingsRecommendation(cmp).maxPrice + `>
        <span class="input-group-addon">%</span>
        </div>
      </div>
      <div class="form-group">
        <label class="control-label">
            <span for="aes-input-invPricing-min-price">Minimum Price (% compared to default price)</span>
        </label>
        <div class="input-group">
        <input type="text" class="form-control number" id="aes-input-invPricing-min-price" value=` + getSettingsRecommendation(cmp).minPrice + `>
        <span class="input-group-addon">%</span>
        </div>
      </div>
      <div class="form-group">
        <button id="aes-btn-invPricing-save" class="btn btn-default">Save</button>
      </div>
    </fieldset>

  `));
    //Click save button
    $("#aes-btn-invPricing-save").click(function() {
        //Feedback
        $("#aes-span-invPricing").remove();
        let span = $(AESI18n.html('<span id="aes-span-invPricing" class="warning">Updating...</span>'));
        $("#aes-fieldset-invPricing").append(span);

        let newSteps: AESModel.PricingStep[] = [];
        let newCmpSettings = {
            maxPrice: parseInt(String($("#aes-input-invPricing-max-price").val() ?? ""), 10),
            minPrice: parseInt(String($("#aes-input-invPricing-min-price").val() ?? ""), 10),
            steps: newSteps
        }
        $("#aes-table-invPricing tbody tr").each(function() {
            newSteps.push({
                max: parseInt(String($(this).find("input:eq(2)").val() ?? ""), 10),
                min: parseInt(String($(this).find("input:eq(1)").val() ?? ""), 10),
                name: String($(this).find("input:eq(0)").val() ?? ""),
                step: parseInt(String($(this).find("input:eq(3)").val() ?? ""), 10),
            });
        });

        //Sort Steps:
        newSteps.sort(function(a, b) {
            return a.min - b.min;
        });

        //Validate Steps
        if (validInvPriSteps(newCmpSettings)) {
            getSettingsSection(getSettingsSection(settings, "invPricing"), "recommendation")[cmp] = newCmpSettings;
            AES.updateSettings(function(currentSettings) {
                getSettingsSection(getSettingsSection(currentSettings, "invPricing"), "recommendation")[cmp] = newCmpSettings;
            }, function(updatedSettings) {
                settings = updatedSettings;
                $("#aes-span-invPricing").removeClass().addClass("good").text(AESI18n.t("Inventory pricing settings for {0} saved!", {"0": cmp}))
            });
        }
    });
}

function validInvPriSteps(newCmpSettings: AESModel.PricingRecommendation) {
    let steps = newCmpSettings.steps;
    //Check min max price
    if (!Number.isInteger(newCmpSettings.minPrice)) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t('Save Failed! Min Price is not an integer!'));
        return 0;
    } else {
        if (!(newCmpSettings.minPrice >= 0 && newCmpSettings.minPrice <= 200)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t('Save Failed! Min Price must be between 0% and 200%!'));
            return 0;
        }
    }
    if (!Number.isInteger(newCmpSettings.maxPrice)) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t('Save Failed! Max Price is not an integer!'));
        return 0;
    } else {
        if (!(newCmpSettings.maxPrice >= 0 && newCmpSettings.maxPrice <= 200)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t('Save Failed! Max Price must be between 0% and 200%!'));
            return 0;
        }
    }
    if (newCmpSettings.minPrice >= newCmpSettings.maxPrice) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t('Save Failed! Min Price must be lower than Max Price!'));
        return 0;
    }

    //Check steps
    for (let i = 0; i < steps.length; i++) {
        //Check if integer
        if (!Number.isInteger(steps[i].min)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" From value is not an integer!", {"0": steps[i].name}));
            return 0;
        }
        if (!Number.isInteger(steps[i].max)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" To value is not an integer!", {"0": steps[i].name}));
            return 0;
        }
        if (!Number.isInteger(steps[i].step)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" Price Change value is not an integer!", {"0": steps[i].name}));
            return 0;
        }
        //Check if min and max correct
        if (steps[i].min >= steps[i].max) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" From value can not be equal or larger than To!", {"0": steps[i].name}));
            return 0;
        }

        //Check if min same as previous max
        if (i) {
            //not first rows
            if (steps[i].min != steps[i - 1].max) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" From value must be equal to To value of row with name \"{1}\" !", {"0": steps[i].name, "1": steps[i - 1].name}));
                return 0;
            }
        } else {
            if (steps[i].min != 0) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" From value must start at 0%!", {"0": steps[i].name}));
                return 0;
            }
        }
        if (i == (steps.length - 1)) {
            //Last row
            if (steps[i].max != 100) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text(AESI18n.t("Save Failed! For row with name \"{0}\" To value must end at 100%!", {"0": steps[i].name}));
                return 0;
            }
        }
    }
    return 1;
}


function getSettingsSection(target: Record<string, unknown>, key: string): Record<string, unknown> {
    const existing = target[key];
    if (AES.isRecord(existing)) return existing;
    const section: Record<string, unknown> = {};
    target[key] = section;
    return section;
}

function getSettingsRecommendation(cabin: AESModel.Cabin): AESModel.PricingRecommendation {
    const value = getSettingsSection(getSettingsSection(settings, "invPricing"), "recommendation")[cabin];
    if (isSettingsRecommendation(value)) return value;
    // Rendering a missing compartment must not overwrite any stored preference.
    return { minPrice: 60, maxPrice: 200, steps: [] };
}

function isSettingsRecommendation(value: unknown): value is AESModel.PricingRecommendation {
    return AES.isRecord(value) && typeof value.minPrice === "number" && typeof value.maxPrice === "number" &&
        Array.isArray(value.steps) && value.steps.every((step: unknown) => AES.isRecord(step) &&
            typeof step.name === "string" && typeof step.min === "number" && typeof step.max === "number" && typeof step.step === "number");
}

})();
