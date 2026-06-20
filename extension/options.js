"use strict";
//Main
var allStorageData = {};

$(function () {
    //Get saved data
    chrome.storage.local.get(null, function (items) {
        allStorageData = items;

        // Initialize backup and restore functionality
        initializeBackupRestore();

        // Display data statistics
        displayDataStatistics();

        // Display available log files
        displayLogFiles();
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
    $("#aes-restore-file").change(function (event) {
        const file = event.target.files[0];
        if (file) {
            $("#aes-restore-btn").prop("disabled", false);
            $("#aes-selected-file-name").text(file.name);
            showStatusMessage("File selected: " + file.name, "info");
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
                "Are you sure you want to clear all AES logs? This action cannot be undone."
            )
        ) {
            clearLogData();
        }
    });

    // Clear old data button
    $("#aes-clear-old-data-btn").click(function () {
        if (
            confirm(
                "Are you sure you want to clear data older than 30 days? This action cannot be undone."
            )
        ) {
            clearOldData();
        }
    });

    // Clear all data button
    $("#aes-clear-all-data-btn").click(function () {
        if (
            confirm(
                "Are you sure you want to clear ALL data? This action cannot be undone.\n\nConsider creating a backup first."
            )
        ) {
            if (
                confirm(
                    "This will permanently delete all your AES data. Are you absolutely sure?"
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
            '<p class="text-muted">No data found. Start using AES to see statistics here.</p>'
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

function buildStatItem(label, value) {
    return `
        <div class="aes-stat">
            <span class="aes-stat-label">${label}</span>
            <span class="aes-stat-value">${value}</span>
        </div>
    `;
}

function analyzeStorageData(data) {
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
        stats.totalItems++;
        const item = data[key];
        const jsonSize = JSON.stringify(item).length;
        stats.estimatedSize += jsonSize;

        if (key === "settings") {
            stats.settings++;
        } else if (isLogStorageItem(key, item)) {
            stats.logs++;
        } else if (item && item.type) {
            switch (item.type) {
                case "schedule":
                    stats.schedule++;
                    break;
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
    showStatusMessage("Creating backup...", "info");

    chrome.storage.local.get(null, function (items) {
        let backupData = {};

        if (backupType === "all") {
            backupData = items;
        } else {
            // Filter data based on backup type
            for (let key in items) {
                const item = items[key];

                switch (backupType) {
                    case "settings":
                        if (key === "settings") {
                            backupData[key] = item;
                        }
                        break;
                    case "schedule":
                        if (item && item.type === "schedule") {
                            backupData[key] = item;
                        }
                        break;
                    case "pricing":
                        if (item && item.type === "pricing") {
                            backupData[key] = item;
                        }
                        break;
                    case "competitorMonitoring":
                        if (item && item.type === "competitorMonitoring") {
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
        const backup = {
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
            `Backup created successfully! ${backup.metadata.itemCount} items exported.`,
            "success"
        );
    });
}

function downloadBackup(backup, type) {
    const filename = `aes-backup-${type}-${
        new Date().toISOString().split("T")[0]
    }.json`;
    downloadJsonFile(filename, backup);
}

function downloadJsonFile(filename, data) {
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
    const file = $("#aes-restore-file")[0].files[0];
    const restoreMode = $("#aes-restore-mode").val();

    if (!file) {
        showStatusMessage("Please select a backup file first.", "error");
        return;
    }

    showStatusMessage("Reading backup file...", "info");

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const backup = JSON.parse(e.target.result);

            // Validate backup format
            if (!backup.metadata || !backup.data) {
                throw new Error("Invalid backup file format");
            }

            showStatusMessage(
                `Restoring ${backup.metadata.itemCount} items...`,
                "info"
            );

            if (restoreMode === "replace") {
                // Clear existing data first
                chrome.storage.local.clear(function () {
                    chrome.storage.local.set(backup.data, function () {
                        if (chrome.runtime.lastError) {
                            showStatusMessage(
                                "Error restoring data: " +
                                    chrome.runtime.lastError.message,
                                "error"
                            );
                        } else {
                            showStatusMessage(
                                "Data restored successfully! Please refresh the page.",
                                "success"
                            );
                            setTimeout(() => location.reload(), 2000);
                        }
                    });
                });
            } else {
                // Merge mode
                chrome.storage.local.set(backup.data, function () {
                    if (chrome.runtime.lastError) {
                        showStatusMessage(
                            "Error restoring data: " +
                                chrome.runtime.lastError.message,
                            "error"
                        );
                    } else {
                        showStatusMessage(
                            "Data merged successfully! Please refresh the page.",
                            "success"
                        );
                        setTimeout(() => location.reload(), 2000);
                    }
                });
            }
        } catch (error) {
            showStatusMessage(
                "Error reading backup file: " + error.message,
                "error"
            );
        }
    };

    reader.readAsText(file);
}

function clearOldData() {
    showStatusMessage("Clearing old data...", "info");

    chrome.storage.local.get(null, function (items) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.getTime();

        const keysToRemove = [];

        for (let key in items) {
            const item = items[key];

            // Skip settings
            if (key === "settings") continue;

            if (isLogStorageItem(key, item)) {
                const itemDate = parseStorageDateKey(
                    item.date || key.replace(/^aesLog_/, "")
                );
                if (itemDate && itemDate.getTime() < cutoffDate) {
                    keysToRemove.push(key);
                }
                continue;
            }

            // Check if item has date information
            if (item && item.date) {
                // For items with date objects (like schedule data)
                let hasRecentData = false;
                for (let dateKey in item.date) {
                    const itemDate = parseStorageDateKey(dateKey);
                    if (!itemDate) {
                        hasRecentData = true;
                        break;
                    }
                    if (itemDate.getTime() > cutoffDate) {
                        hasRecentData = true;
                        break;
                    }
                }
                if (!hasRecentData) {
                    keysToRemove.push(key);
                }
            } else if (item && item.updateTime) {
                // For items with updateTime
                const itemDate = new Date(item.updateTime);
                if (itemDate.getTime() < cutoffDate) {
                    keysToRemove.push(key);
                }
            }
        }

        if (keysToRemove.length > 0) {
            chrome.storage.local.remove(keysToRemove, function () {
                showStatusMessage(
                    `Cleared ${keysToRemove.length} old data items.`,
                    "success"
                );
                setTimeout(() => location.reload(), 1500);
            });
        } else {
            showStatusMessage("No old data found to clear.", "info");
        }
    });
}

function parseStorageDateKey(dateKey) {
    const value = String(dateKey);

    if (/^\d{8}$/.test(value)) {
        const year = parseInt(value.substring(0, 4), 10);
        const month = parseInt(value.substring(4, 6), 10);
        const day = parseInt(value.substring(6, 8), 10);
        const parsedDate = new Date(year, month - 1, day);

        if (
            parsedDate.getFullYear() === year &&
            parsedDate.getMonth() === month - 1 &&
            parsedDate.getDate() === day
        ) {
            return parsedDate;
        }
    }

    const parsedDate = new Date(value);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function displayLogFiles() {
    const select = $("#aes-log-file-select");
    const logs = getLogStorageItems(allStorageData);

    select.empty();
    if (!logs.length) {
        select.append($("<option></option>").val("").text("No logs found"));
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
    if (!key || !allStorageData[key]) {
        showStatusMessage("Please select a log file first.", "error");
        return;
    }

    const logData = allStorageData[key];
    const logDate = logData.date || key.replace(/^aesLog_/, "");
    const backup = {
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
    showStatusMessage("Log downloaded successfully.", "success");
}

function clearLogData() {
    const keys = getLogStorageItems(allStorageData).map(function (logItem) {
        return logItem.key;
    });

    if (!keys.length) {
        showStatusMessage("No logs found to clear.", "info");
        return;
    }

    chrome.storage.local.remove(keys, function () {
        if (chrome.runtime.lastError) {
            showStatusMessage(
                "Error clearing logs: " + chrome.runtime.lastError.message,
                "error"
            );
            return;
        }

        keys.forEach(function (key) {
            delete allStorageData[key];
        });
        displayDataStatistics();
        displayLogFiles();
        showStatusMessage(`Cleared ${keys.length} log files.`, "success");
    });
}

function getLogStorageItems(data) {
    const logs = [];
    for (let key in data) {
        const item = data[key];
        if (!isLogStorageItem(key, item)) {
            continue;
        }

        logs.push({
            key: key,
            date: item.date || key.replace(/^aesLog_/, ""),
            entryCount: Array.isArray(item.entries) ? item.entries.length : 0,
            size: JSON.stringify(item).length,
        });
    }

    return logs.sort(function (a, b) {
        return String(b.date).localeCompare(String(a.date));
    });
}

function isLogStorageItem(key, item) {
    return /^aesLog_\d{8}$/.test(key) || (item && item.type === "log");
}

function formatLogDateLabel(date) {
    const value = String(date || "");
    if (/^\d{8}$/.test(value)) {
        return `${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}`;
    }
    return value || "Unknown date";
}

function formatLogDateForFilename(date) {
    return formatLogDateLabel(date).replace(/[^0-9-]/g, "");
}

function clearAllData() {
    showStatusMessage("Clearing all data...", "warning");

    chrome.storage.local.clear(function () {
        if (chrome.runtime.lastError) {
            showStatusMessage(
                "Error clearing data: " + chrome.runtime.lastError.message,
                "error"
            );
        } else {
            showStatusMessage("All data cleared successfully!", "success");
            setTimeout(() => location.reload(), 1500);
        }
    });
}

function showStatusMessage(message, type) {
    const statusDiv = $("#aes-status-message");
    const statusEl = statusDiv.get(0);
    if (!statusEl) {
        return;
    }

    if (statusEl.aesHideTimer) {
        window.clearTimeout(statusEl.aesHideTimer);
        statusEl.aesHideTimer = null;
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

    // Auto-hide after 5 seconds for success/info messages
    if (type === "success" || type === "info") {
        statusEl.aesHideTimer = window.setTimeout(() => {
            statusDiv.hide();
            statusEl.aesHideTimer = null;
        }, 5000);
    }
}

function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
