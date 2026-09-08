// Copyright 2018 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';
declare function importScripts(...urls: string[]): void;
importScripts('modules/page-queue.js');
(() => {
//Functions
function setDefaultSettings() {
    //Add default settings

    let aesSettings = {
        invPricing: setDefaultInvPricingSettings(),
        general: setDefaultGeneralSettings(),
        schedule: setDefaultScheduleSettings(),
        personnelManagement: setDefaultPersonnelManagementSettings()
    };
    chrome.storage.local.get(['settings'], function(result) {
        let settings = mergeDefaultSettings(result.settings || {}, aesSettings);
        chrome.storage.local.set({ settings: settings }, function() {

        });
    });
    //
}

function mergeDefaultSettings(settings: unknown, defaults: Record<string, unknown>): Record<string, unknown> {
    if (!isSettingsObject(settings)) {
        return cloneSettings(defaults);
    }

    let merged = cloneSettings(settings);
    for (let key in defaults) {
        const defaultValue = defaults[key];
        const currentValue = merged[key];

        if (currentValue === undefined) {
            merged[key] = cloneSettings(defaultValue);
        } else if (
            isSettingsObject(defaultValue)
        ) {
            merged[key] = mergeDefaultSettings(currentValue, defaultValue);
        }
    }

    return merged;
}

function isSettingsObject(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneSettings(value: Record<string, unknown>): Record<string, unknown>;
function cloneSettings(value: unknown): unknown;
function cloneSettings(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(cloneSettings);
    }

    if (isSettingsObject(value)) {
        let clone: Record<string, unknown> = {};
        for (let key in value) {
            clone[key] = cloneSettings(value[key]);
        }
        return clone;
    }

    return value;
}

function setDefaultScheduleSettings() {
    //auto settings
    let schedule = {
        autoExtract: 0
    };
    //Cmp settings
    return schedule;
}

function setDefaultPersonnelManagementSettings() {
    let personnelManagement = {
        value: 0,
        type: 'absolute',
        auto: 0,
        alreadyUpdated: []
    };

    return personnelManagement;
}

function setDefaultGeneralSettings() {
    //auto settings
    let general = {
        defaultDashboard: 'general'
    };
    //Cmp settings
    return general;
}

function setDefaultInvPricingSettings() {
    //auto settings
    let invPricing: AESModel.InventoryPricingSettings = {
        autoAnalysisSave: 1,
        autoPriceUpdate: 0,
        autoClose: 0,
        showReferenceRecommendation: 0,
        recommendation: {
            Y: { maxPrice: 200, minPrice: 60, steps: [] },
            C: { maxPrice: 200, minPrice: 60, steps: [] },
            F: { maxPrice: 200, minPrice: 60, steps: [] },
            Cargo: { maxPrice: 200, minPrice: 60, steps: [] }
        },
        historyTable: {
            showNow: 1,
            showOnlyPricing: 0,
            numberOfDates: "5"
        }
    };
    //Cmp settings
    let steps = [
        {
            min: 0,
            max: 40,
            name: 'Drop High',
            step: -8
    },
        {
            min: 40,
            max: 60,
            name: 'Drop Medium',
            step: -4
    },
        {
            min: 60,
            max: 70,
            name: 'Drop Low',
            step: -2
    },
        {
            min: 70,
            max: 80,
            name: 'Keep',
            step: 0
    },
        {
            min: 80,
            max: 90,
            name: 'Raise Low',
            step: 1
    },
        {
            min: 90,
            max: 99,
            name: 'Raise Medium',
            step: 2
    },
        {
            min: 99,
            max: 100,
            name: 'Raise High',
            step: 5
    }
  ];
    let cmps: AESModel.Cabin[] = ['Y', 'C', 'F', 'Cargo'];
    cmps.forEach(function(cmp) {
        invPricing.recommendation[cmp] = {
            maxPrice: 200,
            minPrice: 60,
            steps: steps
        };
    });
    return invPricing;
}

//MAIN
chrome.runtime.onInstalled.addListener(function() {
    setDefaultSettings();
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [new chrome.declarativeContent.PageStateMatcher({
                pageUrl: { hostContains: '.airlinesim.aero' },
            })],
            actions: [new chrome.declarativeContent.ShowAction()]
    }]);
    });
});

})();
