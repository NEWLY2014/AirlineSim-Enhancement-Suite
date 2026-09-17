"use strict";
//Main
var allStorageData: AESModel.StorageSnapshot = {};
const RESTORE_RECOVERY_KEY = 'aesRestoreRecoveryV1';
let restoreBusy = false;
const optionsStatusTimers = new WeakMap<HTMLElement, number>();

// The options page runs without helpers.js; keep its external-data boundary local.
function isOptionsRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBackupType(value: unknown): value is AESModel.BackupType {
    return typeof value === "string" && ["all", "settings", "schedule", "pricing", "competitorMonitoring", "flightInfo", "aircraftData", "logs"].includes(value);
}

function isBackupEnvelope(value: unknown): value is AESModel.BackupEnvelope {
    return isOptionsRecord(value) && isOptionsRecord(value.metadata) && isOptionsRecord(value.data) && !Object.hasOwn(value.data, RESTORE_RECOVERY_KEY);
}

$(function () {
    AESI18n.whenReady(()=>{
    AESI18n.localize(document.body);
    document.title='AES · '+AESI18n.t('Import/Export');
    //Get saved data
    chrome.storage.local.get(null, function (items) {
        allStorageData = items;

        // Initialize backup and restore functionality
        initializeBackupRestore();

        // Display data statistics
        displayDataStatistics();

        // Display available log files
        displayLogFiles();
        displayRestoreRecovery(items[RESTORE_RECOVERY_KEY]);
    });
    });
});
//Functions

// Backup and Restore Functions
function initializeBackupRestore() {
    // Backup button click handler
    $("#aes-backup-btn").click(function () {
        createBackup();
    });

    // Choose file button click handler
    $("#aes-choose-file-btn").click(function () {
        $("#aes-restore-file").click();
    });

    // Restore file input change handler
    $<HTMLInputElement>("#aes-restore-file").change(function (event) {
        const file = event.target.files?.[0];
        if (file) {
            $("#aes-restore-btn").prop("disabled", false);
            $("#aes-selected-file-name").text(file.name);
            showStatusMessage(AESI18n.t("File selected: {0}", {"0": file.name}), "info");
        } else {
            $("#aes-restore-btn").prop("disabled", true);
            $("#aes-selected-file-name").text("");
        }
    });

    // Restore button click handler
    $("#aes-restore-btn").click(function () {
        restoreData();
    });

    // Download selected log file
    $("#aes-download-log-btn").click(function () {
        downloadSelectedLog();
    });

    // Clear log data
    $("#aes-clear-logs-btn").click(function () {
        if (
            confirm(
                AESI18n.t("Are you sure you want to clear all AES logs? This action cannot be undone.")
            )
        ) {
            clearLogData();
        }
    });

    // Clear old data button
    $("#aes-clear-old-data-btn").click(function () {
        if (
            confirm(
                AESI18n.t("Are you sure you want to clear data older than 30 days? This action cannot be undone.")
            )
        ) {
            clearOldData();
        }
    });

    // Clear all data button
    $("#aes-clear-all-data-btn").click(function () {
        if (
            confirm(
                AESI18n.t("Are you sure you want to clear ALL data? This action cannot be undone.\n\nConsider creating a backup first.")
            )
        ) {
            if (
                confirm(
                    AESI18n.t("This will permanently delete all your AES data. Are you absolutely sure?")
                )
            ) {
                clearAllData();
            }
        }
    });
}

function displayDataStatistics() {
    const stats = analyzeStorageData(allStorageData);

    if (stats.totalItems === 0) {
        $("#aes-stats-content").html(
            AESI18n.html('<p class="text-muted">No data found. Start using AES to see statistics here.</p>')
        );
        return;
    }

    const statsHtml = `
        <div class="aes-stat-grid">
            ${buildStatItem("Total Items", stats.totalItems)}
            ${buildStatItem("Settings", stats.settings)}
            ${buildStatItem("Schedule Data", stats.schedule)}
            ${buildStatItem("Pricing Data", stats.pricing)}
            ${buildStatItem("Flight Info", stats.flightInfo)}
            ${buildStatItem("Logs", stats.logs)}
            ${buildStatItem("Other Data", stats.other)}
            ${buildStatItem("Estimated Size", formatBytes(stats.estimatedSize))}
        </div>
    `;
    $("#aes-stats-content").html(statsHtml);
}

function buildStatItem(label: string, value: string | number) {
    return `
        <div class="aes-stat">
            <span class="aes-stat-label">${AESI18n.t(label)}</span>
            <span class="aes-stat-value">${value}</span>
        </div>
    `;
}

function analyzeStorageData(data: AESModel.StorageSnapshot) {
    const stats = {
        totalItems: 0,
        settings: 0,
        schedule: 0,
        pricing: 0,
        flightInfo: 0,
        competitorMonitoring: 0,
        aircraftData: 0,
        logs: 0,
        other: 0,
        estimatedSize: 0,
    };

    for (let key in data) {
        if (key === RESTORE_RECOVERY_KEY) continue;
        stats.totalItems++;
        const item = data[key];
        const jsonSize = (JSON.stringify(item)?.length || 0);
        stats.estimatedSize += jsonSize;

        if (["settings", "aesLanguage", "aesGameLanguage"].includes(key)) {
            stats.settings++;
        } else if (isLogStorageItem(key, item)) {
            stats.logs++;
        } else if (isOptionsRecord(item) && item.type) {
            switch (item.type) {
                case "schedule":
                    stats.schedule++;
                    break;
                case "routeAnalysis":
                case "pricing":
                    stats.pricing++;
                    break;
                case "competitorMonitoring":
                    stats.competitorMonitoring++;
                    break;
                default:
                    stats.other++;
            }
        } else if (key.includes("flightInfo")) {
            stats.flightInfo++;
        } else if (
            key.includes("aircraftProfitability") ||
            key.includes("aircraft")
        ) {
            stats.aircraftData++;
        } else {
            stats.other++;
        }
    }

    return stats;
}

function createBackup() {
    const backupType = $("#aes-backup-type").val();
    if (!isBackupType(backupType)) {
        showStatusMessage(AESI18n.t("Please select a backup type."), "error");
        return;
    }
    showStatusMessage(AESI18n.t("Creating backup..."), "info");

    chrome.storage.local.get(null, function (items) {
        if (chrome.runtime.lastError) {
            showStatusMessage(AESI18n.t("Error reading data: {0}", {"0": chrome.runtime.lastError.message}), "error");
            return;
        }
        let backupData: AESModel.StorageSnapshot = {};

        if (backupType === "all") {
            backupData = Object.fromEntries(Object.entries(items).filter(([key]) => key !== RESTORE_RECOVERY_KEY));
        } else {
            // Filter data based on backup type
            for (let key in items) {
                const item = items[key];

                switch (backupType) {
                    case "settings":
                        if (["settings", "aesLanguage", "aesGameLanguage"].includes(key)) {
                            backupData[key] = item;
                        }
                        break;
                    case "schedule":
                        if (isOptionsRecord(item) && item.type === "schedule") {
                            backupData[key] = item;
                        }
                        break;
                    case "pricing":
                        if (isOptionsRecord(item) && (item.type === "pricing" || item.type === "routeAnalysis")) {
                            backupData[key] = item;
                        }
                        break;
                    case "competitorMonitoring":
                        if (isOptionsRecord(item) && item.type === "competitorMonitoring") {
                            backupData[key] = item;
                        }
                        break;
                    case "flightInfo":
                        if (key.includes("flightInfo")) {
                            backupData[key] = item;
                        }
                        break;
                    case "aircraftData":
                        if (
                            key.includes("aircraftProfitability") ||
                            key.includes("aircraft")
                        ) {
                            backupData[key] = item;
                        }
                        break;
                    case "logs":
                        if (isLogStorageItem(key, item)) {
                            backupData[key] = item;
                        }
                        break;
                }
            }
        }

        // Create backup object with metadata
        const manifest = chrome.runtime.getManifest()
        const backup: AESModel.ExportBackup = {
            metadata: {
                version: manifest.version_name,
                created: new Date().toISOString(),
                type: backupType,
                itemCount: Object.keys(backupData).length,
            },
            data: backupData,
        };

        // Download backup file
        downloadBackup(backup, backupType);
        showStatusMessage(
            AESI18n.t("Backup created successfully! {0} items exported.", {"0": backup.metadata.itemCount}),
            "success"
        );
    });
}

function downloadBackup(backup: AESModel.ExportBackup, type: AESModel.BackupType) {
    const filename = `aes-backup-${type}-${
        new Date().toISOString().split("T")[0]
    }.json`;
    downloadJsonFile(filename, backup);
}

function downloadJsonFile(filename: string, data: unknown) {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(dataBlob);
    link.download = filename;
    link.click();

    // Clean up
    URL.revokeObjectURL(link.href);
}

function restoreData() {
    if (restoreBusy) return;
    const file = $<HTMLInputElement>("#aes-restore-file").get(0)?.files?.[0];
    const restoreMode = $("#aes-restore-mode").val();

    if (!file) {
        showStatusMessage(AESI18n.t("Please select a backup file first."), "error");
        return;
    }

    showStatusMessage(AESI18n.t("Reading backup file..."), "info");

    const reader = new FileReader();
    reader.onload = function () {
        try {
            if (typeof reader.result !== "string") throw new Error("Unable to read backup text");
            const backup: unknown = JSON.parse(reader.result);

            // Validate backup format
            if (!isBackupEnvelope(backup)) {
                throw new Error("Invalid backup file format");
            }

            showStatusMessage(
                AESI18n.t("Restoring {0} items...", {"0": Object.keys(backup.data).length}),
                "info"
            );

            if (restoreMode === "replace") {
                void replaceStorageData(backup.data);
            } else {
                // Merge mode
                chrome.storage.local.set(backup.data, function () {
                    if (chrome.runtime.lastError) {
                        showStatusMessage(
                            AESI18n.t("Error restoring data: {0}", {"0": chrome.runtime.lastError.message}),
                            "error"
                        );
                    } else {
                        showStatusMessage(
                            AESI18n.t("Data merged successfully! Please refresh the page."),
                            "success"
                        );
                        setTimeout(() => location.reload(), 2000);
                    }
                });
            }
        } catch (error) {
            showStatusMessage(
                AESI18n.t("Error reading backup file: {0}", {"0": (error instanceof Error ? error.message : String(error))}),
                "error"
            );
        }
    };

    reader.onerror = function () {
        showStatusMessage(AESI18n.t("Error reading backup file: {0}", {"0": (reader.error?.message || "Unable to read file")}), "error");
    };
    reader.readAsText(file);
}

function optionStorageGet(): Promise<AESModel.StorageSnapshot> {
    return new Promise((resolve, reject) => chrome.storage.local.get(null, items => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(items);
    }));
}
function optionStorageSet(data: AESModel.StorageSnapshot): Promise<void> {
    return new Promise((resolve, reject) => chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
    }));
}
function optionStorageRemove(keys: string[]): Promise<void> {
    return new Promise((resolve, reject) => chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
    }));
}
function comparableStorage(value: unknown): string {
    const normalize = (value: unknown): unknown => Array.isArray(value) ? value.map(normalize) :
        isOptionsRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value;
    return JSON.stringify(normalize(value));
}
async function writeReplacement(data: AESModel.StorageSnapshot) {
    await optionStorageSet(data);
    const written = await optionStorageGet();
    if (Object.entries(data).some(([key, value]) => comparableStorage(written[key]) !== comparableStorage(value))) {
        throw new Error('Restored data could not be verified.');
    }
    await optionStorageRemove(Object.keys(written).filter(key => key !== RESTORE_RECOVERY_KEY && !Object.hasOwn(data, key)));
    await optionStorageRemove([RESTORE_RECOVERY_KEY]);
}
async function replaceStorageData(data: AESModel.StorageSnapshot) {
    if (restoreBusy) return;
    restoreBusy = true;
    try {
        if (Object.hasOwn(data, RESTORE_RECOVERY_KEY)) throw new Error('Backup contains a reserved recovery key.');
        const previous = await optionStorageGet();
        if (Object.hasOwn(previous, RESTORE_RECOVERY_KEY)) throw new Error('Recover the previous interrupted restore before trying again.');
        const recovery = {previous, created:new Date().toISOString()};
        await optionStorageSet({[RESTORE_RECOVERY_KEY]:recovery});
        displayRestoreRecovery(recovery);
        await writeReplacement(data);
        $('#aes-restore-recovery').remove();
        showStatusMessage(AESI18n.t('Data restored successfully! Please refresh the page.'), 'success');
        setTimeout(() => location.reload(), 2000);
    } catch (error) {
        showStatusMessage(AESI18n.t("Restore did not complete. Original data is retained or available through recovery. {0}", {"0": (error instanceof Error ? error.message : String(error))}), 'error');
    } finally { restoreBusy = false; }
}
function displayRestoreRecovery(value: unknown) {
    if (!isOptionsRecord(value) || !isOptionsRecord(value.previous)) return;
    $('#aes-restore-recovery').remove();
    const previous = value.previous;
    const button = $(AESI18n.html('<button type="button" class="btn btn-default">Recover data from before restore</button>'));
    const panel = $('<div id="aes-restore-recovery"></div>').append(
        $('<p></p>').text(AESI18n.t('An interrupted restore has a saved recovery copy. Recover it before starting another replacement.')), button);
    $('#aes-status-message').after(panel);
    button.on('click', () => {
        if (restoreBusy) return;
        restoreBusy = true;button.prop('disabled',true);
        void writeReplacement(previous).then(() => {
            panel.remove();showStatusMessage(AESI18n.t('Previous data recovered. Please refresh the page.'), 'success');
        }, error => showStatusMessage(AESI18n.t("Recovery incomplete; the recovery copy is retained. {0}", {"0": String(error)}), 'error'))
            .finally(() => {restoreBusy=false;button.prop('disabled',false);});
    });
}

function clearOldData() {
    showStatusMessage(AESI18n.t('Clearing old data...'), 'info');
    chrome.runtime.sendMessage({type:'AES_PRUNE_HISTORY'}, (response: unknown) => {
        if (chrome.runtime.lastError || !isOptionsRecord(response) || response.ok !== true) {
            showStatusMessage(AESI18n.t("Error clearing old data: {0}", {"0": (chrome.runtime.lastError?.message || (isOptionsRecord(response) ? response.error : 'Storage unavailable.'))}), 'error');
            return;
        }
        showStatusMessage(AESI18n.t("Cleared {0} old snapshots and {1} old records.", {"0": response.snapshots, "1": response.records}), 'success');
        setTimeout(() => location.reload(),1500);
    });
}

function displayLogFiles() {
    const select = $("#aes-log-file-select");
    const logs = getLogStorageItems(allStorageData);

    select.empty();
    if (!logs.length) {
        select.append($("<option></option>").val("").text(AESI18n.t("No logs found")));
        $("#aes-download-log-btn, #aes-clear-logs-btn").prop("disabled", true);
        return;
    }

    logs.forEach(function (logItem) {
        const label = `${formatLogDateLabel(logItem.date)} (${logItem.entryCount} entries, ${formatBytes(logItem.size)})`;
        select.append($("<option></option>").val(logItem.key).text(label));
    });
    $("#aes-download-log-btn, #aes-clear-logs-btn").prop("disabled", false);
}

function downloadSelectedLog() {
    const key = $("#aes-log-file-select").val();
    if (typeof key !== "string" || !key || !allStorageData[key]) {
        showStatusMessage(AESI18n.t("Please select a log file first."), "error");
        return;
    }

    const logData = allStorageData[key];
    const logDate = (isOptionsRecord(logData) && logData.date) || key.replace(/^aesLog_/, "");
    const backup: AESModel.ExportBackup = {
        metadata: {
            version: chrome.runtime.getManifest().version_name,
            created: new Date().toISOString(),
            type: "log",
            date: logDate,
            itemCount: 1,
        },
        data: {
            [key]: logData,
        },
    };

    downloadJsonFile(`aes-log-${formatLogDateForFilename(logDate)}.json`, backup);
    showStatusMessage(AESI18n.t("Log downloaded successfully."), "success");
}

function clearLogData() {
    const keys = getLogStorageItems(allStorageData).map(function (logItem) {
        return logItem.key;
    });

    if (!keys.length) {
        showStatusMessage(AESI18n.t("No logs found to clear."), "info");
        return;
    }

    chrome.storage.local.remove(keys, function () {
        if (chrome.runtime.lastError) {
            showStatusMessage(
                AESI18n.t("Error clearing logs: {0}", {"0": chrome.runtime.lastError.message}),
                "error"
            );
            return;
        }

        keys.forEach(function (key) {
            delete allStorageData[key];
        });
        displayDataStatistics();
        displayLogFiles();
        showStatusMessage(AESI18n.t("Cleared {0} log files.", {"0": keys.length}), "success");
    });
}

function getLogStorageItems(data: AESModel.StorageSnapshot): AESModel.LogFileSummary[] {
    const logs: AESModel.LogFileSummary[] = [];
    for (let key in data) {
        const item = data[key];
        if (!isLogStorageItem(key, item)) {
            continue;
        }

        logs.push({
            key: key,
            date: (isOptionsRecord(item) && item.date) || key.replace(/^aesLog_/, ""),
            entryCount: isOptionsRecord(item) && Array.isArray(item.entries) ? item.entries.length : 0,
            size: (JSON.stringify(item)?.length || 0),
        });
    }

    return logs.sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
    });
}

function isLogStorageItem(key: string, item: unknown): boolean {
    return /^aesLog_\d{8}$/.test(key) || (isOptionsRecord(item) && item.type === "log");
}

function formatLogDateLabel(date: unknown) {
    const value = String(date || "");
    if (/^\d{8}$/.test(value)) {
        return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
    }
    return value || "Unknown date";
}

function formatLogDateForFilename(date: unknown) {
    return formatLogDateLabel(date).replace(/[^0-9-]/g, "");
}

function clearAllData() {
    showStatusMessage(AESI18n.t("Clearing all data..."), "warning");

    chrome.storage.local.clear(function () {
        if (chrome.runtime.lastError) {
            showStatusMessage(
                AESI18n.t("Error clearing data: {0}", {"0": chrome.runtime.lastError.message}),
                "error"
            );
        } else {
            showStatusMessage(AESI18n.t("All data cleared successfully!"), "success");
            setTimeout(() => location.reload(), 1500);
        }
    });
}

function showStatusMessage(message: string, type: AESModel.NotificationType | "info") {
    const statusDiv = $("#aes-status-message");
    const statusEl = statusDiv.get(0);
    if (!statusEl) {
        return;
    }

    const previousTimer = optionsStatusTimers.get(statusEl);
    if (previousTimer !== undefined) {
        window.clearTimeout(previousTimer);
        optionsStatusTimers.delete(statusEl);
    }
    statusDiv.removeClass(
        "status-success status-error status-warning status-info"
    );

    switch (type) {
        case "success":
            statusDiv.addClass("status-success");
            break;
        case "error":
            statusDiv.addClass("status-error");
            break;
        case "warning":
            statusDiv.addClass("status-warning");
            break;
        case "info":
        default:
            statusDiv.addClass("status-info");
            break;
    }

    statusDiv.stop && statusDiv.stop(true, true);
    statusDiv.text(message).show();
    // Persistent live regions announce outcomes without moving the user's focus.
    const error=type === "error";
    $("#aes-status-announcement").text(error ? "" : message);
    $("#aes-error-announcement").text(error ? message : "");

    // Auto-hide after 5 seconds for success/info messages
    if (type === "success" || type === "info") {
        optionsStatusTimers.set(statusEl, window.setTimeout(() => {
            statusDiv.hide();
            optionsStatusTimers.delete(statusEl);
        }, 5000));
    }
}

function formatBytes(bytes: number) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
