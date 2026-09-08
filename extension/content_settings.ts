"use strict";
(() => {
//MAIN
var settings: Record<string, unknown>;
const SETTINGS_SCRIPT_ENABLED = AES.runContentScript("content_settings", function() {
    chrome.storage.local.get(['settings'], function(result) {
        AES.waitForElement(function() {
            return $(AES.getPageContainer() || []);
        }, function() {
            settings = AES.isRecord(result.settings) ? result.settings : {};
            displaySettings();
            AES.markOwnedElements($("#aes-settings-root"));
            settingDisplayHandle('Inventory Pricing')
        }, {
            scriptName: "content_settings",
            errorMessage: "Settings insertion target page content container was not found"
        });
    });
});

if (SETTINGS_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        $('#aes-settings-root').remove();
    });
}

//FUNCTIONS MAIN
//Display settings
function settingDisplayHandle(value: string) {
    switch (value) {
        case 'Inventory Pricing':
            displayInvPricingSettings();
            break;
        case 'Flight Info':
            displayFlightInfoSettings();
            break;
        default:
            displayInvPricingSettings();
    }
}

function displaySettings() {
    let settingChoice = ['Inventory Pricing', 'Flight Info'];
    let rows: JQuery[] = [];
    settingChoice.forEach(function(value, index) {
        let span = $('<span></span>').text(value);
        let a = $('<a href="#"></a>').append(span);
        let span1 = $('<span></span>');
        if (!index) {
            span1.addClass("fa fa-play")
        }
        let td = $('<td></td>').append(span1, a);
        a.click(function() {
            settingDisplayHandle(value);
            $('span', $(this).closest('tbody')).removeClass("fa fa-play");
            $('span:eq(0)', $(this).closest('td')).addClass("fa fa-play");
        });
        rows.push($('<tr></tr>').append(td));
    })
    let tbody = $('<tbody></tbody>').append(rows);
    let table = $('<table class="table"></table>').append(tbody);
    let divWell = $('<div class="as-table-well"></div>').append(table);
    let divPanel = $('<div class="as-panel"></div>').append(divWell);
    let h3 = $('<h3>Settings</h3>');
    let divmd2 = $('<div class="col-md-2"></div>').append(h3, divPanel);
    let divmd10 = $('<div id="aes-div-settingArea" class="col-md-10"></div>');
    let rowDiv = $('<div class="row"></div>').append(divmd2, divmd10);
    let h = $('<h2>AirlineSim Enhancement Suite Settings</h2>');
    let mainDiv = $(AES.getPageContainer() || []);
    if (!mainDiv.length) {
        throw new Error("Settings insertion target page content container was not found");
    }
    $("#aes-settings-root").remove();
    mainDiv.prepend($('<section id="aes-settings-root"></section>').append(h, rowDiv));
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
    let span = $('<span></span>').text('Automatically close flight information page after extracting financial information.');
    let label = $('<label></label>').append(input, span);
    let checkboxDiv = $('<div class="checkbox"></div>').append(label);
    let panelDiv = $('<div class="as-panel"></div>').append(checkboxDiv);
    let h3 = $('<h3>Flight Information</h3>');
    let mainDiv = $("#aes-div-settingArea");
    mainDiv.empty();
    mainDiv.append(h3, panelDiv);
}
//Pricing
function displayInvPricingSettings() {
    let mainDiv = $("#aes-div-settingArea");
    mainDiv.empty();
    mainDiv.append(
        `
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
        <label class="control-label">
          <span for="aes-select-invPricing-cmp">Compartment Recommendation Settings</span>
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

    `
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
        $('<h3></h3>').text(cmp + ' Compartment Pricing Settings')
    );
    let divRow = $('<div class="row as-panel"></div>')
    let divLeft = $('<div class="col-md-8"></div>')
    let divRight = $('<div class="col-md-4"></div>')
    let tableDiv = $('<div class="as-table-well"></div>')
    let table = $('<table id="aes-table-invPricing" class="table table-bordered table-striped table-hover"></table>');
    //Table head
    let thead = $('<thead></thead>');
    let headRow = $('<tr></tr>');
    headRow.append('<th>Name</th><th>From (Load %)</th><th>To (Load %)</th><th>Price Change %</th><th></th>');
    thead.append(headRow);
    //table body
    let tbody = $('<tbody></tbody>');
    getSettingsRecommendation(cmp).steps.forEach(function(value) {
        let row = $('<tr></tr>');
        row.append('<td><input type="text" class="form-control" value="' + value.name + '"></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" value="' + value.min + '" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" value="' + value.max + '" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append('<td><div class="input-group"><input type="text" class="form-control number" value="' + value.step + '" style="min-width: 50px;"><span class="input-group-addon">%</span></div></td>');
        row.append('<td><a class="aes-a-invPricing-delete-row" ><span class="fa fa-trash" title="Delete row"></span></a></td>');
        tbody.append(row);
    });
    //Table foot
    let tfoot = $('<tfoot></tfoot>');
    let footRow = $('<tr></tr>');
    footRow.append('<td colspan="8"><span>  </span><button id="aes-button-invPricing-add-row" class="btn btn-default">Add Row</button></td>');
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
        row.append('<td><a class="aes-a-invPricing-delete-row" ><span class="fa fa-trash" title="Delete row"></span></a></td>');
        $('#aes-table-invPricing tbody').append(row);
    });

    //Rights side
    divRight.append(`
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

  `);
    //Click save button
    $("#aes-btn-invPricing-save").click(function() {
        //Feedback
        $("#aes-span-invPricing").remove();
        let span = $('<span id="aes-span-invPricing" class="warning">Updating...</span>');
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
                $("#aes-span-invPricing").removeClass().addClass("good").text('Inventory pricing settings for ' + cmp + ' saved!')
            });
        }
    });
}

function validInvPriSteps(newCmpSettings: AESModel.PricingRecommendation) {
    let steps = newCmpSettings.steps;
    //Check min max price
    if (!Number.isInteger(newCmpSettings.minPrice)) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! Min Price is not an integer!');
        return 0;
    } else {
        if (!(newCmpSettings.minPrice >= 0 && newCmpSettings.minPrice <= 200)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! Min Price must be between 0% and 200%!');
            return 0;
        }
    }
    if (!Number.isInteger(newCmpSettings.maxPrice)) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! Max Price is not an integer!');
        return 0;
    } else {
        if (!(newCmpSettings.maxPrice >= 0 && newCmpSettings.maxPrice <= 200)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! Max Price must be between 0% and 200%!');
            return 0;
        }
    }
    if (newCmpSettings.minPrice >= newCmpSettings.maxPrice) {
        $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! Min Price must be lower than Max Price!');
        return 0;
    }

    //Check steps
    for (let i = 0; i < steps.length; i++) {
        //Check if integer
        if (!Number.isInteger(steps[i].min)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" From value is not an integer!');
            return 0;
        }
        if (!Number.isInteger(steps[i].max)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" To value is not an integer!');
            return 0;
        }
        if (!Number.isInteger(steps[i].step)) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" Price Change value is not an integer!');
            return 0;
        }
        //Check if min and max correct
        if (steps[i].min >= steps[i].max) {
            $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" From value can not be equal or larger than To!');
            return 0;
        }

        //Check if min same as previous max
        if (i) {
            //not first rows
            if (steps[i].min != steps[i - 1].max) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" From value must be equal to To value of row with name "' + steps[i - 1].name + '" !');
                return 0;
            }
        } else {
            if (steps[i].min != 0) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" From value must start at 0%!');
                return 0;
            }
        }
        if (i == (steps.length - 1)) {
            //Last row
            if (steps[i].max != 100) {
                $("#aes-span-invPricing").removeClass().addClass("bad").text('Save Failed! For row with name "' + steps[i].name + '" To value must end at 100%!');
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
