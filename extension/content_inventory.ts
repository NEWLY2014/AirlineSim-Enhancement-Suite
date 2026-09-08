"use strict";
(() => {
const cabins: AESModel.Cabin[] = ['Y', 'C', 'F', 'Cargo'];
//MAIN
//Global vars
let settings: AESModel.InventorySettings, pricingData: AESModel.InventoryRecord, todayDate: number;
let analysis: AESModel.InventoryAnalysis, server: string, airline: AESModel.Airline;
let aesmodule: Pick<Validation, 'valid' | 'errors'> = { valid: true, errors: [] };
let inventoryObserver: MutationObserver | null = null;
var inventoryRefreshTimer = 0;
var inventoryRenderSignature = "";
let inventoryRevision = 0;
let inventoryActionPending = false;
let authorizedPriceSubmit = false;
const watchedPriceForms = new WeakSet<HTMLFormElement>();
const inventoryNodeIds = new WeakMap<Node, number>();
let inventoryNextNodeId = 0;
const INVENTORY_SCRIPT_ENABLED = AES.runContentScript("content_inventory", function() {

    let inventoryStarted = false;
    const startInventory = function() {
        if (inventoryStarted) {
            return;
        }
        inventoryStarted = true;
        AES.tryRun("content_inventory", async function() {
            server = AES.getServerName();
            const currentAirline = AES.getCurrentAirline();
            airline = currentAirline?.id ? currentAirline : AES.getAirline();
            settings = await getSettings()
            watchInventoryLayout()
            await rerenderInventoryModule(true)
        })
    };

    if (document.readyState === "complete") {
        startInventory();
    } else {
        window.addEventListener("load", startInventory, { once: true })
    }
}, { ready: false });

if (INVENTORY_SCRIPT_ENABLED) {
    AES.whenPageOwnershipLost(function() {
        inventoryRevision++;
        if (inventoryObserver) {
            inventoryObserver.disconnect()
            inventoryObserver = null
        }
        clearTimeout(inventoryRefreshTimer)
        cleanupInventoryDisplay()
    })
}

async function rerenderInventoryModule(force: boolean) {
    if (!AES.isPageOwner() || inventoryActionPending) return;
    if (!isInventoryPageReady()) {
        cleanupInventoryDisplay()
        inventoryRenderSignature = ""
        return
    }

    watchNativePriceSubmission();
    const nextSignature = getInventorySignature()
    if (!force && nextSignature === inventoryRenderSignature) {
        return
    }

    inventoryRenderSignature = nextSignature
    const revision = ++inventoryRevision;
    cleanupInventoryDisplay()
    const nextSettings = await getSettings();
    if (!isInventoryCurrent(revision)) return;
    settings = nextSettings;
    aesmodule = new Validation()

    if (!aesmodule.valid) {
        displayValidationError()
        AES.markOwnedElements($("#aes-h3-validation, #aes-panel-validation"))
        return
    }
    try {
        await displayInventory(revision)
        AES.markOwnedElements($("#aes-h3-analysis, #aes-div-analysis, #aes-h3-history, #aes-div-invPricing-historicalData"))
    } catch (error) {
        if (error && /Unable to read inventory data/.test(String(error instanceof Error ? error.message : error))) {
            return
        }
        throw error
    }
}

function watchInventoryLayout() {
    if (!AES.isPageOwner() || inventoryObserver) {
        return
    }

    const target = document.querySelector(".container-fluid .row .col-md-10") || document.body
    inventoryObserver = new MutationObserver(function() {
        clearTimeout(inventoryRefreshTimer)
        inventoryRefreshTimer = window.setTimeout(function() {
            AES.tryRun("content_inventory", function() {
                return rerenderInventoryModule(false)
            })
        }, 150)
    })
    inventoryObserver.observe(target, { childList: true, subtree: true })
}

function getInventorySignature() {
    return ['h2', '#inventory-table', '#inventory-grouped-table', '.pricing table', '.pricing input'].map(selector =>
        Array.from(document.querySelectorAll(selector)).map(el => {
            if (!inventoryNodeIds.has(el)) inventoryNodeIds.set(el, ++inventoryNextNodeId);
            return inventoryNodeIds.get(el) + ':' + el.textContent;
        }).join('|')).join('::');
}

function isInventoryCurrent(revision: number) {
    return AES.isPageOwner() && inventoryRevision === revision && isInventoryPageReady() && getInventorySignature() === inventoryRenderSignature;
}

function isInventoryPageReady() {
    const hasInventoryTable = document.querySelector("#inventory-table tbody tr") ||
        document.querySelector("#inventory-grouped-table tbody")
    const hasPricingPanel = document.querySelector(".pricing table tbody tr")
    const hasErrorPage = document.querySelector(".exception, .stacktrace, .error-page")

    return Boolean(hasInventoryTable && hasPricingPanel && !hasErrorPage)
}

function cleanupInventoryDisplay() {
    $("#aes-h3-analysis, #aes-div-analysis, #aes-h3-history, #aes-div-invPricing-historicalData, #aes-h3-validation, #aes-panel-validation").remove();
}

/**
 * Get settings from local storage
 * @returns {object} data.settings
 */
async function getSettings() {
    const data = await chrome.storage.local.get(['settings'])
    return readInventorySettings(data.settings)
}

async function displayInventory(revision: number) {
    todayDate = parseInt(AES.getServerDate().date, 10);
    //Get flights
    let flights = getFlights();
    let prices = getPriceDetails();
    let storageKey = getPricingInventoryKey();

    //Check if any snapshots saved
    let defaultPricingData = {
        server: storageKey.server,
        airline: storageKey.airline,
        type: storageKey.type,
        origin: storageKey.origin,
        destination: storageKey.destination,
        key: storageKey.key,
        date: {}
    }
    const storageData = await chrome.storage.local.get({[storageKey.key]: defaultPricingData})
    if (!isInventoryCurrent(revision)) return;
    const raw: unknown = storageData[storageKey.key];
    pricingData = { ...storageKey, ...(AES.isRecord(raw) ? raw : {}), key: storageKey.key,
        date: AES.isRecord(raw) && AES.isRecord(raw.date) ? raw.date : {} }
    await confirmPendingPricingUpdate(prices, revision)
    if (!isInventoryCurrent(revision)) return;

    //Do Analysis
    analysis = getAnalysis(flights, prices, pricingData.date);
    //Display analysis
    displayAnalysis(analysis, prices);
    //Display history
    displayHistory(analysis);


    //Automation
    //Check if valid analysis exists
    if (analysis.hasValue('valid') || analysis.hasValue('newPrice')) {
        //CHeck if updated todayDate
        if (pricingData.date[todayDate]) {
            //Today update exists
            //Check if pricing updated today
            if (getSnapshot(todayDate).pricingUpdated) {
                //Pricing updated today
                //Do nothing
            } else {
                //Pricing not updated today
                if (hasPendingUpdate(todayDate)) {
                    return;
                }
                //Check if new price available
                if (analysis.hasValue('newPrice')) {
                    //Update price
                    if (settings.invPricing.autoPriceUpdate) {
                        $('#aes-btn-invPricing-apply-new-prices').click();
                    }
                }
            }
        } else {
            //Today update does not exists
            //Check if new price available
            if (analysis.hasValue('newPrice')) {
                //Update price
                if (settings.invPricing.autoPriceUpdate) {
                    $('#aes-btn-invPricing-apply-new-prices').click();
                } else if (settings.invPricing.autoAnalysisSave) {
                    $('#aes-btn-invPricing-save-snapshot').click();
                }
            } else {
                //Update data
                if (settings.invPricing.autoAnalysisSave) {
                    $('#aes-btn-invPricing-save-snapshot').click();
                }
            }
        }
    }
}

async function confirmPendingPricingUpdate(prices: AESModel.InventoryPrices, revision: number) {
    const dates = Object.keys(pricingData.date).sort((a,b) => Number(b)-Number(a));
    const pendingDate = dates.find(date => getSnapshot(date).pricingUpdatePending);
    if (!pendingDate) return;
    const pending = getSnapshot(pendingDate).pricingUpdatePending;
    if (!pending || !cabins.every(cmp => pending.targetPrices[cmp] === undefined || prices[cmp].currentPrice === pending.targetPrices[cmp])) return;
    const raw = pricingData.date[pendingDate];
    if (!AES.isRecord(raw) || !isInventoryCurrent(revision)) return;
    const confirmed: Record<string, unknown> = {...raw, pricingUpdated: 1};
    delete confirmed.pricingUpdatePending;
    const next = {...pricingData, date: {...pricingData.date, [pendingDate]: confirmed}};
    try {
        await chrome.storage.local.set({[next.key]: next});
        if (isInventoryCurrent(revision)) pricingData = next;
    } catch (error) {
        console.error('[AES] Unable to confirm the saved pricing update.', error);
    }
}

/**
 * Get Flights
 * @returns {array} flights - array of flight objects
 */
function getFlights() {
    const groupedTableBodies = document.querySelectorAll<HTMLTableSectionElement>("#inventory-grouped-table tbody")
    if (groupedTableBodies.length) {
        return getGroupedFlights(groupedTableBodies)
    }

    const flights: AESModel.InventoryFlight[] = []
    const flightRows = document.querySelectorAll<HTMLTableRowElement>("#inventory-table tbody tr")

    if (!flightRows.length) {
        throw new Error("Unable to read inventory data. The inventory page layout might have changed.")
    }

    for (const row of flightRows) {
        const flight = getFlight(row)
        flights.push(flight)
    }

    if (!flights.length || flights.some(flight => !flight.fltNr || ![flight.cap, flight.bkd, flight.price].every(Number.isFinite) || flight.cap < 0 || flight.bkd < 0)) throw new Error('Unable to read inventory data: incomplete flight rows');
    return flights
}

/**
 * Get flights from grouped inventory mode
 * @param {NodeListOf<HTMLTableSectionElement>} groupedTableBodies
 * @returns {array} flights
 */
function getGroupedFlights(groupedTableBodies: NodeListOf<HTMLTableSectionElement>) {
    const flights: AESModel.InventoryFlight[] = []

    for (const tbody of groupedTableBodies) {
        const rows = tbody.querySelectorAll("tr")
        if (!rows.length) {
            continue
        }

        const sharedCells = rows[0].querySelectorAll("td")
        if (sharedCells.length < 11) {
            continue
        }

        const flightNumber = sharedCells[1].querySelector<HTMLElement>("a[href*=numbers]")?.innerText || ''
        const date = sharedCells[2].innerText
        const status = sharedCells[10].innerText.replace(/\s+/g, "")

        for (const row of rows) {
            const cells = row.querySelectorAll("td")
            if (cells.length < 5) {
                continue
            }

            const groupedCells = row === rows[0] ? {
                compCell: cells[5],
                capCell: cells[6],
                bkdCell: cells[7],
                priceCell: cells[9]
            } : {
                compCell: cells[0],
                capCell: cells[1],
                bkdCell: cells[2],
                priceCell: cells[4]
            }

            flights.push({
                fltNr: flightNumber,
                date: date,
                cmp: getCompCode(groupedCells.compCell.innerText),
                cap: AES.cleanInteger(groupedCells.capCell.innerText),
                bkd: AES.cleanInteger(groupedCells.bkdCell.innerText),
                price: AES.cleanInteger(groupedCells.priceCell.innerText),
                status: status
            })
        }
    }

    if (!flights.length || flights.some(flight => !flight.fltNr || ![flight.cap, flight.bkd, flight.price].every(Number.isFinite) || flight.cap < 0 || flight.bkd < 0)) throw new Error('Unable to read inventory data: incomplete flight rows');
    return flights
}

/**
 * Get flight information and return as an object
 * @param {HTMLElement} row - the <tr> with flight information
 * @returns {object} flight - object with the parsed flight information
 */
function getFlight(row: HTMLTableRowElement) {
    const cells = row.querySelectorAll("td")
    if (cells.length < 11) throw new Error("Unable to read inventory data: incomplete flight row");
    const flightNumber = cells[1].querySelector<HTMLElement>("a[href*=numbers]")?.innerText || ''
    const date = cells[2].innerText
    const compCode = getCompCode(cells[5].innerText)
    const capacity = cells[6].innerText
    const booked = cells[7].innerText
    const price = cells[9].innerText
    const status = cells[10].innerText.replace(/\s+/g, "")

    const flight = {
        fltNr: flightNumber,
        date: date,
        cmp: compCode,
        cap: AES.cleanInteger(capacity),
        bkd: AES.cleanInteger(booked),
        price: AES.cleanInteger(price),
        status: status
    }

    return flight
}

/**
 * Checks if the string is longer than one character and returns a string of "Cargo"
 * @param {string} text - localised word for "Cargo"
 * @returns {string} text - either passthrough of the input or "Cargo"
 */
function getCompCode(text: string): AESModel.Cabin {
    if (!text) {
        throw new Error("no value provided for getCompCode")
    }

    if (text.length > 1) {
        return "Cargo"
    }

    if (text === 'Y' || text === 'C' || text === 'F') return text;
    throw new Error('Unable to read inventory data: unknown service class');
}

/**
 * Get Prices
 * @returns {object} prices
 */
function getPriceDetails() {
    const pricingRows = document.querySelectorAll(".pricing table tbody tr")
    const prices: Partial<AESModel.InventoryPrices> = {}

    for (const row of pricingRows) {
        const cells = row.querySelectorAll("td")
        const cmp = getCompCode(cells[0].innerText)
        const price = getPrice(cells)

        prices[cmp] = price
    }

    if (!prices.Y || !prices.C || !prices.F || !prices.Cargo) throw new Error('Unable to read inventory data: missing price rows');
    return { Y: prices.Y, C: prices.C, F: prices.F, Cargo: prices.Cargo };
}

/**
 * Get price
 * @param {array} cells
 * @returns {object} price
 */
function getPrice(cells: NodeListOf<HTMLTableCellElement>) {
    if (cells.length < 5) throw new Error("Unable to read inventory data: incomplete pricing row");
    const currentPrice = AES.cleanInteger(cells[1].innerText)
    const defaultPrice = AES.cleanInteger(cells[4].innerText.replace(/\s+/g, ''))
    const currentPricePoint = getCurrentPricePoint(currentPrice, defaultPrice)
    const newPriceInput = cells[2].querySelector("input")

    if (!newPriceInput || !Number.isFinite(currentPrice) || !Number.isFinite(defaultPrice) || defaultPrice <= 0) throw new Error('Unable to read inventory data: invalid price row');
    const price = {
        currentPrice: currentPrice,
        defaultPrice: defaultPrice,
        currentPricePoint: currentPricePoint,
        newPriceInput: newPriceInput
    }

    return price
}

/**
 * @param {string} currentPrice
 * @param {string} defaultPrice
 * @returns {integer}
 */
function getCurrentPricePoint(currentPrice: number, defaultPrice: number) {
    return Math.round((currentPrice / defaultPrice) * 100)
}

//Get Analysis
function getAnalysis(flights: AESModel.InventoryFlight[], prices: AESModel.InventoryPrices, storedData: Record<string, unknown>) {
    //Setup object
    let mostRecentDate
    let mostRecentData: AESModel.InventorySnapshot | undefined
    const data = { Y: emptyInventoryItem(), C: emptyInventoryItem(), F: emptyInventoryItem(), Cargo: emptyInventoryItem() };
    let analysis: AESModel.InventoryAnalysis = {
        data: data,
        getLoad: function(cmp) {
            if (this.data[cmp].valid) {
                return this.data[cmp].totalCap ? this.data[cmp].totalBkd / this.data[cmp].totalCap : 0;
            } else {
                return 0;
            }
        },
        note: function(cmp) {
            if (this.data[cmp].valid) {
                if (this.data[cmp].useCurrentPrice) {
                    return "Current price";
                } else if (this.data[cmp].analysisSourcePrice) {
                    return "Ref: active " + formatCurrency(this.data[cmp].analysisSourcePrice) + " AS$";
                } else {
                    return "Ref: old price";
                }
            } else {
                return "No data";
            }
        },
        displayLoad: function(cmp) {
            if (this.data[cmp].valid) {
                return this.data[cmp].totalBkd + " / " + this.data[cmp].totalCap + " (" + displayPerc(Math.round(this.getLoad(cmp) * 100), 'load') + ")";
            } else {
                return '-';
            }
        },
        displayRec: function(cmp) {
            if (this.data[cmp].recommendation) {
                let span = $('<span></span>').text(this.data[cmp].recommendation);
                switch (this.data[cmp].recType) {
                    case 'good':
                        span.addClass('good');
                        break;
                    case 'bad':
                        span.addClass('bad');
                        break;
                    case 'neutral':
                        span.addClass('warning');
                        break;
                    default:
                        return '<span class="warning">ERROR:2501 Wrong recType set:' + this.data[cmp].recType + '</span>';
                }
                if (this.data[cmp].newPrice) {
                    span.append(
                        $('<span></span>').html(' \u2192 ' + formatCurrency(this.data[cmp].newPrice) + ' AS$ (' + displayPerc(this.data[cmp].newPricePoint, 'price') + ')')
                    );
                }
                return span;
            } else {
                return '-'
            }
        },
        displayReferenceRec: function(cmp) {
            if (!this.data[cmp].referenceRecommendation) {
                return '-';
            }

            let span = $('<span></span>').text(this.data[cmp].referenceRecommendation);
            switch (this.data[cmp].referenceRecType) {
                case 'good':
                    span.addClass('good');
                    break;
                case 'bad':
                    span.addClass('bad');
                    break;
                default:
                    span.addClass('warning');
            }

            if (this.data[cmp].referenceNewPrice) {
                span.append(
                    $('<span></span>').html(' \u2192 ' + formatCurrency(this.data[cmp].referenceNewPrice) + ' AS$ (' + displayPerc(this.data[cmp].referenceNewPricePoint, 'price') + ')')
                );
            }

            return span;
        },
        displayPrice: function(cmp, type) {
            switch (type) {
                case 'current':
                    return formatCurrency(this.data[cmp].currentPrice) + ' AS$ (' + displayPerc(this.data[cmp].currentPricePoint, 'price') + ')';
                case 'new':
                    if (this.data[cmp].newPrice) {
                        return formatCurrency(this.data[cmp].newPrice) + ' AS$ (' + displayPerc(this.data[cmp].newPricePoint, 'price') + ')';
                    } else {
                        return '-';
                    }
                case 'analysis':
                    if (this.data[cmp].valid) {
                        return formatCurrency(this.data[cmp].analysisPrice) + ' AS$ (' + displayPerc(this.data[cmp].analysisPricePoint, 'price') + ')';
                    } else {
                        return '-';
                    }
                default:
                    return '<span class="warning">ERROR:2502 Wrong type set:' + type + '</span>';
            }
        },
        displayIndex: function(cmp) {
            if (this.data[cmp].valid) {
                let span = $('<span></span>');
                if (this.data[cmp].index >= 90) {
                    return span.addClass('good').text(this.data[cmp].index);
                }
                if (this.data[cmp].index <= 50) {
                    return span.addClass('bad').text(this.data[cmp].index);
                }
                return span.addClass('warning').text(this.data[cmp].index);

            } else {
                return '-';
            }
        },
        displayTotalLoad: function(type) {
            let cmp: AESModel.Cabin[] = [];
            switch (type) {
                case 'all':
                    cmp = ['Y', 'C', 'F', 'Cargo'];
                    break;
                case 'pax':
                    cmp = ['Y', 'C', 'F'];
                    break;
                default:
                    // code block
            }
            let load = 0, cap = 0, bkd = 0;
            for (let i = 0; i < cmp.length; i++) {
                if (this.data[cmp[i]].valid) {
                    cap += this.data[cmp[i]].totalCap;
                    bkd += this.data[cmp[i]].totalBkd;
                }
            }

            if (cap) {
                load = Math.round(bkd / cap * 100);
                return bkd + ' / ' + cap + ' (' + displayPerc(load, 'load') + ')';
            } else {
                return '-';
            }
        },
        displayTotalIndex: function(type) {
            let cmp: AESModel.Cabin[] = [];
            switch (type) {
                case 'all':
                    cmp = ['Y', 'C', 'F', 'Cargo'];
                    break;
                case 'pax':
                    cmp = ['Y', 'C', 'F'];
                    break;
                default:
                    // code block
            }
            let count = 0, totalIndex = 0;
            for (let i = 0; i < cmp.length; i++) {
                if (this.data[cmp[i]].valid) {
                    count++;
                    totalIndex += this.data[cmp[i]].index;
                }
            }
            if (count) {
                totalIndex = Math.round(totalIndex / count);
                let span = $('<span></span>');
                if (totalIndex >= 90) {
                    return span.addClass('good').text(totalIndex);
                }
                if (totalIndex <= 50) {
                    return span.addClass('bad').text(totalIndex);
                }
                return span.addClass('warning').text(totalIndex);
            } else {
                return '-';
            }
        },
        hasValue: function(value) {
            for (const cmp of cabins) {
                if (this.data[cmp][value]) {
                    return 1;
                }
            }
            return 0;
        }
    };

    //Filter flights
    flights = flights.filter(function(flight) {
        return flight.status == 'finished' || flight.status == 'inflight';
    });

    //Check historical data
    if (storedData) {
        //Shouldbe function inside storage object
        let dates = []
        for (let date in storedData) {
            if (/^\d{8}$/.test(date) && readInventorySnapshot(storedData[date])) {
                dates.push(date)
            }
        }
        dates.reverse();
        mostRecentDate = dates[0]
        mostRecentData = readInventorySnapshot(storedData[mostRecentDate]) || undefined
    }

    //extract each cmp analysis
    for (const cmp of cabins) {
        analysis.data[cmp] = {
            ...emptyInventoryItem(),
            totalCap: 0,
            totalBkd: 0,
            valid: 0,
            analysisPrice: 0,
            analysisPricePoint: 0,
            useCurrentPrice: 0,
            canRecommend: 0,
            analysisSourcePrice: 0,
            currentPrice: prices[cmp].currentPrice,
            currentPricePoint: prices[cmp].currentPricePoint,
            referenceRecommendation: 0,
            referenceRecType: 'neutral',
            referenceNewPrice: 0,
            referenceNewPricePoint: 0
        };
        let price = prices[cmp].currentPrice;
        //Only cmp flights
        let cmpFlights = flights.filter(function(flight) {
            return flight.cmp == cmp;
        });
        //if no cmp flights
        if (cmpFlights.length) {
            //Check if current price flights available
            let flightsArray = cmpFlights.filter(function(flight) {
                return (flight.price == price);
            });
            if (flightsArray.length) {
                analysis.data[cmp].useCurrentPrice = 1;
                analysis.data[cmp].canRecommend = 1;
                analysis.data[cmp].analysisPrice = price;
                analysis.data[cmp].analysisPricePoint = Math.round(price / prices[cmp].defaultPrice * 100);
                analysis.data[cmp].valid = true;
            } else {
                const activePrice = getMostCommonFlightPrice(cmpFlights);
                if (activePrice > 0) {
                    flightsArray = cmpFlights.filter(function(flight) {
                        return flight.price == activePrice;
                    });
                    if (flightsArray.length) {
                        analysis.data[cmp].useCurrentPrice = 0;
                        analysis.data[cmp].canRecommend = 0;
                        analysis.data[cmp].analysisPrice = activePrice;
                        analysis.data[cmp].analysisPricePoint = Math.round(activePrice / prices[cmp].defaultPrice * 100);
                        analysis.data[cmp].analysisSourcePrice = activePrice;
                        analysis.data[cmp].valid = true;
                    }
                }
            }
            if (!analysis.data[cmp].valid && mostRecentData) {
                const previousCmpData = mostRecentData.data && mostRecentData.data[cmp];
                const hasUsablePreviousAnalysis = previousCmpData &&
                    previousCmpData.valid &&
                    Number.isFinite(previousCmpData.analysisPrice) &&
                    previousCmpData.analysisPrice > 0;
                // flightsArray = cmpFlights.filter(function(flight) {
                //     return flight.price == mostRecentData.data[cmp].analysisPrice;
                // });
                flightsArray = cmpFlights
                if (flightsArray.length && hasUsablePreviousAnalysis) {
                    analysis.data[cmp].useCurrentPrice = 0;
                    analysis.data[cmp].canRecommend = 0;
                    analysis.data[cmp].analysisPrice = previousCmpData.analysisPrice;
                    analysis.data[cmp].analysisPricePoint = Math.round(previousCmpData.analysisPrice / prices[cmp].defaultPrice * 100);
                    analysis.data[cmp].valid = true;
                }
            }
            if (analysis.data[cmp].valid) {
                flightsArray.forEach(function(flight) {
                    analysis.data[cmp].totalCap += flight.cap;
                    analysis.data[cmp].totalBkd += flight.bkd;
                });
            }
        }
    }

    //END extract each cmp analysis
    analysis = generateRecommendation(analysis, prices);
    analysis = generateReferenceRecommendation(analysis, prices);

    //Make route index
    analysis = generateRouteIndex(analysis);
    return analysis;
}

function generateRecommendation(analysis: AESModel.InventoryAnalysis, prices: AESModel.InventoryPrices) {
    for (const cmp of cabins) {
        const item = analysis.data[cmp];
        const config = settings.invPricing.recommendation[cmp];
        item.recommendation = 0;
        item.newPrice = 0;
        item.newPricePoint = 0;
        item.newPriceChange = 0;
        item.recType = 'neutral';
        item.referenceRecommendation = 0;
        item.referenceRecType = 'neutral';
        item.referenceNewPrice = 0;
        item.referenceNewPricePoint = 0;

        if (!item.valid || !item.canRecommend) {
            if (generateBoundaryRecommendation(item, config, prices[cmp])) {
                continue;
            }
            if (item.valid && item.analysisSourcePrice && !item.useCurrentPrice) {
                item.recType = 'neutral';
                item.recommendation = 'Wait for current price';
            } else if (item.valid && !item.useCurrentPrice) {
                item.recType = 'neutral';
                item.recommendation = 'Need current price results';
            }
            continue;
        }

        const load = Math.round(analysis.getLoad(cmp) * 100);

        // Find matching step
        let step = null;
        for (const s of config.steps) {
            if (load >= s.min && load <= s.max) {
                step = s;
                break;
            }
        }

        if (!step) {
            if (generateBoundaryRecommendation(item, config, prices[cmp])) {
                continue;
            }
            item.recType = 'neutral';
            item.recommendation = 'No matching step';
            continue;
        }

        const currentPricePoint = prices[cmp].currentPricePoint;
        const steppedPricePoint = currentPricePoint + step.step;
        const currentPriceOutsideBoundary = currentPricePoint < config.minPrice || currentPricePoint > config.maxPrice;
        const steppedPriceOutsideBoundary = steppedPricePoint < config.minPrice || steppedPricePoint > config.maxPrice;
        if (currentPriceOutsideBoundary && steppedPriceOutsideBoundary) {
            generateBoundaryRecommendation(item, config, prices[cmp]);
            continue;
        }
        const targetPricePoint = Math.min(
            config.maxPrice,
            Math.max(config.minPrice, steppedPricePoint)
        );

        // Set recommendation type
        if (step.step < 0) {
            item.recType = 'bad';
        } else if (step.step > 0) {
            item.recType = 'good';
        }

        // Boundary message when no actual movement is possible
        if (targetPricePoint === currentPricePoint && step.step !== 0) {
            if (targetPricePoint === config.minPrice) {
                item.recommendation = 'At lowest';
            } else if (targetPricePoint === config.maxPrice) {
                item.recommendation = 'At highest';
            }
        }

        // Normal assignment
        if (!item.recommendation) {
            item.recommendation = step.name;
            item.newPriceChange = targetPricePoint - currentPricePoint;

            if (targetPricePoint !== currentPricePoint || step.step !== 0) {
                item.newPricePoint = targetPricePoint;
                item.newPrice = Math.round(
                    (targetPricePoint / 100) * prices[cmp].defaultPrice
                );
            }
        }
    }

    return analysis;
}

function generateBoundaryRecommendation(item: AESModel.InventoryItem, config: AESModel.PricingRecommendation, price: AESModel.InventoryPrice) {
    const currentPricePoint = price.currentPricePoint;
    let targetPricePoint = 0;

    if (currentPricePoint < config.minPrice) {
        item.recType = 'good';
        item.recommendation = 'Raise to minimum';
        targetPricePoint = config.minPrice;
    } else if (currentPricePoint > config.maxPrice) {
        item.recType = 'bad';
        item.recommendation = 'Drop to maximum';
        targetPricePoint = config.maxPrice;
    } else {
        return false;
    }

    item.newPricePoint = targetPricePoint;
    item.newPriceChange = targetPricePoint - currentPricePoint;
    item.newPrice = Math.round(
        (targetPricePoint / 100) * price.defaultPrice
    );

    return true;
}

function generateReferenceRecommendation(analysis: AESModel.InventoryAnalysis, prices: AESModel.InventoryPrices) {
    for (const cmp of cabins) {
        const item = analysis.data[cmp];

        if (!item.valid || item.useCurrentPrice || item.newPrice) {
            continue;
        }

        const config = settings.invPricing.recommendation[cmp];
        const load = Math.round(analysis.getLoad(cmp) * 100);

        let step = null;
        for (const s of config.steps) {
            if (load >= s.min && load <= s.max) {
                step = s;
                break;
            }
        }

        if (!step) {
            item.referenceRecommendation = 'No matching step';
            item.referenceRecType = 'neutral';
            continue;
        }

        const targetPricePoint = Math.min(
            config.maxPrice,
            Math.max(config.minPrice, item.analysisPricePoint + step.step)
        );

        if (step.step < 0) {
            item.referenceRecType = 'bad';
        } else if (step.step > 0) {
            item.referenceRecType = 'good';
        } else {
            item.referenceRecType = 'neutral';
        }

        if (targetPricePoint === item.analysisPricePoint && step.step !== 0) {
            if (targetPricePoint === config.minPrice) {
                item.referenceRecommendation = 'At lowest';
            } else if (targetPricePoint === config.maxPrice) {
                item.referenceRecommendation = 'At highest';
            }
        }

        if (!item.referenceRecommendation) {
            item.referenceRecommendation = step.name;
            item.referenceNewPricePoint = targetPricePoint;
            item.referenceNewPrice = Math.round(
                (targetPricePoint / 100) * prices[cmp].defaultPrice
            );
        }
    }

    return analysis;
}

function getMostCommonFlightPrice(flights: AESModel.InventoryFlight[]) {
    const priceCounts: Record<number, number> = {};
    let selectedPrice = 0;
    let selectedCount = 0;

    flights.forEach(function(flight) {
        if (!Number.isFinite(flight.price) || flight.price <= 0) {
            return;
        }
        priceCounts[flight.price] = (priceCounts[flight.price] || 0) + 1;
        if (priceCounts[flight.price] > selectedCount) {
            selectedPrice = flight.price;
            selectedCount = priceCounts[flight.price];
        }
    });

    return selectedPrice;
}

function generateRouteIndex(analysis: AESModel.InventoryAnalysis) {
    //Each CMP index
    for (const cmp of cabins) {
        if (analysis.data[cmp].valid) {
            let index = (10 ** (analysis.data[cmp].analysisPricePoint / 100 - 1)) * (analysis.getLoad(cmp) * 100);
            analysis.data[cmp].index = Math.round(index);
        }
    }
    return analysis;
}

//Display analysis
function displayAnalysis(analysis: AESModel.InventoryAnalysis, prices: AESModel.InventoryPrices) {

    //Build table
    let mainDiv = $(".container-fluid .row .col-md-10 div .as-panel:eq(0)");
    mainDiv.after(
        `
    <h3 id="aes-h3-analysis">Analysis (today's snapshot)</h3>
    <div id="aes-div-analysis" >
      <div class="as-panel">
        <div class="as-table-well">
          <table id="aes-table-analysis" class="table table-bordered table-striped table-hover">
          </table>
        </div>
      </div>
    </div>
    `
    );

    //Table head
    let th = [];
    th.push('<th>SC</th>');
    th.push('<th>Note</th>');
    th.push('<th class="aes-text-right">Analysis Price</th>');
    th.push('<th class="aes-text-right">Load</th>');
    th.push('<th class="aes-text-right">Index</th>');
    th.push('<th class="aes-text-right">Current Price</th>');
    th.push('<th>Recommendation</th>');
    if (settings.invPricing.showReferenceRecommendation) {
        th.push('<th>Reference</th>');
    }
    let headRow = $('<tr></tr>').append(...th);
    let thead = $('<thead></thead>').append(headRow);

    //Table body
    let tbody = $('<tbody></tbody>');
    for (const cmp of cabins) {
        let td = [];
        td.push('<td>' + cmp + '</td>');
        td.push('<td>' + analysis.note(cmp) + '</td>');
        td.push('<td class="aes-text-right">' + analysis.displayPrice(cmp, 'analysis') + '</td>');
        td.push('<td class="aes-text-right">' + analysis.displayLoad(cmp) + '</td>');
        td.push($('<td class="aes-text-right"></td>').append(analysis.displayIndex(cmp)));
        td.push('<td class="aes-text-right">' + analysis.displayPrice(cmp, 'current') + '</td>');
        td.push($('<td></td>').append(analysis.displayRec(cmp)));
        if (settings.invPricing.showReferenceRecommendation) {
            td.push($('<td></td>').append(analysis.displayReferenceRec(cmp)));
        }
        let row = $('<tr></tr>').append(...td);
        tbody.append(row);
    }

    //Table footer
    let footRow = []
    footRow.push('<tr><td colspan="' + (settings.invPricing.showReferenceRecommendation ? 8 : 7) + '"></td></tr>');
    //Total PAX
    let tf = [];
    tf.push('<th>Total PAX</th>');
    tf.push('<td colspan="2"></td>');
    tf.push($('<td class="aes-text-right"></td>').html(analysis.displayTotalLoad('pax')));
    tf.push($('<td class="aes-text-right"></td>').append(analysis.displayTotalIndex('pax')));
    tf.push('<td colspan="' + (settings.invPricing.showReferenceRecommendation ? 3 : 2) + '"></td>');
    footRow.push($('<tr></tr>').append(...tf));
    //Total
    tf = [];
    tf.push('<th>Total PAX+Cargo</th>');
    tf.push('<td colspan="2"></td>');
    tf.push($('<td class="aes-text-right"></td>').html(analysis.displayTotalLoad('all')));
    tf.push($('<td class="aes-text-right"></td>').append(analysis.displayTotalIndex('all')));
    tf.push('<td colspan="' + (settings.invPricing.showReferenceRecommendation ? 3 : 2) + '"></td>');
    footRow.push($('<tr></tr>').append(...tf));
    let tfoot = $('<tfoot></tfoot>').append(...footRow);

    $("#aes-table-analysis").append(thead, tbody, tfoot);

    //Display pricing and data save buttons
    if (analysis.hasValue('valid') || analysis.hasValue('newPrice')) {
        let invPricingAnalysisBar = $('<ul class="as-action-bar as-panel"></ul>');
        let invPricingAnalysisBarSpan = $('<span class="warning"></span>');
        invPricingAnalysisBar.append($('<li></li>').append(invPricingAnalysisBarSpan));
        $("#aes-div-analysis").prepend(invPricingAnalysisBar);
        //create buttons
        //Save Data
        let saveInvPricingBtn = $('<button class="btn btn-default" id="aes-btn-invPricing-save-snapshot"></button>');
        const revision = inventoryRevision;
        $(saveInvPricingBtn).click(function() {
            runInventoryAction(async () => {
                const snapshot = makeInventorySnapshot(analysis);
                const previous = pricingData.date[todayDate];
                // Preserve even an unrecognized pending marker: a snapshot cannot confirm a submitted price.
                const savedSnapshot = AES.isRecord(previous) && previous.pricingUpdatePending ? {...snapshot, pricingUpdatePending: previous.pricingUpdatePending} : snapshot;
                const next = {...pricingData, date: {...pricingData.date, [todayDate]: savedSnapshot}};
                await chrome.storage.local.set({[next.key]: next});
                if (!isInventoryCurrent(revision)) return;
                pricingData = next;
                invPricingAnalysisBarSpan.removeClass().addClass('good').text('Data Saved!');
                if (settings.invPricing.autoClose) window.close();
            }, invPricingAnalysisBarSpan, revision);
        });

        //Update prices
        let applyNewPriceInvPricingBtn = $('<button class="btn btn-default" id="aes-btn-invPricing-apply-new-prices">apply new prices (and save data)</button>');
        $(applyNewPriceInvPricingBtn).click(function() {

            invPricingAnalysisBarSpan.text('Updating prices...');
            runInventoryAction(() => submitPendingPricingUpdate(getTargetPricingUpdates(prices, false), invPricingAnalysisBarSpan, revision), invPricingAnalysisBarSpan, revision);
        });
        let applyReferencePriceInvPricingBtn = $('<button class="btn btn-default" id="aes-btn-invPricing-apply-reference-prices">apply reference prices (and save data)</button>');
        $(applyReferencePriceInvPricingBtn).click(function() {

            invPricingAnalysisBarSpan.text('Updating prices...');
            for (const cmp of cabins) {
                if (!analysis.data[cmp].newPrice && analysis.data[cmp].referenceNewPrice) {
                    prices[cmp].newPriceInput.value = String(analysis.data[cmp].referenceNewPrice);
                }
            }
            runInventoryAction(() => submitPendingPricingUpdate(getTargetPricingUpdates(prices, true), invPricingAnalysisBarSpan, revision), invPricingAnalysisBarSpan, revision);
        });
        //Update new pricing input
        if (analysis.hasValue('newPrice')) {
            //Modify new price input
            for (const cmp of cabins) {
                if (analysis.data[cmp].newPrice) {
                    prices[cmp].newPriceInput.value = String(analysis.data[cmp].newPrice);
                }
            }
        }
        //For snapshot button
        if (pricingData.date[todayDate]) {
            //Today data does exist
            if (getSnapshot(todayDate).pricingUpdated) {
                //Today pricing updated
                invPricingAnalysisBarSpan.text("Today prices have been updated at: " + getSnapshot(todayDate).updateTime);

                //Automation
                if (settings.invPricing.autoClose) {
                    close();
                }
            } else {
                //Today pricing not updated
                if (hasPendingUpdate(todayDate)) {
                    invPricingAnalysisBarSpan.text("Price update submitted but not confirmed. Check the target prices and retry if needed.");
                } else {
                    invPricingAnalysisBarSpan.text("Today's snapshot data saved at: " + getSnapshot(todayDate).updateTime);
                }
                $(invPricingAnalysisBar).append($('<li></li>').append(saveInvPricingBtn.text("save snapshot data again")));
                if (analysis.hasValue('newPrice')) {
                    $(invPricingAnalysisBar).append($('<li></li>').append(applyNewPriceInvPricingBtn));
                }
                if (settings.invPricing.showReferenceRecommendation && analysis.hasValue('referenceNewPrice')) {
                    $(invPricingAnalysisBar).append($('<li></li>').append(applyReferencePriceInvPricingBtn));
                }
            }
        } else {
            //Today data does not exist
            $(invPricingAnalysisBar).append($('<li></li>').append(saveInvPricingBtn.text("save snapshot data")));
            if (analysis.hasValue('newPrice')) {
                $(invPricingAnalysisBar).append($('<li></li>').append(applyNewPriceInvPricingBtn));
            }
            if (settings.invPricing.showReferenceRecommendation && analysis.hasValue('referenceNewPrice')) {
                $(invPricingAnalysisBar).append($('<li></li>').append(applyReferencePriceInvPricingBtn));
            }
        }
    }
}

function getTargetPricingUpdates(prices: AESModel.InventoryPrices, useReferencePrices: boolean) {
    let targetPrices: Partial<Record<AESModel.Cabin, number>> = {};
    for (const cmp of cabins) {
        let targetPrice = analysis.data[cmp].newPrice;
        if (!targetPrice && useReferencePrices) {
            targetPrice = analysis.data[cmp].referenceNewPrice;
        }
        if (targetPrice) {
            let submittedPrice = AES.cleanInteger(prices[cmp].newPriceInput.value);
            if (Number.isFinite(submittedPrice) && submittedPrice > 0) {
                targetPrices[cmp] = submittedPrice;
            } else {
                throw new Error('Invalid target price for ' + cmp);
            }
        }
    }
    return targetPrices;
}

function priceFormSignature(form: HTMLFormElement) {
    return JSON.stringify([form.action, form.method, form.target]) + Array.from(form.querySelectorAll('input, select, textarea')).map(el => {
        if (el instanceof HTMLInputElement) return [el.name, el.value, el.checked];
        if (el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) return [el.name, el.value];
        return [];
    }).map(x => JSON.stringify(x)).join('|');
}

function watchNativePriceSubmission() {
    const form = document.querySelector('.pricing [name="submit-prices"]')?.closest('form');
    if (!(form instanceof HTMLFormElement) || watchedPriceForms.has(form)) return;
    watchedPriceForms.add(form);
    form.addEventListener('submit', event => {
        if (authorizedPriceSubmit) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (inventoryActionPending) return;
        const submitter = event.submitter;
        const revision = inventoryRevision;
        let status = $('#aes-price-queue-status');
        if (!status.length) status = $('<span id="aes-price-queue-status" role="status"></span>').insertBefore(form);
        void runInventoryAction(async () => {
            const signature = priceFormSignature(form);
            const current = () => isInventoryCurrent(revision) && form.isConnected && signature === priceFormSignature(form);
            status.text('Waiting in the page queue to submit prices...');
            const slot = await AES.queuePage(location.href, 'price', current);
            try {
                if (!current() || Date.now() >= (slot.expires || 0)) throw new Error('Prices or page changed while waiting. Please review and retry.');
                authorizedPriceSubmit = true;
                try { form.requestSubmit(submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : undefined); }
                finally { authorizedPriceSubmit = false; }
                void slot.complete();
                status.text('Price submission dispatched.');
            } catch (error) { await slot.cancel(); throw error; }
        }, status, revision);
    }, true);
}

async function submitPendingPricingUpdate(targetPrices: Partial<Record<AESModel.Cabin, number>>, status: JQuery, revision: number) {
    if (!Object.keys(targetPrices).length) throw new Error('No valid target prices were found. Prices were not submitted.');
    const submitter = document.querySelector<HTMLButtonElement>('.pricing [name="submit-prices"]');
    const form = submitter?.closest('form');
    if (!submitter || !form) throw new Error('Price submission form is unavailable.');
    const signature = priceFormSignature(form);
    const current = () => isInventoryCurrent(revision) && form.isConnected && signature === priceFormSignature(form);
    status.text('Waiting in the page queue to submit prices...');
    const slot = await AES.queuePage(location.href, 'price', current);
    try {
        if (!current()) throw new Error('Prices changed while waiting. Please review and retry.');
        const dates = {...pricingData.date};
        for (const [date, value] of Object.entries(dates)) {
            if (AES.isRecord(value)) {
                const copy = {...value};
                delete copy.pricingUpdatePending;
                dates[date] = copy;
            }
        }
        const snapshot = makeInventorySnapshot(analysis);
        snapshot.pricingUpdatePending = {targetPrices, updateTime: snapshot.updateTime || ''};
        dates[todayDate] = snapshot;
        const next = {...pricingData, date: dates};
        await chrome.storage.local.set({[next.key]: next});
        if (!current() || Date.now() >= (slot.expires || 0)) throw new Error('Prices or page changed while saving. Please review and retry.');
        pricingData = next;
        authorizedPriceSubmit = true;
        try { $(submitter).trigger('click'); } finally { authorizedPriceSubmit = false; }
        void slot.complete();
        status.removeClass().addClass('warning').text('Price update submitted but not confirmed.');
    } catch (error) { await slot.cancel(); throw error; }
}

function makeInventorySnapshot(value: AESModel.InventoryAnalysis): AESModel.InventorySnapshot {
    return {data: value.data, updateTime: AES.getServerDate().time, date: todayDate, pricingUpdated: 0};
}

async function runInventoryAction(action: () => Promise<void>, status: JQuery, revision: number) {
    if (inventoryActionPending || !isInventoryCurrent(revision)) return;
    inventoryActionPending = true;
    $('#aes-div-analysis button').prop('disabled', true);
    try { await action(); }
    catch (error) {
        if (isInventoryCurrent(revision)) status.removeClass().addClass('bad').text('Unable to save inventory data. Prices were not submitted. ' + (error instanceof Error ? error.message : ''));
    } finally {
        inventoryActionPending = false;
        if (isInventoryCurrent(revision)) $('#aes-div-analysis button').prop('disabled', false);
        else if (AES.isPageOwner()) AES.tryRun('content_inventory', () => rerenderInventoryModule(true));
    }
}

//Display History
function displayHistory(analysis: AESModel.InventoryAnalysis) {
    //Prepare data
    let dates = [];
    //Get valid dates can add function here
    for (let date in pricingData.date) {
        if (/^\d{8}$/.test(date) && readInventorySnapshot(pricingData.date[date])) {
            dates.push(date)
        }
    }
    dates.sort();
    //If historical data exist then build
    if (dates.length) {
        //Build Div
        let mainDiv = $("#aes-div-analysis");
        mainDiv.after('<h3 id="aes-h3-history">Historical Data</h3><div id="aes-div-invPricing-historicalData" class="as-panel"></div>');

        //History Options
        let fieldset = $('<fieldset></fieldset>').html('<legend>History Options</legend>');
        //Hide Now
        let option1 = $('<div class="checkbox"></div>').html('<label><input id="aes-check-inventory-history-showNow" type="checkbox"> Show "Now" column</label>');
        //Show only Priced
        let option2 = $('<div class="checkbox"></div>').html('<label><input id="aes-check-inventory-history-showOnlyPricing" type="checkbox"> Show only dates when pricing changed</label>');

        //Number of records
        let option3 = $('<select id="aes-select-inventory-history-numberPastDates" class="form-control input-sm"></select>').html('<option value="5">5 past dates</option><option value="10">10 past dates</option><option value="all">All past dates</option>')
        let wrapper = $('<div class="form-group"></div>').append('<label class="control-label"><span>Number of past dates</span></label>', option3);

        fieldset.append(option1, option2, wrapper);
        $("#aes-div-invPricing-historicalData").append(fieldset);
        //Default values
        if (settings.invPricing.historyTable.showNow) {
            $("#aes-check-inventory-history-showNow").prop("checked", true);
        }
        if (settings.invPricing.historyTable.showOnlyPricing) {
            $("#aes-check-inventory-history-showOnlyPricing").prop("checked", true);
        }
        $("#aes-select-inventory-history-numberPastDates").val(settings.invPricing.historyTable.numberOfDates);

        //Change events
        $<HTMLInputElement>("#aes-check-inventory-history-showNow").change(function() {
            if (this.checked) {
                settings.invPricing.historyTable.showNow = 1;
            } else {
                settings.invPricing.historyTable.showNow = 0;
            }
            AES.updateSettings(function(currentSettings) {
                getHistoryPreferences(currentSettings).showNow = settings.invPricing.historyTable.showNow;
            }, function(updatedSettings) {
                settings = readInventorySettings(updatedSettings);
            });
            buildHistoryTable();
        });
        $<HTMLInputElement>("#aes-check-inventory-history-showOnlyPricing").change(function() {
            buildHistoryTable();
            if (this.checked) {
                settings.invPricing.historyTable.showOnlyPricing = 1;
            } else {
                settings.invPricing.historyTable.showOnlyPricing = 0;
            }
            AES.updateSettings(function(currentSettings) {
                getHistoryPreferences(currentSettings).showOnlyPricing = settings.invPricing.historyTable.showOnlyPricing;
            }, function(updatedSettings) {
                settings = readInventorySettings(updatedSettings);
            });
        });
        $("#aes-select-inventory-history-numberPastDates").change(function() {
            settings.invPricing.historyTable.numberOfDates = String($('#aes-select-inventory-history-numberPastDates').val());
            AES.updateSettings(function(currentSettings) {
                getHistoryPreferences(currentSettings).numberOfDates = settings.invPricing.historyTable.numberOfDates;
            }, function(updatedSettings) {
                settings = readInventorySettings(updatedSettings);
            });
            buildHistoryTable();
        });

        buildHistoryTable();
    }
}

function buildHistoryTable() {
    //Clean previous table
    $('#aes-table-inventory-history').remove();

    let showNow = 0;
    let showOnlyPricing = 0;
    if ($('#aes-check-inventory-history-showNow:checked').length > 0) {
        showNow = 1;
    }
    if ($('#aes-check-inventory-history-showOnlyPricing:checked').length > 0) {
        showOnlyPricing = 1;
    }

    let numberOfDates: number;
    switch ($('#aes-select-inventory-history-numberPastDates').val()) {
        case '5':
            numberOfDates = 5;
            break;
        case '10':
            numberOfDates = 10;
            break;
        case 'all':
            numberOfDates = 0;
            break;
        default:
            numberOfDates = 10;
    }

    let dates = [];
    //Get valid dates can add function here
    for (let date in pricingData.date) {
        if (showOnlyPricing) {
            if (getSnapshot(date).pricingUpdated) {
                if (/^\d{8}$/.test(date) && readInventorySnapshot(pricingData.date[date])) {
                    dates.push(date)
                }
            }
        } else {
            if (/^\d{8}$/.test(date) && readInventorySnapshot(pricingData.date[date])) {
                dates.push(date)
            }
        }
    }

    dates.sort();
    dates.reverse();
    if (numberOfDates) {
        dates = dates.slice(0, numberOfDates);
    }

    if (dates.length) {

        //Headrows
        let th: Array<string | JQuery> = ['<th></th>'];
        let th1 = ['<th>SC</th>'];
        if (showNow) {
            // The moment of opening the inv tab
            th.push($('<th colspan="5"></th>').text('Now'));
            th1.push('<th class="text-nowrap aes-text-right">Price</th>');
            th1.push('<th class="text-nowrap">&Delta; %</th>');
            th1.push('<th class="text-nowrap">Load</th>');
            th1.push('<th class="text-nowrap">&Delta; %</th>');
            th1.push('<th class="text-nowrap aes-text-right">Index</th>');
        }
        for (let i = 0; i < dates.length; i++) {
            const isOldest = i === dates.length - 1;
            let date = dates[i];
            if (!isOldest) {
                th.push($('<th colspan="5"></th>').text(AES.formatDateString(date) || date));
                th1.push('<th class="text-nowrap aes-text-right">Price</th>');
                th1.push('<th class="text-nowrap text-right">&Delta; %</th>');
                th1.push('<th class="text-nowrap text-right">Load</th>');
                th1.push('<th class="text-nowrap text-right">&Delta; %</th>');
                th1.push('<th class="text-nowrap text-right">Index</th>');
            } else {
                th.push($('<th colspan="3"></th>').text(AES.formatDateString(date) || date));
                th1.push('<th class="text-nowrap text-right">Price</th>');
                th1.push('<th class="text-nowrap text-right">Load</th>');
                th1.push('<th class="text-nowrap text-right">Index</th>');
            }
        }

        let headRow = $('<tr></tr>').append(...th);
        let headRow2 = $('<tr></tr>').append(...th1);
        let thead = $('<thead></thead>').append(headRow, headRow2);

        //Build table
        let compartments = cabins;

        //Tbody rows
        let tbody = $('<tbody></tbody>');
        compartments.forEach(function(cmp) {
            let td = [];
            td.push($('<td></td>').text(cmp));
            if (showNow) {
                //Now TDs
                let data = analysis.data[cmp];
                let prevData = getSnapshot(dates[0]).data[cmp];
                td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryPrice(data)));
                td.push($('<td class="text-nowrap text-right"></td>').text(displayDifference(data, prevData).price));
                td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryLoad(data)));
                td.push($('<td class="text-nowrap text-right"></td>').text(displayDifference(data, prevData).load));
                td.push($('<td class="text-nowrap text-right"></td>').append(historyDisplayIndex(data, 0)));
            }
            //Historical tds
            for (let i = 0; i < dates.length; i++) {
                const isOldest = i === dates.length - 1;
                let date = dates[i];
                let data = getSnapshot(date).data[cmp];
                if (!isOldest) {
                    // Not the oldest
                    let prevData = getSnapshot(dates[i + 1]).data[cmp];
                    td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryPrice(data)));
                    td.push($('<td class="text-nowrap text-right"></td>').text(displayDifference(data, prevData).price));
                    td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryLoad(data)));
                    td.push($('<td class="text-nowrap text-right"></td>').text(displayDifference(data, prevData).load));
                    td.push($('<td class="text-nowrap text-right"></td>').append(historyDisplayIndex(data, 0)));
                } else {
                    // Oldest: No difference value
                    td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryPrice(data)));
                    td.push($('<td class="text-nowrap text-right"></td>').html(displayHistoryLoad(data)));
                    td.push($('<td class="text-nowrap text-right"></td>').append(historyDisplayIndex(data, 0)));
                }
            }

            //Finish row
            let row = $('<tr></tr>').append(...td);
            tbody.append(row);
        });

        //Table footer Total Rows
        let totalColumns = th1.length;
        let footRow = [];
        let footerRows: Array<'pax' | 'all'> = ['pax', 'all']
        footRow.push('<tr><td colspan="' + totalColumns + '"></td></tr>');
        //Total PAX
        footerRows.forEach(function(type) {
            let tf = [];
            tf.push($('<th></th>').text(historyDisplayTotalText(type)));
            if (showNow) {
                //Now
                let data = analysis.data;
                tf.push('<td colspan="2"></td>');
                tf.push($('<td></td>').html(historyDisplayTotal(data, type)));
                tf.push('<td></td>');
                //index
                tf.push($('<td class="aes-text-right"></td>').append(historyDisplayIndex(data, type)));
            }
            for (let i = 0; i < dates.length; i++) {
                const isOldest = i === dates.length - 1;
                let date = dates[i];
                let data = getSnapshot(date).data;
                if (!isOldest) {
                    tf.push('<td colspan="2"></td>');
                    tf.push($('<td></td>').html(historyDisplayTotal(data, type)));
                    tf.push('<td></td>');
                    tf.push($('<td class="aes-text-right"></td>').append(historyDisplayIndex(data, type)));
                } else {
                    tf.push('<td></td>');
                    tf.push($('<td></td>').html(historyDisplayTotal(data, type)));
                    tf.push($('<td class="aes-text-right"></td>').append(historyDisplayIndex(data, type)));
                }
            }

            footRow.push($('<tr></tr>').append(...tf));
        });

        let tfoot = $('<tfoot></tfoot>').append(...footRow);
        let table = $('<table class="table table-bordered table-striped table-hover"></table>').append(thead, tbody, tfoot);
        let tableDiv = $('<div style="overflow-x:auto;" id="aes-table-inventory-history" class="as-table-well"></div>').append(table);

        $("#aes-div-invPricing-historicalData").append(tableDiv);
    }
}

function displayValidationError() {
    let p = [];
    p.push($('<p></p>').text('AES Inventory Pricing Module could not be loaded because of errors:'));
    aesmodule.errors.forEach(function(error) {
        p.push($('<p class="bad"></p>').append($('<b></b>').text(error)));
    });
    p.push($('<p class="warning"></p>').text('Adjust the inventory view and AES will reload automatically.'));
    let panel = $('<div id="aes-panel-validation" class="as-panel"></div>').append(...p);
    let h2 = $('<h3 id="aes-h3-validation"></h3>').text('AES Inventory Pricing Module');
    $('h1:eq(0)').after(h2, panel)
}

//History Table functions
function historyDisplayIndex(data: AESModel.InventoryItem | Record<AESModel.Cabin, AESModel.InventoryItem>, type: 'all' | 'pax' | 0) {
    let index = 0;
    if ('Y' in data) {
        const items = (type === 'pax' ? cabins.slice(0, 3) : cabins).map(c => data[c]).filter(item => item.valid);
        index = items.length ? Math.round(items.reduce((sum, item) => sum + item.index, 0) / items.length) : 0;
    } else if (data.valid) index = data.index;
    return index ? $('<span></span>').addClass(index >= 90 ? 'good' : index <= 50 ? 'bad' : 'warning').text(index) : '-';
}

function historyDisplayTotalText(type: 'all' | 'pax') {
    switch (type) {
        case 'all':
            return "Total PAX+Cargo";
        case 'pax':
            return "Total PAX";
    }
}

function historyDisplayTotal(data: Record<AESModel.Cabin, AESModel.InventoryItem>, type: 'all' | 'pax') {
    let cmp: AESModel.Cabin[] = [];
    switch (type) {
        case 'all':
            cmp = ['Y', 'C', 'F', 'Cargo'];
            break;
        case 'pax':
            cmp = ['Y', 'C', 'F'];
            break;
        default:
            // code block
    }
    let load = 0, cap = 0, bkd = 0;
    cmp.forEach(function(comp) {
        if (data[comp].valid) {
            cap += data[comp].totalCap;
            bkd += data[comp].totalBkd;
        }
    });
    if (cap) {
        load = Math.round(bkd / cap * 100);
        return bkd + ' / ' + cap + ' (' + displayPerc(load, 'load') + ')';
    } else {
        return '-';
    }
}

function displayHistoryLoad(data: AESModel.InventoryItem) {
    if (data.valid) {
        let booked = data.totalBkd;
        let capacity = data.totalCap;
        let load = Math.round(booked / capacity * 100);
        return booked + ' / ' + capacity + ' (' + displayPerc(load, 'load') + ')';
    } else {
        return '-';
    }
}

function displayHistoryPrice(data: AESModel.InventoryItem) {
    if (data.valid) {
        let price = data.analysisPrice;
        let pricePoint = data.analysisPricePoint;
        return formatCurrency(price) + ' AS$ (' + displayPerc(pricePoint, 'price') + ')';
    } else {
        return '-';
    }
}

function displayDifference(current: AESModel.InventoryItem, old: AESModel.InventoryItem) {
    if (current.valid && old.valid) {
        let currentLoad = Math.round(current.totalBkd / current.totalCap * 100);
        let oldLoad = Math.round(old.totalBkd / old.totalCap * 100);
        let load = currentLoad - oldLoad;
        let price = current.analysisPricePoint - old.analysisPricePoint;
        return { load: load, price: price };
    } else {
        return { load: '-', price: '-' };
    }
}

function displayPerc(perc: number, type: 'price' | 'load') {
    let span = $('<span></span>');
    switch (type) {
        case 'price':
            if (perc >= 100) {
                span.addClass('good').text(perc + "%");
                return span.prop('outerHTML');
            }
            if (perc < 75) {
                span.addClass('bad').text(perc + "%");
                return span.prop('outerHTML');
            }
            span.addClass('warning').text(perc + "%");
            return span.prop('outerHTML');
        case 'load':
            if (perc >= 70) {
                span.addClass('good').text(perc + "%");
                return span.prop('outerHTML');
            }
            if (perc < 40) {
                span.addClass('bad').text(perc + "%");
                return span.prop('outerHTML');
            }
            span.addClass('warning').text(perc + "%");
            return span.prop('outerHTML');
        default:
            return '<span class="warning">ERROR:2502 Wrong type set:' + type + '</span>';
    }
}
//Helper functions
function formatCurrency(value: number) {
    return Intl.NumberFormat().format(value)
}

function getPricingInventoryKey() {
    // Get Origin and Destination
    let x = $("h2:first a");
    let org = $(x[0]).text();
    let dest = $(x[1]).text();
    // Create key
    let key = server + airline.id + org + dest + 'routeAnalysis';
    return { key: key, server: server, airline: airline, type: "routeAnalysis", origin: org, destination: dest }
}

function emptyInventoryItem(): AESModel.InventoryItem {
    return { totalCap: 0, totalBkd: 0, valid: 0, analysisPrice: 0, analysisPricePoint: 0,
        useCurrentPrice: 0, canRecommend: 0, analysisSourcePrice: 0, currentPrice: 0,
        currentPricePoint: 0, recommendation: 0, newPrice: 0, newPricePoint: 0, newPriceChange: 0,
        recType: 'neutral', referenceRecommendation: 0, referenceRecType: 'neutral',
        referenceNewPrice: 0, referenceNewPricePoint: 0, index: 0 };
}

function readInventoryItem(value: unknown): AESModel.InventoryItem {
    const item = emptyInventoryItem();
    if (!AES.isRecord(value)) return item;
    const keys: Array<Exclude<keyof AESModel.InventoryItem, 'valid' | 'recommendation' | 'referenceRecommendation' | 'recType' | 'referenceRecType'>> =
        ['totalCap','totalBkd','analysisPrice','analysisPricePoint','useCurrentPrice','canRecommend','analysisSourcePrice','currentPrice','currentPricePoint','newPrice','newPricePoint','newPriceChange','referenceNewPrice','referenceNewPricePoint','index'];
    for (const key of keys) if (typeof value[key] === 'number' && Number.isFinite(value[key])) item[key] = value[key];
    item.valid = !!value.valid && item.totalCap > 0 && ['totalCap','totalBkd','analysisPrice','analysisPricePoint'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]));
    for (const key of ['recommendation', 'referenceRecommendation'] as const) if (typeof value[key] === 'string') item[key] = value[key];
    for (const key of ['recType', 'referenceRecType'] as const) if (typeof value[key] === 'string') item[key] = value[key];
    return item;
}

function readInventorySnapshot(value: unknown): AESModel.InventorySnapshot | null {
    if (!AES.isRecord(value) || !AES.isRecord(value.data)) return null;
    const result: AESModel.InventorySnapshot = {
        ...value, data: { Y: readInventoryItem(value.data.Y), C: readInventoryItem(value.data.C), F: readInventoryItem(value.data.F), Cargo: readInventoryItem(value.data.Cargo) },
        updateTime: typeof value.updateTime === 'string' ? value.updateTime : undefined,
        date: typeof value.date === 'number' ? value.date : undefined,
        pricingUpdated: typeof value.pricingUpdated === 'number' ? value.pricingUpdated : 0
    };
    delete result.pricingUpdatePending;
    const pending = value.pricingUpdatePending;
    if (AES.isRecord(pending) && AES.isRecord(pending.targetPrices)) {
        const targetPrices: Partial<Record<AESModel.Cabin, number>> = {};
        for (const cmp of cabins) {
            const target = pending.targetPrices[cmp];
            if (typeof target === 'number' && Number.isFinite(target) && target > 0) targetPrices[cmp] = target;
        }
        if (Object.keys(targetPrices).length === Object.keys(pending.targetPrices).length && Object.keys(targetPrices).length) {
            result.pricingUpdatePending = {targetPrices, updateTime: typeof pending.updateTime === 'string' ? pending.updateTime : ''};
        }
    }
    return result;
}

function hasPendingUpdate(date: string | number) {
    const value = pricingData.date[date];
    return AES.isRecord(value) && !!value.pricingUpdatePending;
}

function getSnapshot(date: string | number): AESModel.InventorySnapshot {
    return readInventorySnapshot(pricingData.date[date]) || { data: {Y: emptyInventoryItem(), C: emptyInventoryItem(), F: emptyInventoryItem(), Cargo: emptyInventoryItem()} };
}

function readInventorySettings(value: unknown): AESModel.InventorySettings {
    if (!AES.isRecord(value) || !AES.isRecord(value.invPricing) || !AES.isRecord(value.invPricing.recommendation)) throw new Error('Inventory pricing settings are missing. Save pricing settings before using inventory analysis.');
    const source = value.invPricing;
    const readConfig = (cmp: AESModel.Cabin): AESModel.PricingRecommendation => {
        const rec = AES.isRecord(source.recommendation) ? source.recommendation[cmp] : undefined;
        if (!AES.isRecord(rec) || typeof rec.minPrice !== 'number' || !Number.isFinite(rec.minPrice) || typeof rec.maxPrice !== 'number' || !Number.isFinite(rec.maxPrice) || rec.minPrice < 0 || rec.maxPrice < rec.minPrice || !Array.isArray(rec.steps)) throw new Error('Invalid inventory price bounds for ' + cmp);
        const steps: AESModel.PricingStep[] = [];
        for (const step of rec.steps) {
            if (!AES.isRecord(step) || typeof step.min !== 'number' || !Number.isFinite(step.min) || typeof step.max !== 'number' || !Number.isFinite(step.max) || step.min > step.max || typeof step.step !== 'number' || !Number.isFinite(step.step) || typeof step.name !== 'string') throw new Error('Invalid inventory pricing step for ' + cmp);
            steps.push({min: step.min, max: step.max, name: step.name, step: step.step});
        }
        return {minPrice: rec.minPrice, maxPrice: rec.maxPrice, steps};
    };
    const history = AES.isRecord(source.historyTable) ? source.historyTable : {};
    const enabled = (value: unknown) => value === true || value === 1 || value === '1';
    return { invPricing: { autoAnalysisSave: enabled(source.autoAnalysisSave) ? 1 : 0, autoPriceUpdate: enabled(source.autoPriceUpdate) ? 1 : 0,
        autoClose: enabled(source.autoClose) ? 1 : 0, showReferenceRecommendation: enabled(source.showReferenceRecommendation) ? 1 : 0,
        historyTable: {showNow: history.showNow ? 1 : 0, showOnlyPricing: history.showOnlyPricing ? 1 : 0, numberOfDates: typeof history.numberOfDates === 'string' ? history.numberOfDates : '5'},
        recommendation: {Y: readConfig('Y'), C: readConfig('C'), F: readConfig('F'), Cargo: readConfig('Cargo')} } };
}

function getHistoryPreferences(settings: Record<string, unknown>): Record<string, unknown> {
    if (!AES.isRecord(settings.invPricing)) settings.invPricing = {};
    const inv = settings.invPricing;
    if (!AES.isRecord(inv)) throw new Error('Invalid inventory settings');
    if (!AES.isRecord(inv.historyTable)) inv.historyTable = {};
    return AES.isRecord(inv.historyTable) ? inv.historyTable : {};
}
})();
