"use strict";
var aircraftFlightPlanState = {
    airline: null,
    aircraft: null,
    extracting: false,
    job: null,
    notifications: null,
    offsetDays: 0,
    processingJob: false,
    runtimeMessage: '',
    runtimeType: 'warning',
    server: '',
    template: null,
};

$(function() {
    aircraftFlightPlanInit();
});

async function aircraftFlightPlanInit() {
    if (!afp_getAssignPanel().length || !afp_getVisualPlan().length) {
        return;
    }

    aircraftFlightPlanState.server = AES.getServerName();
    let currentAirline = AES.getCurrentAirline();
    aircraftFlightPlanState.airline = currentAirline && currentAirline.id ? currentAirline : AES.getAirline();
    aircraftFlightPlanState.notifications = typeof Notifications === 'function' ? new Notifications() : null;
    aircraftFlightPlanState.aircraft = afp_getCurrentAircraft();

    let result = await afp_storageGet([afp_getTemplateKey(), afp_getJobKey()]);
    aircraftFlightPlanState.template = result[afp_getTemplateKey()] || null;
    aircraftFlightPlanState.job = result[afp_getJobKey()] || null;

    afp_renderPanel();
    window.setTimeout(function() {
        afp_resumePendingJob();
    }, 300);
}

function afp_getTemplateKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'flightPlanTemplate';
}

function afp_getJobKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'flightPlanSchedulingJob';
}

function afp_storageGet(keys) {
    return new Promise(function(resolve) {
        chrome.storage.local.get(keys, function(result) {
            resolve(result || {});
        });
    });
}

function afp_storageSet(values) {
    return new Promise(function(resolve) {
        chrome.storage.local.set(values, function() {
            resolve();
        });
    });
}

function afp_storageRemove(keys) {
    return new Promise(function(resolve) {
        chrome.storage.local.remove(keys, function() {
            resolve();
        });
    });
}

function afp_notify(message, type) {
    if (aircraftFlightPlanState.notifications) {
        aircraftFlightPlanState.notifications.add(message, { type: type || 'success' });
    }
}

function afp_setRuntimeMessage(message, type) {
    aircraftFlightPlanState.runtimeMessage = message || '';
    aircraftFlightPlanState.runtimeType = type || 'warning';
    $('#aes-aircraft-flight-plan-runtime')
        .removeClass('good warning bad')
        .addClass(type === 'error' ? 'bad' : (type === 'success' ? 'good' : 'warning'))
        .text(message || '');
}

function afp_clearRuntimeMessage() {
    afp_setRuntimeMessage('', 'warning');
}

function afp_getAssignPanel() {
    let heading = $('h3').filter(function() {
        return $(this).text().trim() === 'Assign a new flight';
    }).first();

    if (!heading.length) {
        return $();
    }

    return heading.nextAll('.as-panel').first();
}

function afp_getTransferHeading() {
    let heading = $('h3').filter(function() {
        return $(this).text().trim() === 'Transfer Flight Plan';
    }).first();

    return heading;
}

function afp_getVisualPlan() {
    return $('.visual-flight-plan').first();
}

function afp_getCurrentAircraft() {
    let match = window.location.pathname.match(/\/aircraft\/(\d+)\/0/);
    let aircraftId = match ? match[1] : '';
    let heading = $('h1').first().text().trim();
    let registration = '';
    let model = '';

    if (heading.indexOf(':') > -1) {
        heading = heading.split(':').slice(1).join(':').trim();
    }
    let parts = heading.split('/').map(function(value) {
        return value.trim();
    });
    if (parts.length >= 2) {
        registration = parts[0];
        model = parts.slice(1).join(' / ');
    }

    return {
        id: aircraftId,
        registration: registration,
        model: model,
    };
}

function afp_isEmptyFlightPlan() {
    return afp_getVisualPlan().find('.day .blocks .block').length === 0;
}

function afp_getTemplateSummary() {
    let template = aircraftFlightPlanState.template;
    if (!template || !Array.isArray(template.flights) || !template.flights.length) {
        return 'No saved template';
    }

    return template.sourceRegistration + ' / ' + template.sourceModel + ' / ' + template.flights.length + ' flights';
}

function afp_getJobSummary() {
    let job = aircraftFlightPlanState.job;
    if (!job) {
        return '';
    }

    let total = job.entries ? job.entries.length : 0;
    let current = Math.min(job.currentIndex + 1, total);
    if (job.status === 'done') {
        return 'Scheduling complete';
    }
    if (job.status === 'error') {
        return 'Scheduling stopped: ' + (job.errorMessage || 'Unknown error');
    }

    return 'Scheduling ' + current + ' / ' + total + ' on ' + (job.targetRegistration || 'target aircraft');
}

function afp_renderPanel() {
    $('#aes-aircraft-flight-plan-panel').remove();

    let template = aircraftFlightPlanState.template;
    let job = aircraftFlightPlanState.job;
    let isEmpty = afp_isEmptyFlightPlan();
    let hasTemplate = !!(template && Array.isArray(template.flights) && template.flights.length);
    let jobIsActive = !!(job && job.status !== 'done' && job.status !== 'error');
    let jobOnCurrentAircraft = !!(jobIsActive && String(job.targetAircraftId) === String(aircraftFlightPlanState.aircraft.id));
    let jobOnOtherAircraft = !!(jobIsActive && String(job.targetAircraftId) !== String(aircraftFlightPlanState.aircraft.id));
    let canStart = hasTemplate && isEmpty && !aircraftFlightPlanState.extracting && !jobOnOtherAircraft && !jobOnCurrentAircraft;

    let extractBtn = $('<button type="button" class="btn btn-default"></button>').text(aircraftFlightPlanState.extracting ? 'Extracting...' : 'Extract template').prop('disabled', aircraftFlightPlanState.extracting);
    let deleteBtn = $('<button type="button" class="btn btn-default"></button>').text('Delete saved template').prop('disabled', !hasTemplate || aircraftFlightPlanState.extracting);
    let startBtn = $('<button type="button" class="btn btn-default"></button>').text(jobOnCurrentAircraft ? 'Scheduling in progress' : 'Start scheduling').prop('disabled', !canStart);
    let clearJobBtn = $('<button type="button" class="btn btn-default"></button>').text('Stop scheduling').prop('disabled', !job);
    let offsetButtons = $('<div class="btn-group aes-aircraft-flight-plan-offset-group" role="group" aria-label="Offset days"></div>');
    let offsetButtonsDisabled = aircraftFlightPlanState.extracting || jobOnCurrentAircraft || jobOnOtherAircraft;

    for (let i = 0; i < 7; i++) {
        let offsetBtn = $('<button type="button" class="btn btn-default aes-aircraft-flight-plan-offset-btn"></button>')
            .text(String(i))
            .attr('data-offset-days', i)
            .toggleClass('active', aircraftFlightPlanState.offsetDays === i)
            .prop('disabled', offsetButtonsDisabled);
        offsetBtn.on('click', function() {
            aircraftFlightPlanState.offsetDays = i;
            afp_renderPanel();
        });
        offsetButtons.append(offsetBtn);
    }

    extractBtn.on('click', function() {
        afp_extractTemplate();
    });
    deleteBtn.on('click', function() {
        afp_deleteTemplate();
    });
    startBtn.on('click', function() {
        afp_startScheduling(aircraftFlightPlanState.offsetDays || 0);
    });
    clearJobBtn.on('click', function() {
        afp_clearJob(true);
    });

    let hint = '';
    if (!hasTemplate) {
        hint = 'Extract a template from a planned aircraft first.';
    } else if (!isEmpty && !jobOnCurrentAircraft) {
        hint = 'Target flight plan must be empty.';
    } else if (jobOnOtherAircraft) {
        hint = 'Another aircraft is currently being scheduled.';
    } else if (jobOnCurrentAircraft) {
        hint = afp_getJobSummary();
    }

    let panel = $('<div id="aes-aircraft-flight-plan-panel" class="as-panel aes-aircraft-flight-plan-panel"></div>').append(
        $('<div class="aes-aircraft-flight-plan-title"></div>').text('AES Flight Plan Assistant'),
        $('<div class="aes-aircraft-flight-plan-main-row"></div>').append(
            $('<div class="aes-aircraft-flight-plan-summary"></div>').append(
                $('<div class="aes-aircraft-flight-plan-summary-row"></div>').append(
                    $('<strong></strong>').text('Template: '),
                    $('<span></span>').text(afp_getTemplateSummary())
                ),
                $('<div class="aes-aircraft-flight-plan-summary-row"></div>').append(
                    $('<strong></strong>').text('Target: '),
                    $('<span></span>').text(aircraftFlightPlanState.aircraft.registration + ' / ' + aircraftFlightPlanState.aircraft.model + (isEmpty ? ' / Empty plan' : ' / Existing assignments'))
                )
            ),
            $('<div class="aes-aircraft-flight-plan-actions"></div>').append(
                $('<div class="btn-group aes-dashboard-control-actions"></div>').append(extractBtn, deleteBtn)
            ),
            $('<div class="aes-aircraft-flight-plan-start"></div>').append(
                $('<label class="control-label aes-aircraft-flight-plan-label"></label>').text('Offset'),
                offsetButtons,
                startBtn,
                clearJobBtn
            )
        ),
        job ? $('<div class="aes-aircraft-flight-plan-job"></div>').text(afp_getJobSummary()) : null,
        $('<div id="aes-aircraft-flight-plan-hint" class="aes-aircraft-flight-plan-hint"></div>').text(hint || ''),
        $('<div id="aes-aircraft-flight-plan-runtime" class="' + (aircraftFlightPlanState.runtimeMessage ? aircraftFlightPlanState.runtimeType : '') + '"></div>').text(aircraftFlightPlanState.runtimeMessage || '')
    );

    let transferHeading = afp_getTransferHeading();
    if (transferHeading.length) {
        transferHeading.before(panel);
    } else {
        afp_getAssignPanel().after(panel);
    }
}

function afp_getUniqueFlightEntries() {
    let entries = {};

    afp_getVisualPlan().find('.day').each(function(dayIndex) {
        $(this).find('.blocks .block.flight').each(function() {
            let block = $(this);
            let code = $('.code', block).first().text().trim();
            let infoHref = $('a[title="View flight number"]', block).attr('href') || '';
            let valueMatch = infoHref.match(/\/numbers\/(\d+)/);
            let value = valueMatch ? valueMatch[1] : '';
            let key = value || code;

            if (!key) {
                return;
            }

            if (!entries[key]) {
                entries[key] = {
                    flightCode: code,
                    flightNumberLabel: code,
                    flightNumberToken: afp_extractFlightNumberToken(code),
                    flightNumberValue: value,
                    selectedDays: [],
                };
            }

            if (entries[key].selectedDays.indexOf(dayIndex) === -1) {
                entries[key].selectedDays.push(dayIndex);
            }
        });
    });

    return Object.keys(entries).map(function(key) {
        entries[key].selectedDays.sort(function(a, b) {
            return a - b;
        });
        return entries[key];
    });
}

function afp_extractFlightNumberToken(text) {
    let match = String(text || '').match(/(\d+)(?!.*\d)/);
    return match ? match[1] : '';
}

function afp_getExistingSelect() {
    return $('select[name*="existingNumber:numbers:numbers_body:input"]').first();
}

function afp_getSelectedExistingFlight() {
    let select = afp_getExistingSelect();
    if (!select.length) {
        return null;
    }

    let option = $('option:selected', select);
    if (!option.length) {
        return null;
    }

    return {
        value: option.val(),
        text: option.text().trim(),
    };
}

function afp_waitFor(checkFn, timeoutMs, intervalMs) {
    timeoutMs = timeoutMs || 5000;
    intervalMs = intervalMs || 100;

    return new Promise(function(resolve) {
        let started = Date.now();
        let timer = window.setInterval(function() {
            let result = false;
            try {
                result = !!checkFn();
            } catch (e) {
                result = false;
            }

            if (result) {
                window.clearInterval(timer);
                resolve(true);
                return;
            }

            if (Date.now() - started >= timeoutMs) {
                window.clearInterval(timer);
                resolve(false);
            }
        }, intervalMs);
    });
}

function afp_collectSegmentIndexes() {
    let indexes = {};
    $('select[name^="segmentSettings:"][name$=":newDeparture:hours"]').each(function() {
        let match = ($(this).attr('name') || '').match(/^segmentSettings:(\d+):newDeparture:hours$/);
        if (match) {
            indexes[match[1]] = true;
        }
    });

    return Object.keys(indexes).map(function(value) {
        return parseInt(value, 10);
    }).sort(function(a, b) {
        return a - b;
    });
}

async function afp_extractTemplate() {
    if (aircraftFlightPlanState.extracting) {
        return;
    }

    let entries = afp_getUniqueFlightEntries();
    if (!entries.length) {
        afp_notify('No assigned flights found to extract.', 'error');
        afp_setRuntimeMessage('No assigned flights found to extract.', 'error');
        return;
    }

    aircraftFlightPlanState.extracting = true;
    afp_setRuntimeMessage('Extracting template...', 'warning');
    afp_renderPanel();

    try {
        let template = {
            createdAt: Date.now(),
            date: AES.getServerDate().date,
            flights: entries,
            sourceAircraftId: aircraftFlightPlanState.aircraft.id,
            sourceModel: aircraftFlightPlanState.aircraft.model,
            sourceRegistration: aircraftFlightPlanState.aircraft.registration,
            type: 'aircraftFlightPlanTemplate',
        };

        aircraftFlightPlanState.template = template;
        await afp_storageSet({ [afp_getTemplateKey()]: template });
        afp_notify('Flight plan template extracted.', 'success');
        afp_setRuntimeMessage('Template extracted.', 'success');
    } catch (error) {
        afp_notify(error.message || 'Template extraction failed.', 'error');
        afp_setRuntimeMessage(error.message || 'Template extraction failed.', 'error');
    } finally {
        aircraftFlightPlanState.extracting = false;
        afp_renderPanel();
    }
}

async function afp_deleteTemplate() {
    await afp_storageRemove([afp_getTemplateKey()]);
    aircraftFlightPlanState.template = null;
    afp_notify('Saved template deleted.', 'success');
    afp_setRuntimeMessage('Saved template deleted.', 'success');
    afp_renderPanel();
}

async function afp_startScheduling(offsetDays) {
    if (!aircraftFlightPlanState.template || !aircraftFlightPlanState.template.flights || !aircraftFlightPlanState.template.flights.length) {
        afp_notify('Extract a template first.', 'error');
        afp_setRuntimeMessage('Extract a template first.', 'error');
        return;
    }

    if (!afp_isEmptyFlightPlan()) {
        afp_notify('Target flight plan must be empty.', 'error');
        afp_setRuntimeMessage('Target flight plan must be empty.', 'error');
        return;
    }

    let job = {
        createdAt: Date.now(),
        currentIndex: 0,
        entries: aircraftFlightPlanState.template.flights,
        errorMessage: '',
        offsetDays: offsetDays,
        sourceAircraftId: aircraftFlightPlanState.template.sourceAircraftId,
        sourceRegistration: aircraftFlightPlanState.template.sourceRegistration,
        status: 'selecting',
        targetAircraftId: aircraftFlightPlanState.aircraft.id,
        targetModel: aircraftFlightPlanState.aircraft.model,
        targetRegistration: aircraftFlightPlanState.aircraft.registration,
        type: 'aircraftFlightPlanSchedulingJob',
    };

    aircraftFlightPlanState.job = job;
    await afp_storageSet({ [afp_getJobKey()]: job });
    afp_setRuntimeMessage('Scheduling started.', 'warning');
    afp_renderPanel();
    afp_resumePendingJob();
}

async function afp_clearJob(notifyUser) {
    await afp_storageRemove([afp_getJobKey()]);
    aircraftFlightPlanState.job = null;
    if (notifyUser) {
        afp_notify('Scheduling job cleared.', 'success');
        afp_setRuntimeMessage('Scheduling job cleared.', 'success');
    }
    afp_renderPanel();
}

function afp_getJobEntry(job) {
    if (!job || !Array.isArray(job.entries)) {
        return null;
    }

    return job.entries[job.currentIndex] || null;
}

function afp_selectionMatchesEntry(selected, entry) {
    if (!selected || !entry) {
        return false;
    }

    if (entry.flightNumberValue && selected.value === entry.flightNumberValue) {
        return true;
    }

    if (entry.flightNumberToken && afp_extractFlightNumberToken(selected.text) === entry.flightNumberToken) {
        return true;
    }

    return entry.flightNumberLabel ? selected.text.trim() === entry.flightNumberLabel : false;
}

function afp_activateExistingTabIfNeeded() {
    if (afp_getExistingSelect().length) {
        return false;
    }

    let link = $('a').filter(function() {
        return $(this).text().trim() === 'Existing Flight Number';
    }).first();

    if (!link.length) {
        return false;
    }

    link[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return true;
}

function afp_findMatchingOption(select, entry) {
    let options = $('option', select);
    let match = options.filter(function() {
        return $(this).val() === entry.flightNumberValue;
    }).first();
    if (match.length) {
        return match;
    }

    match = options.filter(function() {
        return afp_extractFlightNumberToken($(this).text()) === entry.flightNumberToken;
    }).first();
    if (match.length) {
        return match;
    }

    return options.filter(function() {
        return $(this).text().trim() === entry.flightNumberLabel;
    }).first();
}

function afp_selectExistingFlight(entry) {
    let select = afp_getExistingSelect();
    if (!select.length) {
        throw new Error('Existing flight number selector is not available.');
    }

    let option = afp_findMatchingOption(select, entry);
    if (!option.length) {
        throw new Error('Could not match flight number ' + (entry.flightCode || entry.flightNumberLabel) + ' on target aircraft.');
    }

    select.val(option.val());
    let event = new Event('change', { bubbles: true });
    select[0].dispatchEvent(event);
}

function afp_setCheckboxValue(element, checked) {
    if (!element || !element.length) {
        return;
    }
    element.prop('checked', !!checked);
}

function afp_setSelectValue(element, value) {
    if (!element || !element.length || value == null) {
        return;
    }
    element.val(String(value));
}

function afp_getPlannerSourceDaySettings(entry) {
    return afp_collectSegmentIndexes().map(function(segmentIndex) {
        let days = {};
        entry.selectedDays.forEach(function(sourceDay) {
            days[sourceDay] = {
                arrivalHours: String($('select[name="segmentsContainer:segments:' + segmentIndex + ':newArrivals:' + sourceDay + ':newArrival:hours"]').val() || ''),
                arrivalMinutes: String($('select[name="segmentsContainer:segments:' + segmentIndex + ':newArrivals:' + sourceDay + ':newArrival:minutes"]').val() || ''),
                departureOffset: String($('select[name="segmentsContainer:segments:' + segmentIndex + ':departure-offsets:' + sourceDay + ':departureOffset"]').val() || '0'),
                fixedArrival: !!$('input[name="segmentsContainer:segments:' + segmentIndex + ':fixedArrivalSelection:' + sourceDay + ':fixedArrival"]').prop('checked'),
            };
        });

        return {
            days: days,
            index: segmentIndex,
        };
    });
}

function afp_applyFlightEntryToPlanner(entry, offsetDays) {
    let selected = afp_getSelectedExistingFlight();
    if (!afp_selectionMatchesEntry(selected, entry)) {
        throw new Error('Planner is not loaded for the expected flight number.');
    }

    let sourceSegmentSettings = afp_getPlannerSourceDaySettings(entry);

    let targetDays = {};
    entry.selectedDays.forEach(function(sourceDay) {
        let dayData = { sourceDay: sourceDay, targetDay: (sourceDay + offsetDays) % 7 };
        targetDays[dayData.targetDay] = dayData;
    });

    $('input[type="checkbox"][name^="days:daySelection:"][name$=":ticked"]').each(function() {
        let match = ($(this).attr('name') || '').match(/^days:daySelection:(\d+):ticked$/);
        if (!match) {
            return;
        }
        let targetDay = parseInt(match[1], 10);
        afp_setCheckboxValue($(this), !!targetDays[targetDay]);
    });

    sourceSegmentSettings.forEach(function(segment) {
        for (let day = 0; day < 7; day++) {
            afp_setSelectValue($('select[name="segmentsContainer:segments:' + segment.index + ':departure-offsets:' + day + ':departureOffset"]'), '0');
            afp_setCheckboxValue($('input[name="segmentsContainer:segments:' + segment.index + ':fixedArrivalSelection:' + day + ':fixedArrival"]'), false);
        }

        entry.selectedDays.forEach(function(sourceDay) {
            let targetDay = (sourceDay + offsetDays) % 7;
            let daySettings = segment.days[sourceDay];
            afp_setSelectValue($('select[name="segmentsContainer:segments:' + segment.index + ':departure-offsets:' + targetDay + ':departureOffset"]'), daySettings.departureOffset);
            afp_setCheckboxValue($('input[name="segmentsContainer:segments:' + segment.index + ':fixedArrivalSelection:' + targetDay + ':fixedArrival"]'), daySettings.fixedArrival);

            if (daySettings.fixedArrival) {
                afp_setSelectValue($('select[name="segmentsContainer:segments:' + segment.index + ':newArrivals:' + targetDay + ':newArrival:hours"]'), daySettings.arrivalHours);
                afp_setSelectValue($('select[name="segmentsContainer:segments:' + segment.index + ':newArrivals:' + targetDay + ':newArrival:minutes"]'), daySettings.arrivalMinutes);
            }
        });
    });
}

function afp_entryAppearsInVisualPlan(entry, offsetDays) {
    let visualPlan = afp_getVisualPlan();
    if (!visualPlan.length) {
        return false;
    }

    return entry.selectedDays.every(function(sourceDay) {
        let targetDay = (sourceDay + offsetDays) % 7;
        let day = visualPlan.find('.day').eq(targetDay);
        if (!day.length) {
            return false;
        }

        let found = false;
        day.find('.blocks .block.flight .code').each(function() {
            let codeText = $(this).text().trim();
            if (entry.flightCode && codeText === entry.flightCode) {
                found = true;
                return false;
            }
            if (entry.flightNumberToken && afp_extractFlightNumberToken(codeText) === entry.flightNumberToken) {
                found = true;
                return false;
            }
        });

        return found;
    });
}

function afp_submitPlanner() {
    let submitBtn = $('input[type="submit"][name="button-submit"]').first();
    if (!submitBtn.length) {
        throw new Error('Apply schedule settings button is not available.');
    }
    submitBtn[0].click();
}

async function afp_saveJob() {
    if (!aircraftFlightPlanState.job) {
        return;
    }
    await afp_storageSet({ [afp_getJobKey()]: aircraftFlightPlanState.job });
}

async function afp_completeJob() {
    afp_notify('Flight plan scheduling completed.', 'success');
    afp_setRuntimeMessage('Flight plan scheduling completed.', 'success');
    await afp_clearJob(false);
    afp_renderPanel();
}

async function afp_failJob(message) {
    if (aircraftFlightPlanState.job) {
        aircraftFlightPlanState.job.status = 'error';
        aircraftFlightPlanState.job.errorMessage = message;
        await afp_saveJob();
    }
    afp_notify(message, 'error');
    afp_setRuntimeMessage(message, 'error');
    afp_renderPanel();
}

async function afp_processJob() {
    let guard = 0;
    while (aircraftFlightPlanState.job && guard < 20) {
        guard++;
        let job = aircraftFlightPlanState.job;

        if (String(job.targetAircraftId) !== String(aircraftFlightPlanState.aircraft.id)) {
            return;
        }

        if (job.currentIndex >= job.entries.length) {
            await afp_completeJob();
            return;
        }

        let entry = afp_getJobEntry(job);
        if (!entry) {
            await afp_completeJob();
            return;
        }

        if (job.status === 'selecting' || job.status === 'waitForSelection') {
            if (afp_activateExistingTabIfNeeded()) {
                let ready = await afp_waitFor(function() {
                    return afp_getExistingSelect().length > 0;
                }, 5000, 100);
                if (!ready) {
                    await afp_failJob('Could not open Existing Flight Number tab.');
                    return;
                }
                continue;
            }

            let selected = afp_getSelectedExistingFlight();
            if (afp_selectionMatchesEntry(selected, entry)) {
                aircraftFlightPlanState.job.status = 'applying';
                await afp_saveJob();
                afp_renderPanel();
                continue;
            }

            aircraftFlightPlanState.job.status = 'waitForSelection';
            await afp_saveJob();
            afp_renderPanel();
            afp_setRuntimeMessage('Loading ' + entry.flightCode + '...', 'warning');
            afp_selectExistingFlight(entry);
            return;
        }

        if (job.status === 'applying') {
            afp_setRuntimeMessage('Applying ' + entry.flightCode + '...', 'warning');
            afp_applyFlightEntryToPlanner(entry, job.offsetDays);
            aircraftFlightPlanState.job.status = 'waitForApply';
            await afp_saveJob();
            afp_renderPanel();
            afp_submitPlanner();
            return;
        }

        if (job.status === 'waitForApply') {
            if (!afp_entryAppearsInVisualPlan(entry, job.offsetDays)) {
                await afp_failJob('Could not confirm scheduled days for ' + entry.flightCode + '.');
                return;
            }

            aircraftFlightPlanState.job.currentIndex++;
            aircraftFlightPlanState.job.status = 'selecting';
            await afp_saveJob();
            afp_renderPanel();
            continue;
        }

        if (job.status === 'error' || job.status === 'done') {
            return;
        }

        await afp_failJob('Unknown scheduling state.');
        return;
    }
}

async function afp_resumePendingJob() {
    let job = aircraftFlightPlanState.job;
    if (!job || aircraftFlightPlanState.processingJob) {
        return;
    }

    if (String(job.targetAircraftId) !== String(aircraftFlightPlanState.aircraft.id)) {
        return;
    }

    if (job.status === 'done' || job.status === 'error') {
        afp_renderPanel();
        return;
    }

    aircraftFlightPlanState.processingJob = true;
    try {
        await afp_processJob();
    } catch (error) {
        await afp_failJob(error.message || 'Scheduling failed.');
    } finally {
        aircraftFlightPlanState.processingJob = false;
    }
}
