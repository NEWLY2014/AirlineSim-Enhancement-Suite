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
        <div class="row">
            <div class="col-md-3">
                <strong>Total Items:</strong><br>
                <span class="badge badge-primary">${stats.totalItems}</span>
            </div>
            <div class="col-md-3">
                <strong>Settings:</strong><br>
                <span class="badge badge-info">${stats.settings}</span>
            </div>
            <div class="col-md-3">
                <strong>Schedule Data:</strong><br>
                <span class="badge badge-success">${stats.schedule}</span>
            </div>
            <div class="col-md-3">
                <strong>Other Data:</strong><br>
                <span class="badge badge-secondary">${stats.other}</span>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-4">
                <strong>Pricing Data:</strong><br>
                <span class="badge badge-warning">${stats.pricing}</span>
            </div>
            <div class="col-md-4">
                <strong>Flight Info:</strong><br>
                <span class="badge badge-info">${stats.flightInfo}</span>
            </div>
            <div class="col-md-4">
                <strong>Estimated Size:</strong><br>
                <span class="badge badge-dark">${formatBytes(
                    stats.estimatedSize
                )}</span>
            </div>
        </div>
    `;
    $("#aes-stats-content").html(statsHtml);
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
                }
            }
        }

        // Create backup object with metadata
        const backup = {
            metadata: {
                version: "0.7.0",
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
    const dataStr = JSON.stringify(backup, null, 2);
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

            // Check if item has date information
            if (item && item.date) {
                // For items with date objects (like schedule data)
                let hasRecentData = false;
                for (let dateKey in item.date) {
                    const itemDate = new Date(parseInt(dateKey));
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
            statusDiv.addClass("status-warning"); // Using warning style for info
            break;
    }

    statusDiv.text(message).show();

    // Auto-hide after 5 seconds for success/info messages
    if (type === "success" || type === "info") {
        setTimeout(() => {
            statusDiv.fadeOut();
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
