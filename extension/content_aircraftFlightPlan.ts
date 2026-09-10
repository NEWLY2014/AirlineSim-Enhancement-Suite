"use strict";
(() => {
const aircraftFlightPlanState: AESModel.FlightPlanState = {
    airline: { id: null, name: null, code: '', displayName: '' },
    aircraft: { id: '', registration: '', model: '' },
    extracting: false,
    hubObserver: null,
    hubSaveTimer: undefined,
    job: null,
    jobInvalid: false,
    notifications: null,
    offsetDays: 1,
    processingJob: false,
    runtimeMessage: '',
    runtimeType: 'warning',
    server: '',
    template: null,
    templateStale: false,
};
class FlightPlanCancelled extends Error {}
let activeRun: { job: AESModel.FlightPlanJob; cancelled: boolean } | null = null;
let startingJob = false;
let jobToken: string | null = null;

function afp_assertPageOwner() {
    if (!AES.isPageOwner()) throw new FlightPlanCancelled('Page ownership lost');
}

function afp_assertJobAction() {
    afp_assertPageOwner();
    if (activeRun && (activeRun.cancelled || activeRun.job !== aircraftFlightPlanState.job)) {
        throw new FlightPlanCancelled('Scheduling stopped');
    }
}

function afp_runAction(action: () => Promise<void>) {
    action().catch(error => {
        if (error instanceof FlightPlanCancelled) return;
        const message = error instanceof Error ? error.message : 'Flight plan action failed.';
        afp_notify(message, 'error');
        afp_setRuntimeMessage(message, 'error');
        AES.reportContentScriptError('content_aircraftFlightPlan', error);
        afp_renderPanel();
    });
}

const AIRCRAFT_FLIGHT_PLAN_TEMPLATE_VERSION = 6;
const AIRCRAFT_FLIGHT_PLAN_SCRIPT_ENABLED = AES.runContentScript("content_aircraftFlightPlan", function() {
    AES.waitForElement(aircraftFlightPlanReadyTarget, function() {
        return aircraftFlightPlanInit();
    }, {
        scriptName: "content_aircraftFlightPlan"
    });
});

if (AIRCRAFT_FLIGHT_PLAN_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        if (activeRun) activeRun.cancelled = true;
        if (aircraftFlightPlanState.hubObserver) {
            aircraftFlightPlanState.hubObserver.disconnect();
            aircraftFlightPlanState.hubObserver = null;
        }
        window.clearTimeout(aircraftFlightPlanState.hubSaveTimer);
        aircraftFlightPlanState.hubSaveTimer = undefined;
        $('#aes-aircraft-flight-plan-panel').remove();
        aircraftFlightPlanState.processingJob = false;
    });
}

async function aircraftFlightPlanInit() {
    if (!afp_getAssignPanel().length || !afp_getVisualPlan().length) {
        return;
    }

    aircraftFlightPlanState.server = AES.getServerName();
    let currentAirline = AES.getCurrentAirline();
    aircraftFlightPlanState.airline = currentAirline && currentAirline.id ? currentAirline : AES.getAirline();
    aircraftFlightPlanState.notifications = typeof Notifications === 'function' ? new Notifications() : null;
    aircraftFlightPlanState.aircraft = afp_getCurrentAircraft();
    await afp_saveFlightPlanHubData();

    let result = await afp_storageGet([afp_getTemplateKey(), afp_getJobKey(), afp_getOffsetDaysKey()]);
    aircraftFlightPlanState.template = afp_normalizeTemplate(result[afp_getTemplateKey()] || null);
    aircraftFlightPlanState.job = afp_normalizeJob(result[afp_getJobKey()]);
    aircraftFlightPlanState.jobInvalid = result[afp_getJobKey()] != null && !aircraftFlightPlanState.job;
    aircraftFlightPlanState.offsetDays = afp_normalizeOffsetDays(result[afp_getOffsetDaysKey()] || (aircraftFlightPlanState.job && aircraftFlightPlanState.job.offsetDays));
    if (!aircraftFlightPlanState.template && result[afp_getTemplateKey()]) {
        aircraftFlightPlanState.templateStale = true;
        // Retain corrupt current-version records for recovery; old schema versions
        // still follow the existing re-extraction migration path.
        const storedTemplate = result[afp_getTemplateKey()];
        if (AES.isRecord(storedTemplate) && storedTemplate.schemaVersion !== AIRCRAFT_FLIGHT_PLAN_TEMPLATE_VERSION) {
            await afp_storageRemove([afp_getTemplateKey()]);
        }
    } else {
        aircraftFlightPlanState.templateStale = false;
    }

    if (aircraftFlightPlanState.job && String(aircraftFlightPlanState.job.targetAircraftId) === aircraftFlightPlanState.aircraft.id) {
        await afp_jobMessage('claim');
    }
    afp_renderPanel();
    afp_watchFlightPlanHubData();
    window.setTimeout(function() {
        afp_resumePendingJob();
    }, 300);
}

function aircraftFlightPlanReadyTarget() {
    return afp_getAssignPanel().length && afp_getVisualPlan().length;
}

function afp_getTemplateKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'flightPlanTemplate';
}

function afp_getJobKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'flightPlanSchedulingJob';
}

async function afp_jobMessage(op: 'create' | 'claim' | 'save' | 'clear' | 'check', job?: AESModel.FlightPlanJob) {
    afp_assertPageOwner();
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
        chrome.runtime.sendMessage({type:'AES_FLIGHT_PLAN_JOB', op, key:afp_getJobKey(), token:jobToken, job}, response => {
            if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
            if (!AES.isRecord(response) || response.ok !== true) { reject(new Error(AES.isRecord(response) ? String(response.error) : 'Scheduling service unavailable.')); return; }
            resolve(response);
        });
    });
    afp_assertPageOwner();
    if (typeof response.token === 'string') jobToken = response.token;
}

function afp_getOffsetDaysKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'flightPlanAssistantOffsetDays';
}

function afp_getHubKey() {
    return aircraftFlightPlanState.server + aircraftFlightPlanState.airline.id + 'aircraftFlightPlanHub' + aircraftFlightPlanState.aircraft.id;
}

function afp_getFlightPlanHubStats() {
    let counts: Record<string, number> = {};
    afp_getVisualPlan().find('.block.location .inbound, .block.location .outbound').each(function() {
        let airport = String($(this).attr('title') || $(this).text() || '').trim().toUpperCase();
        if (!airport) {
            return;
        }
        counts[airport] = (counts[airport] || 0) + 1;
    });

    let airports = Object.keys(counts).sort(function(a, b) {
        if (counts[b] === counts[a]) {
            return a.localeCompare(b);
        }
        return counts[b] - counts[a];
    });

    return {
        counts: counts,
        hub: airports[0] || '',
    };
}

async function afp_saveFlightPlanHubData() {
    let stats = afp_getFlightPlanHubStats();
    if (!stats.hub || !aircraftFlightPlanState.airline || !aircraftFlightPlanState.airline.id || !aircraftFlightPlanState.aircraft.id) {
        return;
    }

    await afp_storageSet({
        [afp_getHubKey()]: {
            aircraftId: aircraftFlightPlanState.aircraft.id,
            counts: stats.counts,
            hub: stats.hub,
            server: aircraftFlightPlanState.server,
            type: 'aircraftFlightPlanHub',
        }
    });
}

function afp_watchFlightPlanHubData() {
    if (!AES.isPageOwner()) return;
    let visualPlan = afp_getVisualPlan();
    if (!visualPlan.length || typeof MutationObserver === 'undefined') {
        return;
    }

    if (aircraftFlightPlanState.hubObserver) {
        aircraftFlightPlanState.hubObserver.disconnect();
    }
    aircraftFlightPlanState.hubObserver = new MutationObserver(function() {
        window.clearTimeout(aircraftFlightPlanState.hubSaveTimer);
        aircraftFlightPlanState.hubSaveTimer = window.setTimeout(function() {
            afp_saveFlightPlanHubData().catch(function(error) {
                AES.reportContentScriptError('content_aircraftFlightPlan', error);
            });
        }, 250);
    });
    aircraftFlightPlanState.hubObserver.observe(visualPlan[0], {
        childList: true,
        subtree: true,
    });
}

function afp_storageGet(keys: string[]) {
    return new Promise<Record<string, unknown>>(function(resolve, reject) {
        afp_assertPageOwner();
        chrome.storage.local.get(keys, function(result) {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!AES.isPageOwner()) return reject(new FlightPlanCancelled('Page ownership lost'));
            resolve(result || {});
        });
    });
}

function afp_storageSet(values: Record<string, unknown>) {
    return new Promise<void>(function(resolve, reject) {
        afp_assertPageOwner();
        chrome.storage.local.set(values, function() {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!AES.isPageOwner()) return reject(new FlightPlanCancelled('Page ownership lost'));
            resolve();
        });
    });
}

function afp_storageRemove(keys: string[]) {
    return new Promise<void>(function(resolve, reject) {
        afp_assertPageOwner();
        chrome.storage.local.remove(keys, function() {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!AES.isPageOwner()) return reject(new FlightPlanCancelled('Page ownership lost'));
            resolve();
        });
    });
}

function afp_normalizeOffsetDays(value: unknown) {
    let offsetDays = parseInt(String(value), 10);
    if (offsetDays < 1 || offsetDays > 6 || isNaN(offsetDays)) {
        return 1;
    }
    return offsetDays;
}

async function afp_saveOffsetDays(offsetDays: number) {
    const normalized = afp_normalizeOffsetDays(offsetDays);
    await afp_storageSet({ [afp_getOffsetDaysKey()]: normalized });
    aircraftFlightPlanState.offsetDays = normalized;
}

function afp_notify(message: string, type?: AESModel.NotificationType) {
    if (AES.isPageOwner() && aircraftFlightPlanState.notifications) {
        aircraftFlightPlanState.notifications.add(message, { type: type || 'success' });
    }
}

function afp_setRuntimeMessage(message: string, type?: AESModel.NotificationType) {
    if (!AES.isPageOwner()) return;
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
        return aircraftFlightPlanState.templateStale ? 'Template needs re-extract' : 'No saved template';
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
    if (!AES.isPageOwner()) return;
    $('#aes-aircraft-flight-plan-panel').remove();
    if (aircraftFlightPlanState.offsetDays < 1 || aircraftFlightPlanState.offsetDays > 6) {
        aircraftFlightPlanState.offsetDays = 1;
    }

    let template = aircraftFlightPlanState.template;
    let job = aircraftFlightPlanState.job;
    let isEmpty = afp_isEmptyFlightPlan();
    let hasTemplate = !!(template && Array.isArray(template.flights) && template.flights.length);
    let jobIsActive = job && job.status !== 'done' && job.status !== 'error';
    let jobOnCurrentAircraft = !!(job && jobIsActive && String(job.targetAircraftId) === String(aircraftFlightPlanState.aircraft.id));
    let jobOnOtherAircraft = !!(job && jobIsActive && String(job.targetAircraftId) !== String(aircraftFlightPlanState.aircraft.id));
    let canStart = !aircraftFlightPlanState.jobInvalid && !startingJob && !aircraftFlightPlanState.processingJob && hasTemplate && isEmpty && !aircraftFlightPlanState.extracting && !jobOnOtherAircraft && !jobOnCurrentAircraft;

    let extractBtn = $('<button type="button" class="btn btn-default"></button>').text(aircraftFlightPlanState.extracting ? 'Extracting...' : 'Extract template').prop('disabled', aircraftFlightPlanState.extracting);
    let deleteBtn = $('<button type="button" class="btn btn-default"></button>').text('Delete saved template').prop('disabled', !hasTemplate || aircraftFlightPlanState.extracting);
    let scheduleBtn = $('<button type="button" class="btn btn-default"></button>')
        .text(jobIsActive || aircraftFlightPlanState.jobInvalid ? 'Stop scheduling' : 'Start scheduling')
        .prop('disabled', jobIsActive || aircraftFlightPlanState.jobInvalid ? false : !canStart);
    let offsetButtons = $('<div class="btn-group aes-aircraft-flight-plan-offset-group" role="group" aria-label="Offset days"></div>');
    let offsetButtonsDisabled = aircraftFlightPlanState.extracting || jobOnCurrentAircraft || jobOnOtherAircraft;

    for (let i = 1; i <= 6; i++) {
        let offsetBtn = $('<button type="button" class="btn btn-default aes-aircraft-flight-plan-offset-btn"></button>')
            .text(String(i))
            .attr('data-offset-days', i)
            .toggleClass('active', aircraftFlightPlanState.offsetDays === i)
            .prop('disabled', offsetButtonsDisabled);
        offsetBtn.on('click', function() {
            afp_runAction(async () => {
                await afp_saveOffsetDays(i);
                afp_renderPanel();
            });
        });
        offsetButtons.append(offsetBtn);
    }

    extractBtn.on('click', function() {
        afp_runAction(afp_extractTemplate);
    });
    deleteBtn.on('click', function() {
        afp_runAction(afp_deleteTemplate);
    });
    scheduleBtn.on('click', function() {
        if (aircraftFlightPlanState.jobInvalid || (aircraftFlightPlanState.job && aircraftFlightPlanState.job.status !== 'done' && aircraftFlightPlanState.job.status !== 'error')) {
            afp_runAction(() => afp_clearJob(true));
            return;
        }
        afp_runAction(() => afp_startScheduling(aircraftFlightPlanState.offsetDays || 1));
    });

    let hint = '';
    if (aircraftFlightPlanState.jobInvalid) {
        hint = 'Saved scheduling job is invalid. Stop scheduling to clear it before starting again.';
    } else if (aircraftFlightPlanState.templateStale) {
        hint = 'Saved template is outdated. Please extract a fresh template.';
    } else if (!hasTemplate) {
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
                scheduleBtn
            )
        ),
        job ? $('<div class="aes-aircraft-flight-plan-job"></div>').text(afp_getJobSummary()) : $(),
        $('<div id="aes-aircraft-flight-plan-hint" class="aes-aircraft-flight-plan-hint"></div>').text(hint || ''),
        $('<div id="aes-aircraft-flight-plan-runtime" class="' + (aircraftFlightPlanState.runtimeMessage ? aircraftFlightPlanState.runtimeType : '') + '"></div>').text(aircraftFlightPlanState.runtimeMessage || '')
    );

    let transferHeading = afp_getTransferHeading();
    AES.markOwnedElements(panel);
    if (transferHeading.length) {
        transferHeading.before(panel);
    } else {
        let assignPanel = afp_getAssignPanel();
        if (!assignPanel.length) {
            throw new Error("Flight Plan Assistant insertion target was not found");
        }
        assignPanel.after(panel);
    }
}

function afp_getUniqueFlightEntries() {
    let entries: Record<string, AESModel.VisualFlightPlanEntry> = {};

    afp_getVisualPlan().find('.day').each(function(dayIndex) {
        $(this).find('.blocks .block.flight.started').each(function() {
            let block = $(this);
            let code = $('.code', block).first().text().trim();
            let infoHref = $('a[title="View flight number"]', block).attr('href') || '';
            let valueMatch = infoHref.match(/\/numbers\/(\d+)/);
            let value = valueMatch ? valueMatch[1] : '';
            let segmentMatch = infoHref.match(/[?&]segment=(\d+)/);
            let segmentIndex = segmentMatch ? parseInt(segmentMatch[1], 10) : 0;
            let key = value || code;

            if (!key) {
                return;
            }

            if (!entries[key]) {
                entries[key] = {
                    daySettings: {},
                    flightCode: code,
                    flightNumberLabel: code,
                    flightNumberToken: afp_extractFlightNumberToken(code),
                    flightNumberValue: value,
                    selectedDays: [],
                };
            }

            // The visual plan renders every leg of a via flight as a separate
            // block. Only segment 0 identifies the flight's selectable service
            // day; later segments belong to that same occurrence, even when
            // they depart after midnight.
            if (segmentIndex === 0 && entries[key].selectedDays.indexOf(dayIndex) === -1) {
                entries[key].selectedDays.push(dayIndex);
                entries[key].daySettings[dayIndex] = {
                    departure: afp_getVisualBlockDepartureTime(block),
                    segments: {},
                };
            }

            if (!entries[key]._segments) {
                entries[key]._segments = [];
            }
            entries[key]._segments.push({
                arrival: afp_getVisualBlockArrivalTime(block, dayIndex),
                dayIndex: dayIndex,
                departure: afp_getVisualBlockDepartureTime(block),
                segmentIndex: segmentIndex,
            });
        });
    });

    return Object.keys(entries).map(function(key) {
        let entry = entries[key];
        entry.selectedDays.sort(function(a, b) {
            return a - b;
        });

        entry._segments?.forEach(function(segment) {
            let segmentDepartureMinutes = segment.dayIndex * 1440 +
                (parseInt(segment.departure.hours, 10) || 0) * 60 +
                (parseInt(segment.departure.minutes, 10) || 0);
            let sourceDay = null;
            let shortestDistance = 7 * 1440 + 1;

            entry.selectedDays.forEach(function(candidateDay) {
                let candidate = entry.daySettings[candidateDay];
                let candidateDepartureMinutes = candidateDay * 1440 +
                    (parseInt(candidate.departure.hours, 10) || 0) * 60 +
                    (parseInt(candidate.departure.minutes, 10) || 0);
                let distance = (segmentDepartureMinutes - candidateDepartureMinutes + 7 * 1440) % (7 * 1440);
                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    sourceDay = candidateDay;
                }
            });

            if (sourceDay != null) {
                entry.daySettings[sourceDay].segments[segment.segmentIndex] = {
                    arrival: segment.arrival,
                };
            }
        });

        delete entry._segments;
        return entry;
    });
}

function afp_isTime(value: unknown): value is AESModel.FlightPlanTime {
    return AES.isRecord(value) &&
        ['hours', 'minutes', 'value'].every(key => value[key] === undefined || typeof value[key] === 'string') &&
        (value.dayOffset === undefined || (typeof value.dayOffset === 'number' && Number.isInteger(value.dayOffset)));
}

function afp_isDaySettings(value: unknown): value is AESModel.FlightPlanDay {
    return AES.isRecord(value) &&
        (value.departure === undefined || afp_isTime(value.departure)) &&
        (value.arrival === undefined || afp_isTime(value.arrival)) &&
        (value.segments === undefined || (AES.isRecord(value.segments) && Object.values(value.segments).every(segment =>
            AES.isRecord(segment) && (segment.arrival === undefined || afp_isTime(segment.arrival)))));
}

function afp_isEntry(value: unknown): value is AESModel.FlightPlanEntry {
    return AES.isRecord(value) &&
        ['flightCode', 'flightNumberLabel', 'flightNumberToken', 'flightNumberValue'].every(key =>
            value[key] === undefined || typeof value[key] === 'string') &&
        ['flightCode', 'flightNumberLabel', 'flightNumberToken', 'flightNumberValue'].some(key =>
            typeof value[key] === 'string' && value[key].trim() !== '') &&
        Array.isArray(value.selectedDays) && value.selectedDays.length > 0 &&
        value.selectedDays.every(day => Number.isInteger(day) && day >= 0 && day <= 6) &&
        (value.daySettings === undefined || (AES.isRecord(value.daySettings) && Object.values(value.daySettings).every(afp_isDaySettings)));
}

function afp_normalizeTemplate(template: unknown): AESModel.FlightPlanTemplate | null {
    if (!AES.isRecord(template) || template.type !== 'aircraftFlightPlanTemplate' ||
        template.schemaVersion !== AIRCRAFT_FLIGHT_PLAN_TEMPLATE_VERSION ||
        typeof template.sourceAircraftId !== 'string' || typeof template.sourceModel !== 'string' ||
        typeof template.sourceRegistration !== 'string' || !Array.isArray(template.flights) ||
        !template.flights.length || !template.flights.every(afp_isEntry)) return null;
    return { ...template, type: template.type, schemaVersion: template.schemaVersion,
        sourceAircraftId: template.sourceAircraftId, sourceModel: template.sourceModel,
        sourceRegistration: template.sourceRegistration, flights: template.flights };
}

function afp_isJobStatus(value: unknown): value is AESModel.FlightPlanJobStatus {
    return value === 'selecting' || value === 'waitForSelection' || value === 'applying' ||
        value === 'waitForApply' || value === 'done' || value === 'error';
}

function afp_normalizeJob(value: unknown): AESModel.FlightPlanJob | null {
    if (!AES.isRecord(value) || value.type !== 'aircraftFlightPlanSchedulingJob' ||
        !afp_isJobStatus(value.status) || !Array.isArray(value.entries) || !value.entries.length ||
        !value.entries.every(afp_isEntry) || typeof value.currentIndex !== 'number' ||
        !Number.isInteger(value.currentIndex) || value.currentIndex < 0 || value.currentIndex > value.entries.length ||
        typeof value.offsetDays !== 'number' || !Number.isInteger(value.offsetDays) || value.offsetDays < 1 || value.offsetDays > 6 ||
        (typeof value.targetAircraftId !== 'string' && typeof value.targetAircraftId !== 'number') ||
        (value.targetRegistration !== undefined && typeof value.targetRegistration !== 'string') ||
        (value.errorMessage !== undefined && typeof value.errorMessage !== 'string')) return null;
    return { ...value, type: value.type, status: value.status, entries: value.entries,
        currentIndex: value.currentIndex, offsetDays: value.offsetDays, targetAircraftId: value.targetAircraftId,
        targetRegistration: value.targetRegistration, errorMessage: value.errorMessage };
}

function afp_extractFlightNumberToken(text: string) {
    let match = String(text || '').match(/(\d+)(?!.*\d)/);
    return match ? match[1] : '';
}

function afp_getVisualBlockFlightNumberId(block: JQuery | HTMLElement) {
    let infoHref = $('a[title="View flight number"]', block).attr('href') || '';
    let valueMatch = infoHref.match(/\/numbers\/(\d+)/);
    return valueMatch ? valueMatch[1] : '';
}

function afp_parseVisualPlanTime(text: string) {
    let normalized = String(text || '').replace(/\D/g, '');
    if (normalized.length === 3) {
        normalized = '0' + normalized;
    }
    if (normalized.length !== 4) {
        return {
            dayOffset: 0,
            hours: '',
            minutes: '',
            value: '',
        };
    }

    return {
        dayOffset: 0,
        hours: normalized.slice(0, 2),
        minutes: normalized.slice(2, 4),
        value: normalized,
    };
}

function afp_minutesToVisualTime(totalMinutes: number) {
    totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
    let hours = Math.floor(totalMinutes / 60);
    let minutes = totalMinutes % 60;
    return {
        dayOffset: 0,
        hours: String(hours).padStart(2, '0'),
        minutes: String(minutes).padStart(2, '0'),
        value: String(hours).padStart(2, '0') + String(minutes).padStart(2, '0'),
    };
}

function afp_getVisualBlockGeometry(block: JQuery | HTMLElement) {
    let style = String($(block).attr('style') || '');
    let marginMatch = style.match(/margin-left:\s*([\d.]+)%/);
    let widthMatch = style.match(/width:\s*([\d.]+)%/);
    if (!marginMatch || !widthMatch) {
        return null;
    }

    let startMinutes = Math.round(parseFloat(marginMatch[1]) * 14.4);
    let durationMinutes = Math.round(parseFloat(widthMatch[1]) * 14.4);
    return {
        durationMinutes: durationMinutes,
        endMinutes: (startMinutes + durationMinutes) % 1440,
        startMinutes: startMinutes % 1440,
    };
}

function afp_getVisualBlockDepartureTime(block: JQuery) {
    let startTime = afp_parseVisualPlanTime($('.times .start', block).first().text());
    if (startTime.value) {
        return startTime;
    }

    let geometry = afp_getVisualBlockGeometry(block);
    if (geometry) {
        return afp_minutesToVisualTime(geometry.startMinutes);
    }

    return startTime;
}

function afp_parseVisualArrivalFromBlock(block: JQuery) {
    let endTime = afp_parseVisualPlanTime($('.times .end', block).first().text());
    if (endTime.value) {
        return endTime;
    }

    let geometry = afp_getVisualBlockGeometry(block);
    if (geometry) {
        return afp_minutesToVisualTime(geometry.endMinutes);
    }

    return endTime;
}

function afp_getVisualBlockArrivalTime(block: JQuery, dayIndex: number) {
    let currentBlockArrival = afp_parseVisualArrivalFromBlock(block);
    if (!block.hasClass('started') || block.hasClass('ended')) {
        return currentBlockArrival;
    }

    let nextDay = afp_getVisualPlan().find('.day').eq((dayIndex + 1) % 7);
    if (!nextDay.length) {
        return currentBlockArrival;
    }

    let code = $('.code', block).first().text().trim();
    let codeToken = afp_extractFlightNumberToken(code);
    let flightNumberId = afp_getVisualBlockFlightNumberId(block);
    let nextDayEndedBlock = nextDay.find('.blocks .block.flight.ended').filter(function() {
        if ($(this).hasClass('started')) {
            return false;
        }
        let nextDayFlightNumberId = afp_getVisualBlockFlightNumberId(this);
        if (flightNumberId && nextDayFlightNumberId === flightNumberId) {
            return true;
        }
        let nextDayCode = $('.code', this).first().text().trim();
        if (nextDayCode === code) {
            return true;
        }
        return !!codeToken && afp_extractFlightNumberToken(nextDayCode) === codeToken;
    }).first();

    if (!nextDayEndedBlock.length) {
        return currentBlockArrival;
    }

    let nextDayArrival = afp_parseVisualArrivalFromBlock(nextDayEndedBlock);
    if (nextDayArrival.value) {
        nextDayArrival.dayOffset = 1;
        return nextDayArrival;
    }
    return currentBlockArrival;
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
        value: String(option.val() || ''),
        text: option.text().trim(),
    };
}

function afp_waitFor(checkFn: () => unknown, timeoutMs = 5000, intervalMs = 100) {
    timeoutMs = timeoutMs || 5000;
    intervalMs = intervalMs || 100;

    return new Promise<boolean>(function(resolve, reject) {
        let started = Date.now();
        let timer = window.setInterval(function() {
            try { afp_assertJobAction(); } catch (error) { window.clearInterval(timer); reject(error); return; }
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
    let indexes: Record<string, boolean> = {};
    let plannerForm = afp_getPlannerForm();

    $('select, input', plannerForm).each(function() {
        let name = $(this).attr('name') || '';
        let match = name.match(/^segmentSettings:(\d+):newDeparture:hours$/);
        if (!match) {
            match = name.match(/^segmentsContainer:segments:(\d+):newArrivals:\d+:newArrival:(hours|minutes)$/);
        }
        if (!match) {
            match = name.match(/^segmentsContainer:segments:(\d+):departure-offsets:\d+:departureOffset$/);
        }
        if (!match) {
            match = name.match(/^segmentsContainer:segments:(\d+):fixedArrivalSelection:\d+:fixedArrival$/);
        }
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
        let template: AESModel.FlightPlanTemplate = {
            createdAt: Date.now(),
            date: AES.getServerDate().date,
            flights: entries,
            schemaVersion: AIRCRAFT_FLIGHT_PLAN_TEMPLATE_VERSION,
            sourceAircraftId: aircraftFlightPlanState.aircraft.id,
            sourceModel: aircraftFlightPlanState.aircraft.model,
            sourceRegistration: aircraftFlightPlanState.aircraft.registration,
            type: 'aircraftFlightPlanTemplate',
        };

        await afp_storageSet({ [afp_getTemplateKey()]: template });
        aircraftFlightPlanState.template = template;
        aircraftFlightPlanState.templateStale = false;
        afp_notify('Flight plan template extracted.', 'success');
        afp_setRuntimeMessage('Template extracted.', 'success');
    } catch (error) {
        afp_notify(error instanceof Error ? error.message : 'Template extraction failed.', 'error');
        afp_setRuntimeMessage(error instanceof Error ? error.message : 'Template extraction failed.', 'error');
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

async function afp_startScheduling(offsetDays: number) {
    if (aircraftFlightPlanState.jobInvalid || startingJob || aircraftFlightPlanState.processingJob) return;
    if (aircraftFlightPlanState.job && !['done', 'error'].includes(aircraftFlightPlanState.job.status)) return;
    startingJob = true;
    try {
        offsetDays = afp_normalizeOffsetDays(offsetDays);
        await afp_saveOffsetDays(offsetDays);

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

        let job: AESModel.FlightPlanJob = {
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

        await afp_jobMessage('create', job);
        aircraftFlightPlanState.job = job;
        afp_setRuntimeMessage('Scheduling started.', 'warning');
        afp_renderPanel();
        await afp_resumePendingJob();
    } finally {
        startingJob = false;
        afp_renderPanel();
    }
}

async function afp_clearJob(notifyUser: boolean) {
    if (activeRun && notifyUser) activeRun.cancelled = true;
    if (!jobToken) await afp_jobMessage('claim');
    await afp_jobMessage('clear');
    jobToken = null;
    aircraftFlightPlanState.job = null;
    aircraftFlightPlanState.jobInvalid = false;
    if (notifyUser) {
        afp_notify('Scheduling job cleared.', 'success');
        afp_setRuntimeMessage('Scheduling job cleared.', 'success');
    }
    afp_renderPanel();
}

function afp_getJobEntry(job: AESModel.FlightPlanJob | null) {
    if (!job || !Array.isArray(job.entries)) {
        return null;
    }

    return job.entries[job.currentIndex] || null;
}

function afp_selectionMatchesEntry(selected: AESModel.ExistingFlightSelection | null, entry: AESModel.FlightPlanEntry | null) {
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
    afp_assertJobAction();
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

function afp_findMatchingOption(select: JQuery, entry: AESModel.FlightPlanEntry) {
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

function afp_selectExistingFlight(entry: AESModel.FlightPlanEntry) {
    afp_assertJobAction();
    let select = afp_getExistingSelect();
    if (!select.length) {
        throw new Error('Existing flight number selector is not available.');
    }

    let option = afp_findMatchingOption(select, entry);
    if (!option.length) {
        throw new Error('Could not match flight number ' + (entry.flightCode || entry.flightNumberLabel) + ' on target aircraft.');
    }

    select.val(String(option.val() || ''));
    let event = new Event('change', { bubbles: true });
    select[0].dispatchEvent(event);
}

function afp_setCheckboxValue(element: JQuery, checked: boolean) {
    if (!element || !element.length) {
        return;
    }
    element.prop('checked', !!checked);
}

function afp_getPlannerForm() {
    let submitBtn = $('input[type="submit"][name="button-submit"]').first();
    if (submitBtn.length) {
        let form = submitBtn.closest('form');
        if (form.length) {
            return form;
        }
    }

    let existingSelect = afp_getExistingSelect();
    if (existingSelect.length) {
        let form = existingSelect.closest('form');
        if (form.length) {
            return form;
        }
    }

    return $(document.body);
}

function afp_getPlannerDayCheckbox(day: number) {
    return $('input[type="checkbox"][name="days:daySelection:' + day + ':ticked"]', afp_getPlannerForm()).first();
}

function afp_getPlannerNoneLink() {
    return $('a[href*="daySelection.none"]', afp_getPlannerForm()).first();
}

function afp_clickElement(element: JQuery) {
    afp_assertJobAction();
    if (!element || !element.length || !element[0]) {
        return;
    }

    element[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

async function afp_clearPlannerDaySelection() {
    let dayCheckboxes = $('input[type="checkbox"][name^="days:daySelection:"][name$=":ticked"]', afp_getPlannerForm());
    if (!dayCheckboxes.filter(':checked').length) {
        return;
    }

    let noneLink = afp_getPlannerNoneLink();
    if (noneLink.length) {
        afp_clickElement(noneLink);
        let cleared = await afp_waitFor(function() {
            return !$('input[type="checkbox"][name^="days:daySelection:"][name$=":ticked"]', afp_getPlannerForm()).filter(':checked').length;
        }, 5000, 100);
        if (cleared) {
            return;
        }
    }

    for (let day = 0; day < 7; day++) {
        let checkbox = afp_getPlannerDayCheckbox(day);
        if (checkbox.length && checkbox.prop('checked')) {
            afp_clickElement(checkbox);
            await afp_waitFor(function() {
                let currentCheckbox = afp_getPlannerDayCheckbox(day);
                return currentCheckbox.length && !currentCheckbox.prop('checked');
            }, 3000, 80);
        }
    }
}

async function afp_setPlannerDaySelection(targetDays: AESModel.PlannerTargetDays) {
    for (let day = 0; day < 7; day++) {
        if (!targetDays[day]) {
            continue;
        }
        let checkbox = afp_getPlannerDayCheckbox(day);
        if (!checkbox.length) {
            throw new Error('Could not find planner day selection for day ' + day + '.');
        }
        if (!checkbox.prop('checked')) {
            afp_clickElement(checkbox);
            let checked = await afp_waitFor(function() {
                let currentCheckbox = afp_getPlannerDayCheckbox(day);
                return currentCheckbox.length && currentCheckbox.prop('checked');
            }, 3000, 80);
            if (!checked) {
                throw new Error('Could not select target day ' + day + '.');
            }
        }
    }
}

function afp_setSelectValue(element: JQuery, value: string | number | null | undefined) {
    afp_assertJobAction();
    if (!element || !element.length || value == null) {
        return false;
    }
    let normalizedValue = String(value);
    let optionValues = $('option', element).map(function() {
        return String($(this).val());
    }).get();
    if (optionValues.indexOf(normalizedValue) === -1 && /^\d+$/.test(normalizedValue)) {
        normalizedValue = String(parseInt(normalizedValue, 10));
    }
    if (optionValues.indexOf(normalizedValue) === -1) {
        return false;
    }

    if (String(element.val() || '') === normalizedValue) {
        return true;
    }

    element.val(normalizedValue);
    if (element[0]) {
        element[0].dispatchEvent(new Event('input', { bubbles: true }));
        element[0].dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
}

function afp_getArrivalSelects(plannerForm: JQuery, segmentIndex: number, day: number) {
    return {
        hours: $('select[name="segmentsContainer:segments:' + segmentIndex + ':newArrivals:' + day + ':newArrival:hours"]', plannerForm),
        minutes: $('select[name="segmentsContainer:segments:' + segmentIndex + ':newArrivals:' + day + ':newArrival:minutes"]', plannerForm),
    };
}

function afp_getFixedArrivalCheckbox(plannerForm: JQuery, segmentIndex: number, day: number) {
    return $('input[name="segmentsContainer:segments:' + segmentIndex + ':fixedArrivalSelection:' + day + ':fixedArrival"]', plannerForm);
}

function afp_getArrivalValueSnapshot(segmentIndex: number, day: number) {
    let plannerForm = afp_getPlannerForm();
    let arrivalSelects = afp_getArrivalSelects(plannerForm, segmentIndex, day);
    return {
        hours: String(arrivalSelects.hours.val() || ''),
        minutes: String(arrivalSelects.minutes.val() || ''),
    };
}

function afp_waitForPlannerMutation(timeoutMs = 1500) {
    timeoutMs = timeoutMs || 1500;
    return new Promise<boolean>(function(resolve) {
        let plannerForm = afp_getPlannerForm();
        if (!plannerForm.length || !plannerForm[0] || typeof MutationObserver === 'undefined') {
            window.setTimeout(function() {
                resolve(false);
            }, Math.min(timeoutMs, 250));
            return;
        }

        let settled = false;
        let observer = new MutationObserver(function() {
            if (settled) {
                return;
            }
            settled = true;
            window.clearTimeout(timer);
            observer.disconnect();
            resolve(true);
        });
        let timer = window.setTimeout(function() {
            if (settled) {
                return;
            }
            settled = true;
            observer.disconnect();
            resolve(false);
        }, timeoutMs);

        observer.observe(plannerForm[0], {
            attributes: true,
            childList: true,
            subtree: true,
        });
    });
}

async function afp_waitForArrivalSelectValue(segmentIndex: number, day: number, part: 'hours' | 'minutes', value: string) {
    let normalizedValue = String(value || '');
    return afp_waitFor(function() {
        let plannerForm = afp_getPlannerForm();
        let arrivalSelects = afp_getArrivalSelects(plannerForm, segmentIndex, day);
        let select = part === 'hours' ? arrivalSelects.hours : arrivalSelects.minutes;
        if (!select.length) {
            return false;
        }
        let optionValues = $('option', select).map(function() {
            return String($(this).val());
        }).get();
        if (optionValues.indexOf(normalizedValue) === -1 && /^\d+$/.test(normalizedValue)) {
            normalizedValue = String(parseInt(normalizedValue, 10));
        }
        return String(select.val() || '') === normalizedValue;
    }, 1200, 80);
}

async function afp_setPlannerArrivalSelect(segmentIndex: number, day: number, part: 'hours' | 'minutes', value: string) {
    if (value == null || value === '') {
        return;
    }
    let plannerForm = afp_getPlannerForm();
    let arrivalSelects = afp_getArrivalSelects(plannerForm, segmentIndex, day);
    let select = part === 'hours' ? arrivalSelects.hours : arrivalSelects.minutes;
    if (!select.length) throw new Error('Required arrival time control is missing.');
    let changed = afp_setSelectValue(select, value);
    if (!changed) throw new Error('Template arrival time is not available on this aircraft.');
    await afp_waitForPlannerMutation(1500);
    let applied = await afp_waitForArrivalSelectValue(segmentIndex, day, part, value);
    if (!applied) {
        let retryPlannerForm = afp_getPlannerForm();
        let retrySelects = afp_getArrivalSelects(retryPlannerForm, segmentIndex, day);
        let retrySelect = part === 'hours' ? retrySelects.hours : retrySelects.minutes;
        if (!retrySelect.length || !afp_setSelectValue(retrySelect, value) ||
            !await afp_waitForArrivalSelectValue(segmentIndex, day, part, value)) {
            throw new Error('Template arrival time could not be applied.');
        }
    }
}

async function afp_syncPlannerArrivalTime(plannerForm: JQuery, segmentIndex: number, day: number, daySettings: AESModel.PlannerArrival) {
    let arrivalSelects = afp_getArrivalSelects(plannerForm, segmentIndex, day);
    if (!arrivalSelects.hours.length || !arrivalSelects.minutes.length) {
        throw new Error('Required arrival time controls are missing.');
    }

    let targetHours = String(daySettings.arrivalHours || '');
    let targetMinutes = String(daySettings.arrivalMinutes || '');
    if (!targetHours || !targetMinutes) throw new Error('Template arrival time is missing.');

    let currentArrival = afp_getArrivalValueSnapshot(segmentIndex, day);
    if (currentArrival.hours === targetHours && currentArrival.minutes === targetMinutes) {
        return;
    }

    let arrivalChanged = false;
    if (currentArrival.hours !== targetHours) {
        await afp_setPlannerArrivalSelect(segmentIndex, day, 'hours', daySettings.arrivalHours);
        arrivalChanged = true;
    }
    currentArrival = afp_getArrivalValueSnapshot(segmentIndex, day);
    if (currentArrival.minutes !== targetMinutes) {
        await afp_setPlannerArrivalSelect(segmentIndex, day, 'minutes', daySettings.arrivalMinutes);
        arrivalChanged = true;
    }

    if (!arrivalChanged) {
        return;
    }
}

function afp_getPlannerSourceDaySettings(entry: AESModel.FlightPlanEntry) {
    return afp_collectSegmentIndexes().map(function(segmentIndex) {
        let days: Record<number, AESModel.PlannerArrival> = {};
        entry.selectedDays.forEach(function(sourceDay) {
            let daySetting: AESModel.FlightPlanDay = entry.daySettings?.[sourceDay] || {};
            let segmentSetting = daySetting.segments && daySetting.segments[segmentIndex] ? daySetting.segments[segmentIndex] : {};
            let arrival: AESModel.FlightPlanTime = segmentSetting.arrival || daySetting.arrival || {};
            days[sourceDay] = {
                arrivalDayOffset: parseInt(String(arrival.dayOffset || 0), 10) || 0,
                arrivalHours: String(arrival.hours || ''),
                arrivalMinutes: String(arrival.minutes || ''),
            };
        });

        return {
            days: days,
            index: segmentIndex,
        };
    });
}

async function afp_applyFlightEntryToPlanner(entry: AESModel.FlightPlanEntry, offsetDays: number) {
    let selected = afp_getSelectedExistingFlight();
    if (!afp_selectionMatchesEntry(selected, entry)) {
        throw new Error('Planner is not loaded for the expected flight number.');
    }

    let sourceSegmentSettings = afp_getPlannerSourceDaySettings(entry);
    if (!sourceSegmentSettings.length) {
        throw new Error('Could not find planner segments for ' + (entry.flightCode || entry.flightNumberLabel) + '.');
    }

    let targetDays: AESModel.PlannerTargetDays = {};
    entry.selectedDays.forEach(function(sourceDay) {
        let dayData = { sourceDay: sourceDay, targetDay: (sourceDay + offsetDays) % 7 };
        targetDays[dayData.targetDay] = dayData;
    });

    await afp_clearPlannerDaySelection();
    await afp_setPlannerDaySelection(targetDays);
    let plannerReady = await afp_waitFor(function() {
        return afp_getPlannerForm().length > 0;
    }, 3000, 80);
    if (!plannerReady) {
        throw new Error('Planner form did not become ready after selecting target days.');
    }

    for (let segment of sourceSegmentSettings) {
        for (let sourceDay of entry.selectedDays) {
            let targetDay = (sourceDay + offsetDays) % 7;
            let daySettings = segment.days[sourceDay];
            await afp_syncPlannerArrivalTime(afp_getPlannerForm(), segment.index, targetDay, daySettings);
        }
    }
}

function afp_validatePlanner(entry: AESModel.FlightPlanEntry, offsetDays: number) {
    if (!afp_selectionMatchesEntry(afp_getSelectedExistingFlight(), entry)) throw new Error('Flight selection changed.');
    const days = entry.selectedDays.map(day => (day + offsetDays) % 7);
    for (let day = 0; day < 7; day++) {
        const checkbox = afp_getPlannerDayCheckbox(day);
        if (!checkbox.length || !!checkbox.prop('checked') !== days.includes(day)) throw new Error('Planner days do not match the template.');
    }
    const segments = afp_getPlannerSourceDaySettings(entry);
    if (!segments.length) throw new Error('Planner segments are missing.');
    for (const segment of segments) for (const day of entry.selectedDays) {
        const expected = segment.days[day];
        const actual = afp_getArrivalValueSnapshot(segment.index, (day + offsetDays) % 7);
        if (!expected.arrivalHours || !expected.arrivalMinutes || !actual.hours || !actual.minutes ||
            Number(actual.hours) !== Number(expected.arrivalHours) || Number(actual.minutes) !== Number(expected.arrivalMinutes)) {
            throw new Error('Planner arrival time does not match the template.');
        }
    }
}

function afp_entryAppearsInVisualPlan(entry: AESModel.FlightPlanEntry, offsetDays: number) {
    let visualPlan = afp_getVisualPlan();
    if (!visualPlan.length) {
        return false;
    }

    const actual = afp_getUniqueFlightEntries().find(candidate =>
        entry.flightNumberValue ? candidate.flightNumberValue === entry.flightNumberValue : candidate.flightCode === entry.flightCode);
    if (!actual) return false;
    const targetDays = entry.selectedDays.map(day => (day + offsetDays) % 7);
    if (actual.selectedDays.length !== targetDays.length) return false;
    return entry.selectedDays.every(sourceDay => {
        const targetDay = (sourceDay + offsetDays) % 7;
        const observed = actual.daySettings[targetDay];
        const expected = entry.daySettings?.[sourceDay];
        if (!observed || !expected) return false;
        const segments = expected.segments || {0:{arrival:expected.arrival}};
        return Object.entries(segments).every(([index, segment]) => {
            const arrival = segment.arrival;
            const found = observed.segments[Number(index)]?.arrival;
            return !!arrival?.hours && !!arrival.minutes && !!found?.hours && !!found.minutes &&
                Number(arrival.hours) === Number(found.hours) && Number(arrival.minutes) === Number(found.minutes);
        });
    });
}

function afp_submitPlanner() {
    afp_assertJobAction();
    let submitBtn = $('input[type="submit"][name="button-submit"]').first();
    if (!submitBtn.length) {
        throw new Error('Apply schedule settings button is not available.');
    }
    submitBtn[0].click();
}

async function afp_saveJob() {
    afp_assertJobAction();
    if (!aircraftFlightPlanState.job) {
        return;
    }
    await afp_jobMessage('save', aircraftFlightPlanState.job);
}

async function afp_completeJob() {
    await afp_clearJob(false);
    afp_notify('Flight plan scheduling completed.', 'success');
    afp_setRuntimeMessage('Flight plan scheduling completed.', 'success');
    afp_renderPanel();
}

async function afp_failJob(message: string) {
    afp_assertJobAction();
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
        afp_assertJobAction();
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
                job.status = 'applying';
                await afp_saveJob();
                afp_renderPanel();
                continue;
            }

            job.status = 'waitForSelection';
            await afp_saveJob();
            afp_renderPanel();
            afp_setRuntimeMessage('Loading ' + entry.flightCode + '...', 'warning');
            afp_selectExistingFlight(entry);
            return;
        }

        if (job.status === 'applying') {
            afp_setRuntimeMessage('Applying ' + entry.flightCode + '...', 'warning');
            await afp_applyFlightEntryToPlanner(entry, job.offsetDays);
            afp_assertJobAction();
            job.status = 'waitForApply';
            await afp_saveJob();
            afp_renderPanel();
            afp_validatePlanner(entry, job.offsetDays);
            afp_submitPlanner();
            return;
        }

        if (job.status === 'waitForApply') {
            if (!afp_entryAppearsInVisualPlan(entry, job.offsetDays)) {
                await afp_failJob('Could not confirm scheduled days for ' + entry.flightCode + '.');
                return;
            }

            job.currentIndex++;
            job.status = 'selecting';
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
    if (!AES.isPageOwner() || !job || aircraftFlightPlanState.processingJob) {
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
    activeRun = { job, cancelled: false };
    try {
        await afp_processJob();
    } catch (error) {
        if (!(error instanceof FlightPlanCancelled)) {
            try {
                await afp_failJob(error instanceof Error ? error.message : 'Scheduling failed.');
            } catch (saveError) {
                if (!(saveError instanceof FlightPlanCancelled)) {
                    afp_setRuntimeMessage('Scheduling stopped: could not save job status. Please reload before retrying.', 'error');
                    AES.reportContentScriptError('content_aircraftFlightPlan', saveError);
                }
            }
        }
    } finally {
        activeRun = null;
        aircraftFlightPlanState.processingJob = false;
        afp_renderPanel();
    }
}

})();
