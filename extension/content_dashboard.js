"use strict";
//MAIN
//Global vars
var settings, airline, server, todayDate;
const dashboardStorage = globalThis.chrome?.storage?.local;
$(function() {
    if (!dashboardStorage) {
        return;
    }
    todayDate = AES.getServerDate();
    airline = AES.getAirline();
    server = AES.getServerName();
    dashboardStorage.get(['settings'], function(result) {
        settings = result.settings;

        displayDashboard();
        dashboardHandle();
        $("#aes-select-dashboard-main").change(function() {
            dashboardHandle();
        });
    });
});

function displayDashboard() {
    let mainDiv = $("#enterprise-dashboard");
    mainDiv.before(
        `
    <h3>AirlineSim Enhancement Suite Dashboard</h3>
    <div class="as-panel">
      <div class="form-group">
        <label class="control-label">
          <span for="aes-select-dashboard-main">Show Dashboard</span>
        </label>
        <select class="form-control" id="aes-select-dashboard-main">
          <option value="general" selected="selected">General</option>
          <option value="routeManagement">Route Management</option>
          <option value="competitorMonitoring">Competitor Monitoring</option>
          <option value="aircraftProfitability">Aircraft Profitability</option>
        </select>
      </div>
    </div>
    <div id="aes-div-dashboard">
    </div>
    `
    );
    if (settings.general.defaultDashboard == 'other') {
        settings.general.defaultDashboard = 'general';
    }
    $("#aes-select-dashboard-main").val(settings.general.defaultDashboard);
}

function dashboardHandle() {
    let value = $("#aes-select-dashboard-main").val();
    settings.general.defaultDashboard = value;
    dashboardStorage.set({ settings: settings }, function() {});
    switch (value) {
        case 'general':
            displayGeneral();
            break;
        case 'routeManagement':
            displayRouteManagement();
            break;
        case 'competitorMonitoring':
            displayCompetitorMonitoring();
            break;
        case 'hr':
            displayHr();
            break;
        case 'aircraftProfitability':
            displayAircraftProfitability();
            break;
        default:
            displayDefault();
    }
}

function buildDashboardControlPanel(title, summary, content, expanded) {
    let body = $('<div class="aes-dashboard-control-panel-body"></div>').append(content);
    if (!expanded) {
        body.hide();
    }

    let toggle = $('<a style="cursor: pointer;"></a>').append(
        $('<span></span>').text(title),
        $('<span class="aes-dashboard-control-summary"></span>').text(summary ? ' ' + summary : '')
    );
    toggle.click(function() {
        body.toggle();
    });

    let legend = $('<legend></legend>').append(toggle);
    return $('<fieldset class="aes-dashboard-control-panel"></fieldset>').append(legend, body);
}

function buildDashboardColumnsPicker(columns, options) {
    let groups = {};
    columns.forEach(function(col) {
        let group = col[options.groupField] || 'Columns';
        if (!groups[group]) {
            groups[group] = [];
        }
        groups[group].push(col);
    });

    let content = $('<div class="aes-dashboard-columns"></div>');
    for (let group in groups) {
        let groupDiv = $('<div class="aes-dashboard-column-group"></div>');
        groupDiv.append($('<div class="aes-dashboard-column-group-title"></div>').text(group));
        let grid = $('<div class="aes-dashboard-column-grid"></div>');

        groups[group].forEach(function(col) {
            let input = $('<input type="checkbox">').val(col[options.valueField]);
            input.prop('checked', !!col[options.visibleField]);
            input.change(function() {
                options.onChange(col, this.checked);
            });

            grid.append($('<label class="aes-dashboard-column-choice"></label>').append(input, $('<span></span>').html(col[options.labelField])));
        });

        groupDiv.append(grid);
        content.append(groupDiv);
    }

    return content;
}

function getDashboardColumnClass(columnPrefix, column) {
    return column.className || column.cellClass || (columnPrefix + column.data);
}

function formatDashboardCell(type, value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }

    switch (type) {
        case 'money': {
            if (!value) {
                return '';
            }
            let span = $('<span></span>');
            let text = '';
            if (value > 0) {
                span.addClass('good');
                text = '+';
            }
            if (value < 0) {
                span.addClass('bad');
            }
            span.text(text + new Intl.NumberFormat().format(value) + ' AS$');
            return span;
        }
        default:
            return value;
    }
}

function sortDashboardTable(table, columnClass, number) {
    let tableRows = $('tbody tr', table);
    let tableBody = $('tbody', table);
    tableBody.empty();
    let indexes = [];
    tableRows.each(function() {
        if (number) {
            let value = parseFloat($(this).find("." + columnClass).text());
            indexes.push(value ? value : 0);
        } else {
            indexes.push($(this).find("." + columnClass).text());
        }
    });
    indexes = [...new Set(indexes)];
    let sorted = [...indexes];
    if (number) {
        sorted.sort(function(a, b) {
            if (a > b) return -1;
            if (a < b) return 1;
            return 0;
        });
    } else {
        sorted.sort();
    }
    let same = 1;
    for (let i = 0; i < indexes.length; i++) {
        if (indexes[i] !== sorted[i]) {
            same = 0;
        }
    }
    if (same) {
        if (number) {
            sorted.sort(function(a, b) {
                if (a < b) return -1;
                if (a > b) return 1;
                return 0;
            });
        } else {
            sorted.reverse();
        }
    }
    for (let i = 0; i < sorted.length; i++) {
        for (let j = tableRows.length - 1; j >= 0; j--) {
            let value = number ? parseFloat($(tableRows[j]).find("." + columnClass).text()) : $(tableRows[j]).find("." + columnClass).text();
            if (number && !value) {
                value = 0;
            }
            if (value == sorted[i]) {
                tableBody.append($(tableRows[j]));
                tableRows.splice(j, 1);
            }
        }
    }
}

function buildDashboardTable(options) {
    let tableHtml = $('<table class="table table-bordered table-striped table-hover"></table>');
    if (options.tableId) {
        tableHtml.attr('id', options.tableId);
    }

    let visibleColumns = options.columns.filter(function(column) {
        return column.visible;
    });
    let categoryCounts = {};
    visibleColumns.forEach(function(column) {
        let category = column.category || 'Columns';
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });

    let categoryCells = [];
    let headerCells = [];
    if (options.selectable) {
        let checkbox = $('<input type="checkbox">');
        checkbox.change(function() {
            $('tbody tr:visible input[type="checkbox"]', tableHtml).prop('checked', this.checked);
        });
        categoryCells.push($('<th rowspan="2"></th>').append(checkbox));
    }

    for (let category in categoryCounts) {
        categoryCells.push($('<th colspan="' + categoryCounts[category] + '"></th>').text(category));
    }

    visibleColumns.forEach(function(column) {
        if (column.sortable) {
            let columnClass = getDashboardColumnClass(options.columnPrefix || '', column);
            let sort = $('<a></a>').html(column.title);
            sort.click(function() {
                sortDashboardTable(tableHtml, columnClass, column.number);
            });
            headerCells.push($('<th style="cursor: pointer;"></th>').html(sort));
        } else {
            headerCells.push($('<th></th>').html(column.title));
        }
    });

    let headRows = [];
    if (Object.keys(categoryCounts).length) {
        headRows.push($('<tr></tr>').append(categoryCells));
        headRows.push($('<tr></tr>').append(headerCells));
    } else {
        if (options.selectable) {
            headerCells.unshift($('<th></th>'));
        }
        headRows.push($('<tr></tr>').append(headerCells));
    }

    let bodyRows = [];
    options.data.forEach(function(rowData) {
        let cells = [];
        if (options.selectable) {
            cells.push('<td><input type="checkbox"></td>');
        }
        visibleColumns.forEach(function(column) {
            let value = column.render ? column.render(rowData) : rowData[column.data];
            let td = $('<td></td>').addClass(getDashboardColumnClass(options.columnPrefix || '', column));
            td.html(column.format ? formatDashboardCell(column.format, value) : value);
            cells.push(td);
        });

        let row = $('<tr></tr>').append(cells);
        if (options.rowId) {
            row.attr('id', options.rowId(rowData));
        }
        row.data('aesDashboardRowData', rowData);
        bodyRows.push(row);
    });

    let thead = $('<thead></thead>').append(headRows);
    let tbody = $('<tbody></tbody>').append(bodyRows);
    tableHtml.append(thead, tbody);
    if (options.footer) {
        tableHtml.append(buildDashboardTableFooter(options, visibleColumns));
        tableHtml.data('aesDashboardFooterColumns', visibleColumns);
        tableHtml.data('aesDashboardColumnPrefix', options.columnPrefix || '');
        updateDashboardTableFooter(tableHtml);
    }

    return {
        table: tableHtml,
        tableWell: $('<div style="overflow-x:auto;" class="as-table-well"></div>').append(tableHtml)
    };
}

function buildDashboardTableFooter(options, visibleColumns) {
    let cells = [];
    if (options.selectable) {
        cells.push('<th>Average</th>');
    }

    visibleColumns.forEach(function(column) {
        if (!column.number || column.id || column.aggregate === false) {
            cells.push('<td></td>');
            return;
        }

        cells.push($('<td></td>'));
    });

    return $('<tfoot></tfoot>').append($('<tr></tr>').append(cells));
}

function parseDashboardNumber(value) {
    if (value === undefined || value === null) {
        return NaN;
    }
    return parseFloat(String(value).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
}

function updateDashboardTableFooter(table) {
    let columns = table.data('aesDashboardFooterColumns');
    if (!columns) {
        return;
    }

    let columnPrefix = table.data('aesDashboardColumnPrefix') || '';
    let rowCells = $('tfoot tr', table).children();
    let offset = $('thead tr:last th', table).length - columns.length;

    columns.forEach(function(column, index) {
        let footerCell = rowCells.eq(index + offset);
        if (!column.number || column.id || column.aggregate === false) {
            footerCell.empty();
            return;
        }

        let columnClass = getDashboardColumnClass(columnPrefix, column);
        let values = $('tbody tr', table).filter(function() {
            return $(this).css('display') != 'none';
        }).map(function() {
            return parseDashboardNumber($(this).find("." + columnClass).text());
        }).toArray().filter(function(value) {
            return !isNaN(value);
        });

        if (!values.length) {
            footerCell.empty();
            return;
        }

        let result = values.reduce(function(total, value) {
            return total + value;
        }, 0) / values.length;
        result = Math.round(result * 10) / 10;
        footerCell.html(formatDashboardCell(column.format, result));
    });
}

function applyDashboardTableFilters(table, filters, columns, filterValueField, columnPrefix) {
    $('tbody tr', table).show();
    $('tbody tr', table).each(function() {
        let row = this;
        filters.forEach(function(filter) {
            let filterCode = filter[filterValueField];
            let column = columns.find(function(column) {
                return column.filterValue == filterCode || column.data == filterCode || column.className == filterCode;
            });
            if (!column) {
                return;
            }

            let cell = $(row).find("." + getDashboardColumnClass(columnPrefix || '', column)).text();
            let value = filter.value;
            if (column.number) {
                cell = cell ? parseDashboardNumber(cell) : 0;
                value = value ? parseDashboardNumber(value) : 0;
            }

            switch (filter.operation) {
                case '=':
                    if (cell != value) $(row).hide();
                    break;
                case '!=':
                    if (cell == value) $(row).hide();
                    break;
                case '>':
                    if (cell < value) $(row).hide();
                    break;
                case '<':
                    if (cell > value) $(row).hide();
                    break;
                case 'contains':
                    if (String(cell).toLowerCase().indexOf(String(value).toLowerCase()) == -1) $(row).hide();
                    break;
            }
        });
    });
    updateDashboardTableFooter(table);
}

function buildDashboardFilterPanel(options) {
    let rows = [];
    options.filters = options.filters || [];
    options.filters.forEach(function(filter) {
        rows.push($('<tr></tr>').append(addFilterRow(filter[options.valueField], filter[options.labelField], filter.operation, filter.value)));
    });

    let tbody = $('<tbody></tbody>').append(rows);
    let columnOptions = [];
    options.columns.filter(function(column) {
        return column.filterable !== false;
    }).forEach(function(column) {
        columnOptions.push('<option value="' + (column.filterValue || column.data) + '">' + column.title + '</option>');
    });
    let columnSelect = $('<select class="form-control"></select>').append(columnOptions);
    let operationSelect = $('<select class="form-control"></select>');
    updateOperationOptions();
    columnSelect.change(updateOperationOptions);
    let input = $('<input type="text" class="form-control" style="min-width: 50px;">');
    let addBtn = $('<button type="button" class="btn btn-default"></button>').text('Add');
    addBtn.click(function() {
        tbody.append($('<tr></tr>').append(addFilterRow($('option:selected', columnSelect).val(), $('option:selected', columnSelect).text(), $('option:selected', operationSelect).text(), input.val())));
    });

    let tfoot = $('<tfoot></tfoot>').append($('<tr></tr>').append(
        $('<td></td>').html(columnSelect),
        $('<td></td>').html(operationSelect),
        $('<td></td>').html(input),
        $('<td></td>').append(addBtn)
    ));
    let table = $('<table class="table table-bordered table-striped table-hover"></table>').append(
        $('<thead></thead>').append('<tr><th>Column</th><th>Operation</th><th>Value</th><th></th></tr>'),
        tbody,
        tfoot
    );
    let applyBtn = $('<button type="button" class="btn btn-default">Apply filter</button>');
    let status = $('<span></span>');
    applyBtn.click(function() {
        let filters = [];
        $('tbody tr', table).each(function() {
            filters.push({
                [options.valueField]: $(this).find('input').val(),
                [options.labelField]: $(this).find('td:eq(0)').text(),
                operation: $(this).find('td:eq(1)').text(),
                value: $(this).find('td:eq(2)').text()
            });
        });
        options.onApply(filters, status);
    });

    let content = $('<div></div>').append(
        $('<div class="as-table-well aes-dashboard-filter-table"></div>').append(table),
        $('<div class="aes-dashboard-control-actions"></div>').append(applyBtn, status)
    );
    return buildDashboardControlPanel('Filters', options.filters.length ? options.filters.length + ' active' : 'No active filters', content, false);

    function addFilterRow(titleCode, title, operation, value) {
        let deleteBtn = $('<button type="button" class="btn btn-xs btn-default">Remove</button>');
        deleteBtn.click(function() {
            $(this).closest("tr").remove();
        });
        return [
            $('<td></td>').append($('<input type="hidden">').val(titleCode), title),
            $('<td></td>').text(operation),
            $('<td></td>').text(value),
            $('<td></td>').append(deleteBtn)
        ];
    }

    function updateOperationOptions() {
        let selectedColumn = options.columns.find(function(column) {
            let value = column.filterValue || column.data;
            return value == columnSelect.val();
        });
        let operations = options.operations;
        if (!operations) {
            operations = selectedColumn && selectedColumn.number ? ['=', '!=', '>', '<'] : ['=', '!=', 'contains'];
        } else if (typeof operations == 'function') {
            operations = operations(selectedColumn);
        }
        operationSelect.empty().append(operations.map(function(operation) {
            return $('<option></option>').text(operation);
        }));
    }
}

function buildGeneratedDashboardTableSettings(tableOptionsRule, table) {
    if (!tableOptionsRule.tableSettings) {
        return '';
    }

    let divCol = [];
    divCol.push($('<div class="col-md-4"></div>').append(buildGeneratedDashboardActions(tableOptionsRule, table)));
    divCol.push($('<div class="col-md-4"></div>').append(buildDashboardFilterPanel({
        filters: tableOptionsRule.filter || [],
        columns: tableOptionsRule.column,
        valueField: 'titlecode',
        labelField: 'title',
        onApply: function(filter, status) {
            status.removeClass().addClass('warning').text(' saving...');
            settings[tableOptionsRule.tableSettingStorage].filter = filter;
            dashboardStorage.set({ settings: settings }, function() {
                status.removeClass().addClass('warning').text(' filtering...');
                applyDashboardTableFilters(table, filter, tableOptionsRule.column, 'titlecode', tableOptionsRule.columnPrefix);
                status.removeClass().addClass('good').text(' done!');
            });
        }
    })));
    divCol.push($('<div class="col-md-4"></div>').append(buildGeneratedDashboardColumns(tableOptionsRule)));

    return $('<div class="row aes-dashboard-controls"></div>').append(divCol);
}

function buildGeneratedDashboardActions(tableOptionsRule, table) {
    let div = $('<div class="btn-group aes-dashboard-control-actions"></div>');
    tableOptionsRule.options.forEach(function(value) {
        let action = buildGeneratedDashboardAction(value, tableOptionsRule, table);
        if (action) {
            div.append(action);
        }
    });
    return buildDashboardControlPanel('Actions', '', div, true);
}

function buildGeneratedDashboardAction(value, tableOptionsRule, table) {
    switch (value) {
        case 'selectFirstSix':
            return $('<button type="button" class="btn btn-default">Select first 6</button>').click(function() {
                let count = 0;
                $('tbody tr:visible', table).each(function() {
                    $(this).find('input[type="checkbox"]').prop('checked', true);
                    count++;
                    if (count >= 6) {
                        return false;
                    }
                });
            });
        case 'openAircraft':
            return $('<button type="button" class="btn btn-default">Open aircraft (max 6)</button>').click(function() {
                let urls = $('tbody tr:visible', table).has('input:checked').map(function() {
                    return 'https://' + server + '.airlinesim.aero/app/fleets/aircraft/' + $(this).attr('id') + '/1';
                }).toArray();
                for (let i = 0; i < urls.length; i++) {
                    window.open(urls[i], '_blank');
                    if (i == 5) {
                        break;
                    }
                }
            });
        case 'reloadTableAircraftProfit':
            return $('<button type="button" class="btn btn-default">Reload table</button>').click(function() {
                displayAircraftProfitability();
            });
        case 'removeAircraft':
            return $('<button type="button" class="btn btn-default aes-dashboard-confirm-action">Remove aircraft</button>').click(function() {
                let btn = $(this);
                let id = [];
                let aircraftKey = [];
                $('tbody tr:visible', table).has('input:checked').each(function() {
                    let localId = $(this).attr('id');
                    id.push(localId);
                    aircraftKey.push(server + 'aircraftFlights' + localId);
                });
                if (!id.length) {
                    btn.removeClass('btn-warning').addClass('btn-default').text('Select aircraft first').delay(900).queue(function(next) {
                        $(this).text('Remove aircraft');
                        next();
                    });
                    return;
                }
                if (!btn.data('confirm')) {
                    btn.data('confirm', true).removeClass('btn-default').addClass('btn-warning').text('Confirm remove ' + id.length);
                    return;
                }

                let fleetKey = server + airline.id + 'aircraftFleet';
                dashboardStorage.get(fleetKey, function(result) {
                    let storedFleetData = result[fleetKey];
                    storedFleetData.fleet = storedFleetData.fleet.filter(function(value) {
                        return id.indexOf(String(value.aircraftId)) == -1;
                    });
                    dashboardStorage.set({ [fleetKey]: storedFleetData }, function() {
                        $('tbody tr:visible', table).has('input:checked').remove();
                        updateDashboardTableFooter(table);
                        btn.data('confirm', false).removeClass('btn-warning').addClass('btn-default').text('Remove aircraft');
                        dashboardStorage.remove(aircraftKey, function() {});
                    });
                });
            });
        case 'hideSelected':
            return $('<button type="button" class="btn btn-default">Hide checked</button>').click(function() {
                $('tbody tr:visible', table).has('input:checked').remove();
                updateDashboardTableFooter(table);
            });
        default:
            return null;
    }
}

function buildGeneratedDashboardColumns(tableOptionsRule) {
    let visibleCount = tableOptionsRule.column.filter(function(col) {
        return col.visible;
    }).length;
    let picker = buildDashboardColumnsPicker(tableOptionsRule.column, {
        groupField: 'category',
        labelField: 'title',
        valueField: 'data',
        visibleField: 'visible',
        onChange: function(col, checked) {
            if (!tableOptionsRule.hideColumn) {
                tableOptionsRule.hideColumn = [];
            }
            let currentColumn = col.data;
            let newHideColumns = tableOptionsRule.hideColumn.filter(function(value) {
                return value != currentColumn;
            });
            if (!checked) {
                newHideColumns.push(currentColumn);
            }

            tableOptionsRule.hideColumn = newHideColumns;
            settings[tableOptionsRule.tableSettingStorage].hideColumn = tableOptionsRule.hideColumn;
            dashboardStorage.set({ settings: settings }, function() {
                if (tableOptionsRule.onColumnChange) {
                    tableOptionsRule.onColumnChange();
                }
            });
        }
    });
    return buildDashboardControlPanel('Columns', visibleCount + ' shown', picker, false);
}

//Route Management Dashbord
function displayRouteManagement() {
    //Check ROute Managemetn seetings
    if (!settings.routeManagement) {
        setDefaultRouteManagementSettings();
    }

    let mainDiv = $("#aes-div-dashboard");
    //Build layout
    mainDiv.empty();
    let title = $('<h3></h3>').text('Route Management');
    let div = $('<div id="aes-div-dashboard-routeManagement" class="as-panel"></div>');
    mainDiv.append(title, div);
    //Get schedule
    let scheduleKey = server + airline.id + 'schedule';
    dashboardStorage.get([scheduleKey], function(result) {
        let scheduleData = result[scheduleKey];
        if (scheduleData) {
            // Table
            generateRouteManagementTable(scheduleData);

            // Option buttons
            let fieldsetEl = document.createElement("fieldset")
            let legendEl = document.createElement("legend")
            let buttonGroupEl = document.createElement("div")

            let buttonElements = {
                "selectFirstSix": {
                    "label": "Select first 6"
                },
                "hideChecked": {
                    "label": "Hide checked"
                },
                "openInventory": {
                    "label": "Open inventory (max 6)"
                },
                "reloadTable": {
                    "label": "Reload table"
                }
            }

            for (let key in buttonElements) {
                let buttonObj = buttonElements[key]
                let buttonEl = document.createElement("button")
                let buttonClassNames = buttonObj?.classNames
                let buttonType = buttonObj?.type
                let buttonDefaultClassNames = "btn btn-default"
                buttonEl.innerText = buttonObj.label

                if (buttonType) {
                    buttonEl.setAttribute("type", buttonType)
                } else {
                    buttonEl.setAttribute("type", "button")
                }

                if (buttonClassNames) {
                    buttonEl.className = buttonClassNames
                } else {
                    buttonEl.className = buttonDefaultClassNames
                }

                buttonObj.element = buttonEl
                buttonGroupEl.append(buttonEl)
            }

            legendEl.innerText = "Options"
            buttonGroupEl.classList.add("btn-group")
            buttonGroupEl.classList.add("aes-dashboard-control-actions")

            fieldsetEl.append(legendEl, buttonGroupEl)

            let optionsDiv = $('<div class="col-md-4"></div>').append(
                buildDashboardControlPanel('Actions', '', buttonGroupEl, true)
            );

            // Button actions

            // Select first 6
            buttonElements["selectFirstSix"].element.addEventListener("click", function() {
                let count = 0
                $('#aes-table-routeManagement tbody tr:visible').each(function() {
                    $(this).find("input").prop('checked', true);
                    count++;
                    if (count > 5) {
                        return false;
                    }
                })
            });

            // Remove checked
            buttonElements["hideChecked"].element.addEventListener("click", function() {
                $('#aes-table-routeManagement tbody tr:visible').has('input:checked').remove();
            });

            // Open Inventory
            buttonElements["openInventory"].element.addEventListener("click", function() {
                //Get checked columns
                let pages = $('#aes-table-routeManagement tbody tr:visible').has('input:checked').map(function() {
                    let orgdest = $(this).attr('id');
                    orgdest = orgdest.split("-");
                    orgdest = orgdest[2];
                    //let orgdest = $(this).find("td:eq(1)").text() + $(this).find("td:eq(2)").text();
                    let url = 'https://' + server + '.airlinesim.aero/app/com/inventory/' + orgdest;
                    return url;
                }).toArray();

                //Open new tabs
                for (let i = 0; i < pages.length; i++) {
                    if (i >= 6) break;
                    window.open(pages[i], '_blank');
                }
            });

            // Reload table reloadTable
            buttonElements["reloadTable"].element.addEventListener("click", function() {
                generateRouteManagementTable(scheduleData);
            });
            let divRow = $('<div class="row aes-dashboard-controls"></div>').append(optionsDiv, displayRouteManagementFilters(), displayRouteManagementColumns(scheduleData))
            div.prepend(divRow);

        } else {
            //no schedule
            div.append("Need schedule info to show this section. Change Dashboard to General -> Schedule -> Extract Schedule.")
        }
    });
}

function setDefaultRouteManagementSettings() {
    let columns = [
        {
            name: 'Origin',
            class: 'aes-origin',
            number: 0,
            show: 1,
            value: 'origin'
    },
        {
            name: 'Destination',
            class: 'aes-destination',
            number: 0,
            show: 1,
            value: 'destination'
    },
        {
            name: 'Hub',
            class: 'aes-hub',
            number: 0,
            show: 1,
            value: 'hub'
    },
        {
            name: 'OD',
            class: 'aes-od',
            number: 0,
            show: 1,
            value: 'odName'
    },
        {
            name: 'Direction',
            class: 'aes-direction',
            number: 0,
            show: 1,
            value: 'direction'
    },
        {
            name: '# of flight numbers',
            class: 'aes-fltNr',
            number: 1,
            show: 1,
            value: 'fltNr'
    },
        {
            name: 'PAX frequency',
            class: 'aes-paxFreq',
            number: 1,
            show: 1,
            value: 'paxFreq'
    },
        {
            name: 'Cargo frequency',
            class: 'aes-cargoFreq',
            number: 1,
            show: 1,
            value: 'cargoFreq'
    },
        {
            name: 'Total Frequency',
            class: 'aes-totalFreq',
            number: 1,
            show: 1,
            value: 'totalFreq'
    },
        {
            name: 'Analysis date',
            class: 'aes-analysisDate',
            number: 0,
            show: 1
    },
        {
            name: 'Previous Analysis date',
            class: 'aes-analysisPreDate',
            number: 0,
            show: 1
    },
        {
            name: 'Pricing date',
            class: 'aes-pricingDate',
            number: 0,
            show: 1
    },
        {
            name: 'PAX load',
            class: 'aes-paxLoad',
            number: 1,
            show: 1
    },
        {
            name: 'PAX load &Delta;',
            class: 'aes-paxLoadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo load',
            class: 'aes-cargoLoad',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo load &Delta;',
            class: 'aes-cargoLoadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Total load',
            class: 'aes-load',
            number: 1,
            show: 1
    },
        {
            name: 'Total load &Delta;',
            class: 'aes-loadDelta',
            number: 1,
            show: 1
    },
        {
            name: 'PAX index',
            class: 'aes-paxIndex',
            number: 1,
            show: 1
    },
        {
            name: 'PAX index &Delta;',
            class: 'aes-paxIndexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo index',
            class: 'aes-cargoIndex',
            number: 1,
            show: 1
    },
        {
            name: 'Cargo index &Delta;',
            class: 'aes-cargoIndexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Index',
            class: 'aes-index',
            number: 1,
            show: 1
    },
        {
            name: 'Index &Delta;',
            class: 'aes-indexDelta',
            number: 1,
            show: 1
    },
        {
            name: 'Route PAX index',
            class: 'aes-routeIndexPax',
            number: 1,
            show: 1
    },
        {
            name: 'Route Cargo index',
            class: 'aes-routeIndexCargo',
            number: 1,
            show: 1
    },
        {
            name: 'Route index',
            class: 'aes-routeIndex',
            number: 1,
            show: 1
    }
  ];
    settings.routeManagement = {
        tableColumns: columns,
        filter: []
    };
}

function routeManagementApplyFilter() {
    applyDashboardTableFilters($('#aes-table-routeManagement'), settings.routeManagement.filter, getRouteManagementDashboardColumns(), 'filterValue');
}

function getRouteManagementDashboardColumns() {
    let columns = settings.routeManagement.tableColumns.map(function(col) {
        return {
            category: col.value ? 'Schedule' : 'Analysis',
            title: col.name,
            data: col.value || col.class,
            className: col.class,
            filterValue: col.class,
            number: col.number,
            visible: col.show,
            sortable: 1
        };
    });
    return columns;
}

function displayRouteManagementFilters() {
    let div = $('<div class="col-md-4"></div>').append(
        buildDashboardFilterPanel({
            filters: settings.routeManagement.filter,
            columns: getRouteManagementDashboardColumns(),
            valueField: 'columnCode',
            labelField: 'column',
            onApply: function(filter, status) {
                status.removeClass().addClass('warning').text(' saving...');
                settings.routeManagement.filter = filter;
                dashboardStorage.set({ settings: settings }, function() {
                    status.removeClass().addClass('warning').text(' filtering...');
                    routeManagementApplyFilter();
                    status.removeClass().addClass('good').text(' done!');
                });
            }
        })
    );
    return div;
}

function displayRouteManagementColumns(scheduleData) {
    let visibleCount = settings.routeManagement.tableColumns.filter(function(col) {
        return col.show;
    }).length;
    let pickerColumns = settings.routeManagement.tableColumns.map(function(col) {
        return {
            ...col,
            category: col.value ? 'Schedule' : 'Analysis',
            source: col
        };
    });
    let picker = buildDashboardColumnsPicker(pickerColumns, {
        groupField: 'category',
        labelField: 'name',
        valueField: 'class',
        visibleField: 'show',
        onChange: function(col, checked) {
            col.source.show = checked ? 1 : 0;
            dashboardStorage.set({ settings: settings }, function() {
                generateRouteManagementTable(scheduleData);
            });
        }
    });
    let div = $('<div class="col-md-4"></div>').append(
        buildDashboardControlPanel('Columns', visibleCount + ' shown', picker, false)
    );
    return div;
}

function generateRouteManagementTable(scheduleData) {
    //Remove table
    $('#aes-div-routeManagement').remove();
    //Dates
    let dates = [];
    for (let date in scheduleData.date) {
        if (Number.isInteger(parseInt(date))) {
            dates.push(date);
        }
    }
    dates.reverse();
    //LatestSchedule
    let schedule = scheduleData.date[dates[0]].schedule;
    //Generate table rows
    let uniqueOD = [];
    let data = [];
    schedule.forEach(function(od) {
        //ODs for analysis
        uniqueOD.push(od.od);
        //Get values flight numbers and total frequency
        let fltNr = 0;
        let paxFreq = 0;
        let cargoFreq = 0;
        for (let flight in od.flightNumber) {
            cargoFreq += od.flightNumber[flight].cargoFreq,
                paxFreq += od.flightNumber[flight].paxFreq,
                fltNr++;
        }
        let totalFreq = cargoFreq + paxFreq;
        //hub
        let hub = od.od.slice(0, 3);
        let rowId = od.origin + od.destination;
        data.push({
            rowId: rowId,
            origin: od.origin,
            destination: od.destination,
            odName: od.od,
            direction: od.direction,
            fltNr: fltNr,
            paxFreq: paxFreq,
            cargoFreq: cargoFreq,
            totalFreq: totalFreq,
            hub: hub,
            actionInventory: '<a class="btn btn-xs btn-default" href="https://' + server + '.airlinesim.aero/app/com/inventory/' + rowId + '">Inventory</a>'
        });
    });
    let table = buildDashboardTable({
        tableId: 'aes-table-routeManagement',
        columns: getRouteManagementDashboardColumns(),
        data: data,
        selectable: true,
        footer: false,
        rowId: function(row) {
            return 'aes-row-' + row.rowId;
        }
    });
    let divTable = $('<div id="aes-div-routeManagement"></div>').append(table.tableWell);
    $('#aes-div-dashboard-routeManagement').append(divTable)
    routeManagementApplyFilter();
    //Analysis columns
    //Get unique ODs
    uniqueOD = [...new Set(uniqueOD)];
    for (let i = 0; i < uniqueOD.length; i++) {
        let origin = uniqueOD[i].substring(0, 3);
        let dest = uniqueOD[i].substring(3, 6);
        let keyOutbound = server + airline.id + origin + dest + 'routeAnalysis';
        let keyInbound = server + airline.id + dest + origin + 'routeAnalysis';
        dashboardStorage.get([keyOutbound], function(outboundData) {
            dashboardStorage.get([keyInbound], function(inboundData) {
                let outAnalysis = outboundData[keyOutbound];
                let inAnalysis = inboundData[keyInbound];
                let outDates, inDates;
                if (outAnalysis) {
                    outDates = getRouteAnalysisImportantDates(outAnalysis.date);
                }
                if (inAnalysis) {
                    inDates = getRouteAnalysisImportantDates(inAnalysis.date);
                }
                //Route index
                let routeIndex = {};
                let routeIndexPax, routeIndexCargo;
                if (outAnalysis && inAnalysis) {
                    if (outDates.analysis && inDates.analysis) {
                        let indexType = ['all', 'pax', 'cargo'];
                        indexType.forEach(function(type) {
                            let outIndex = getRouteAnalysisIndex(outAnalysis.date[outDates.analysis].data, type);
                            let inIndex = getRouteAnalysisIndex(inAnalysis.date[inDates.analysis].data, type);
                            if (outIndex && inIndex) {
                                routeIndex[type] = Math.round((outIndex + inIndex) / 2);
                            }
                        });
                    }
                }
                //For Outbound
                updateRouteAnalysisColumns(outAnalysis, outDates, routeIndex);
                updateRouteAnalysisColumns(inAnalysis, inDates, routeIndex);
            });
        });
    }
}

function updateRouteAnalysisColumns(data, dates, routeIndex) {

    if (data) {
        let rowId = '#aes-row-' + data.origin + data.destination;

        if (dates.analysis) {
            //Analysis date
            $(rowId + ' .aes-analysisDate').text(AES.formatDateString(dates.analysis));

            //Pricing date
            if (dates.pricing) {
                $(rowId + ' .aes-pricingDate').text(AES.formatDateString(dates.pricing));
            }

            //Pax Load
            $(rowId + ' .aes-paxLoad').html(displayLoad(getRouteAnalysisLoad(data.date[dates.analysis].data, 'pax')));

            //Cargo Load
            $(rowId + ' .aes-cargoLoad').html(displayLoad(getRouteAnalysisLoad(data.date[dates.analysis].data, 'cargo')));

            //All Load
            $(rowId + ' .aes-load').html(displayLoad(getRouteAnalysisLoad(data.date[dates.analysis].data, 'all')));

            //PAX Index
            $(rowId + ' .aes-paxIndex').html(displayIndex(getRouteAnalysisIndex(data.date[dates.analysis].data, 'pax')));

            //Cargo Index
            $(rowId + ' .aes-cargoIndex').html(displayIndex(getRouteAnalysisIndex(data.date[dates.analysis].data, 'cargo')));

            //PAX Index
            $(rowId + ' .aes-index').html(displayIndex(getRouteAnalysisIndex(data.date[dates.analysis].data, 'all')));

            if (dates.analysisOneBefore) {
                //Previous analysis date
                $(rowId + ' .aes-analysisPreDate').text(AES.formatDateString(dates.analysisOneBefore));

                //Pax Load Delta
                $(rowId + ' .aes-paxLoadDelta').html(displayRouteAnalysisLoadDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'pax'));
                //Cargo Load Delta
                $(rowId + ' .aes-cargoLoadDelta').html(displayRouteAnalysisLoadDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'cargo'));
                //All Load Delta
                $(rowId + ' .aes-loadDelta').html(displayRouteAnalysisLoadDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'all'));

                //PAX Index Delta
                $(rowId + ' .aes-paxIndexDelta').html(displayRouteAnalysisIndexDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'pax'));
                //Cargo Index Delta
                $(rowId + ' .aes-cargoIndexDelta').html(displayRouteAnalysisIndexDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'cargo'));
                //PAX Index Delta
                $(rowId + ' .aes-indexDelta').html(displayRouteAnalysisIndexDelta(data.date[dates.analysis].data, data.date[dates.analysisOneBefore].data, 'all'));
            }

            //Route Index
            if (routeIndex.pax) {
                $(rowId + ' .aes-routeIndexPax').html(displayIndex(routeIndex.pax));
            }
            if (routeIndex.cargo) {
                $(rowId + ' .aes-routeIndexCargo').html(displayIndex(routeIndex.cargo));
            }
            if (routeIndex.all) {
                $(rowId + ' .aes-routeIndex').html(displayIndex(routeIndex.all));
            }
        }
    }

    return;
    let analysisDate = dates.analysis;
    let pricingDate = dates.pricing;
    let paxLoad;
    let paxLoadDelta;
    let cargoLoad;
    let cargoLoadDelta;
    let totalLoad;
    let totalLoadDelta;

    let outDates = getInvPricingAnalaysisPricingDate(dataOut.date);
    if (outDates.analysis) {
        $('#aes-row-invPricing-' + origin + dest + '-analysis', tbody).text(AES.formatDateString(outDates.analysis));
        let outIndex = dataOut.date[outDates.analysis].routeIndex;
        let td = $('#aes-row-invPricing-' + origin + dest + '-OWindex', tbody);
        td.html(displayIndex(outIndex));
        if (outDates.analysisOneBefore) {
            let outIndexChange = dataOut.date[outDates.analysis].routeIndex - dataOut.date[outDates.analysisOneBefore].routeIndex
            td.append(displayIndexChange(outIndexChange));
        }
    }
    if (outDates.pricing) {
        $('#aes-row-invPricing-' + origin + dest + '-pricing', tbody).text(AES.formatDateString(outDates.pricing));
    }
}

function displayRouteAnalysisLoadDelta(dataCurrent, dataPrevious, type) {
    let load = getRouteAnalysisLoad(dataCurrent, type);
    let preLoad = getRouteAnalysisLoad(dataPrevious, type);
    if (load && preLoad) {
        let diff = load - preLoad;
        let span = $('<span></span>');
        if (diff > 0) {
            span.addClass('good').text('+' + diff + "%");
            return span;
        }
        if (diff < 0) {
            span.addClass('bad').text(diff + "%");
            return span;
        }
        span.addClass('warning').text(diff + "%");
        return span;
    }
}

function displayRouteAnalysisIndexDelta(dataCurrent, dataPrevious, type) {
    let index = getRouteAnalysisIndex(dataCurrent, type);
    let preIndex = getRouteAnalysisIndex(dataPrevious, type);
    if (index && preIndex) {
        let diff = index - preIndex;
        let span = $('<span></span>');
        if (diff > 0) {
            span.addClass('good').text('+' + diff);
            return span;
        }
        if (diff < 0) {
            span.addClass('bad').text(diff);
            return span;
        }
        span.addClass('warning').text(diff);
        return span;
    }
}

function getRouteAnalysisLoad(data, type) {
    let cmp = [];
    switch (type) {
        case 'all':
            cmp = ['Y', 'C', 'F', 'Cargo'];
            break;
        case 'pax':
            cmp = ['Y', 'C', 'F'];
            break;
        case 'cargo':
            cmp = ['Cargo'];
            break;
        default:
            // code block
    }
    let cap, bkd;
    cap = bkd = 0;
    cmp.forEach(function(comp) {
        if (data[comp].valid) {
            cap += data[comp].totalCap;
            bkd += data[comp].totalBkd;
        }
    });
    if (cap) {
        return Math.round(bkd / cap * 100);
    } else {
        return 0;
    }
}

function displayLoad(load) {
    if (load) {
        let span = $('<span></span>');
        if (load >= 70) {
            span.addClass('good').text(load + "%");
            return span;
        }
        if (load < 40) {
            span.addClass('bad').text(load + "%");
            return span;
        }
        span.addClass('warning').text(load + "%");
        return span;
    }
}

function getRouteAnalysisIndex(data, type) {
    let cmp = [];
    let index = 0;
    switch (type) {
        case 'all':
            cmp = ['Y', 'C', 'F', 'Cargo'];
            break;
        case 'pax':
            cmp = ['Y', 'C', 'F'];
            break;
        case 'cargo':
            cmp = ['Cargo'];
            break;
        default:
            cmp = 0;
            break;
    }
    if (cmp) {
        //Multi index
        let count = 0;
        cmp.forEach(function(comp) {
            if (data[comp].valid) {
                index += data[comp].index;
                count++;
            }
        });
        if (index) {
            return Math.round(index / count);
        }
    }
}

function getRouteAnalysisImportantDates(dates) {
    //Get latest analysis and pricing date
    let latest = {
        analysis: 0,
        pricing: 0,
        analysisOneBefore: 0,
        pricingOneBefore: 0
    }
    let analysisDates = [];
    let pricingDates = []
    for (let date in dates) {
        if (Number.isInteger(parseInt(date))) {
            if (dates[date].pricingUpdated) {
                pricingDates.push(date);
            }
            analysisDates.push(date);
        }
    }
    analysisDates.reverse();
    pricingDates.reverse();
    if (analysisDates.length) {
        latest.analysis = analysisDates[0];
        if (analysisDates[1]) {
            latest.analysisOneBefore = analysisDates[1];
        }
    }
    if (pricingDates.length) {
        latest.pricing = pricingDates[0];
        if (pricingDates[1]) {
            latest.pricingOneBefore = pricingDates[1];
        }
    }
    return latest;
}

function displayIndex(index) {
    let span = $('<span></span>');
    if (index >= 90) {
        return span.addClass('good').text(index);
    }
    if (index <= 50) {
        return span.addClass('bad').text(index);
    }
    return span.addClass('warning').text(index);
}

function displayIndexChange(index) {
    if (index > 0) {
        return ' (<span class="good">+' + index + '</span>)';
    }
    if (index < 0) {
        return ' (<span class="bad">' + index + '</span>)';
    }
    return ' (<span class="warning">' + index + '</span>)';
}
//Display General
function displayGeneral() {
    let mainDiv = $("#aes-div-dashboard");
    mainDiv.empty();

    //Table
    //Head cells
    let th1 = $('<th>Area</th>');
    let th2 = $('<th>Status</th>');
    let th3 = $('<th>Action</th>');
    let headRow = $('<tr></tr>').append(th1, th2, th3);
    let thead = $('<thead></thead>').append(headRow);
    //Body cells
    let tbody = $('<tbody></tbody>');
    generalAddScheduleRow(tbody);
    generalAddPersonnelManagementRow(tbody);


    let table = $('<table class="table table-bordered table-striped table-hover"></table>').append(thead, tbody);
    //Build layout
    let divTable = $('<div class="as-table-well"></div>').append(table);
    let title = $('<h3></h3>').text('General');
    let div = $('<div id="aes-div-dashboard-general" class="as-panel"></div>').append(divTable);
    mainDiv.append(title, div);
}

//Display Competitor Monitoring
function displayCompetitorMonitoring() {
    //Div
    let div = $('<div id="aes-div-dashboard-competitorMonitoring" class="as-panel"></div>');

    //Check Route Management Settings
    //
    ensureCompetitorMonitoringSettings();

    //Display airlines table
    displayCompetitorMonitoringAirlinesTable(div);

    let mainDiv = $("#aes-div-dashboard");
    //Build layout
    mainDiv.empty();
    let title = $('<h3></h3>').text('Competitor Monitoring');
    mainDiv.append(title, div);

}

function getLatestDateKeys(data, limit) {
    let latest = [];
    if (!data) {
        return latest;
    }

    for (let date in data) {
        latest.push(date);
        latest.sort(function(a, b) { return b - a });
        if (latest.length > limit) {
            latest.pop();
        }
    }

    return latest;
}

function displayCompetitorMonitoringAirlinesTable(div) {
    let compAirlines = [];
    let compAirlinesSchedule = [];
    let indexKey = AES.getCompetitorMonitoringIndexKey(server, airline.id);
    $('#aes-div-dashboard').off('.aesCompetitorMonitoring');

    let deduplicateCompetitorAirlines = function() {
        let seen = {};
        compAirlines = compAirlines.filter(function(compAirline) {
            let id = String(compAirline.id);
            if (seen[id]) {
                return false;
            }
            seen[id] = true;
            return true;
        });
    };

    let saveCompetitorMonitoringIndex = function() {
        deduplicateCompetitorAirlines();
        let competitorIds = compAirlines.map(function(compAirline) {
            return String(compAirline.id);
        }).filter(function(id, position, ids) {
            return ids.indexOf(id) == position;
        });
        dashboardStorage.set({ [indexKey]: competitorIds }, function() {});
    };

    let removeCompetitorFromIndex = function(competitorId) {
        dashboardStorage.get({ [indexKey]: [] }, function(result) {
            let competitorIds = Array.isArray(result[indexKey]) ? result[indexKey].map(String) : [];
            competitorIds = competitorIds.filter(function(id) {
                return id != String(competitorId);
            });
            dashboardStorage.set({ [indexKey]: competitorIds }, function() {});
        });
    };

    let loadSchedulesAndDisplayTable = function() {
        deduplicateCompetitorAirlines();
        let scheduleKeys = compAirlines.map(function(compAirline) {
            return server + compAirline.id + 'schedule';
        });

        let displayTable = function(scheduleItems) {
            for (let key in scheduleItems) {
                if (scheduleItems[key] && scheduleItems[key].type == 'schedule' && scheduleItems[key].server == server && scheduleItems[key].airline) {
                    compAirlinesSchedule[scheduleItems[key].airline.id] = scheduleItems[key];
                }
            }

            let tableData = [];
            if (compAirlines.length) {
                compAirlines.forEach(function myFunction(value) {
                let data = {};
                //Airline
                data.airlineId = value.id;
                data.competitorMonitoringKey = value.key;
                //All Tab0 Columns
                let dates = getLatestDateKeys(value.tab0, 2);
                if (dates.length) {
                    data.airlineId = value.tab0[dates[0]].id;
                    data.airlineCode = value.tab0[dates[0]].code;
                    data.airlineName = value.tab0[dates[0]].displayName;
                    data.overviewDate = AES.formatDateString(dates[0]);
                    data.overviewRating = value.tab0[dates[0]].rating;
                    data.overviewTotalPax = value.tab0[dates[0]].pax;
                    data.overviewTotalCargo = value.tab0[dates[0]].cargo;
                    data.overviewStations = value.tab0[dates[0]].stations;
                    data.overviewFleet = value.tab0[dates[0]].fleet;
                    data.overviewStaff = value.tab0[dates[0]].employees;
                    //If previous date exists
                    if (dates[1]) {
                        data.overviewPreDate = AES.formatDateString(dates[1]);
                        data.overviewRatingDelta = getDelta(getRatingNr(data.overviewRating), getRatingNr(value.tab0[dates[1]].rating));
                        data.overviewTotalPaxDelta = getDelta(data.overviewTotalPax, value.tab0[dates[1]].pax);
                        data.overviewTotalCargoDelta = getDelta(data.overviewTotalCargo, value.tab0[dates[1]].cargo);
                        data.overviewStationsDelta = getDelta(data.overviewStations, value.tab0[dates[1]].stations);
                        data.overviewFleetDelta = getDelta(data.overviewFleet, value.tab0[dates[1]].fleet);
                        data.overviewStaffDelta = getDelta(data.overviewStaff, value.tab0[dates[1]].employees);
                    }
                }
                //All Tab2 Columns
                dates = getLatestDateKeys(value.tab2, 2);
                if (dates.length) {
                    data.fafWeek = AES.formatDateStringWeek(value.tab2[dates[0]].week);
                    data.fafAirportsServed = value.tab2[dates[0]].airportsServed;
                    data.fafOperatedFlights = value.tab2[dates[0]].operatedFlights;
                    data.fafSeatsOffered = value.tab2[dates[0]].seatsOffered;
                    data.fafsko = value.tab2[dates[0]].sko;
                    data.fafCargoOffered = value.tab2[dates[0]].cargoOffered;
                    data.faffko = value.tab2[dates[0]].fko;
                    //If previous date exists
                    if (dates[1]) {
                        data.fafWeekPre = AES.formatDateStringWeek(value.tab2[dates[1]].week);
                        data.fafAirportsServedDelta = getDelta(data.fafAirportsServed, value.tab2[dates[1]].airportsServed);
                        data.fafOperatedFlightsDelta = getDelta(data.fafOperatedFlights, value.tab2[dates[1]].operatedFlights);
                        data.fafSeatsOfferedDelta = getDelta(data.fafSeatsOffered, value.tab2[dates[1]].seatsOffered);
                        data.fafskoDelta = getDelta(data.fafsko, value.tab2[dates[1]].sko);
                        data.fafCargoOfferedDelta = getDelta(data.fafCargoOffered, value.tab2[dates[1]].cargoOffered);
                        data.faffkoDelta = getDelta(data.faffko, value.tab2[dates[1]].fko);
                    }
                }
                //Schedule Columns
                if (compAirlinesSchedule[data.airlineId]) {
                    dates = getLatestDateKeys(compAirlinesSchedule[data.airlineId].date, 2);
                    if (dates.length) {
                        let hubs = {};
                        //For display
                        data.scheduleDate = AES.formatDateString(dates[0]);
                        //For table
                        data.scheduleDateUse = dates[0];
                        data.scheduleCargoFreq = 0;
                        data.schedulePAXFreq = 0;
                        data.scheduleFltNr = 0;
                        compAirlinesSchedule[data.airlineId].date[dates[0]].schedule.forEach(function(schedule) {
                            //Hubs
                            let hub = schedule.od.slice(0, 3);
                            if (hubs[hub]) {
                                hubs[hub]++;
                            } else {
                                hubs[hub] = 1;
                            }
                            for (let flight in schedule.flightNumber) {
                                //Cargo Freq
                                data.scheduleCargoFreq += schedule.flightNumber[flight].cargoFreq;
                                //Pax Freq
                                data.schedulePAXFreq += schedule.flightNumber[flight].paxFreq;
                                //Flight nr
                                data.scheduleFltNr++;
                            }
                        });
                        //Total Frequency
                        data.scheduleTotalFreq = data.schedulePAXFreq + data.scheduleCargoFreq;
                        //Hubs
                        let hubArray = [];
                        for (let hub in hubs) {
                            hubArray.push([hub, hubs[hub]]);
                        }
                        hubArray.sort(function(a, b) {
                            return b[1] - a[1];
                        });
                        data.scheduleHubs = '';
                        hubArray.forEach(function(hubA, index) {
                            if (index) {
                                data.scheduleHubs += ', ';
                            }
                            data.scheduleHubs += hubA[0] + ' (' + hubA[1] + ')';
                        });

                        //Previous schedule data
                        if (dates[1]) {
                            data.scheduleDatePre = AES.formatDateString(dates[1]);
                            data.scheduleCargoFreqPre = 0;
                            data.schedulePAXFreqPre = 0;
                            data.scheduleFltNrPre = 0;
                            compAirlinesSchedule[data.airlineId].date[dates[1]].schedule.forEach(function(schedule) {
                                //Hubs
                                let hub = schedule.od.slice(0, 3);
                                if (hubs[hub]) {
                                    hubs[hub]++;
                                } else {
                                    hubs[hub] = 1;
                                }
                                for (let flight in schedule.flightNumber) {
                                    //Cargo Freq
                                    data.scheduleCargoFreqPre += schedule.flightNumber[flight].cargoFreq;
                                    //Pax Freq
                                    data.schedulePAXFreqPre += schedule.flightNumber[flight].paxFreq;
                                    //Flight nr
                                    data.scheduleFltNrPre++;
                                }
                            });
                            //Total Frequency
                            data.scheduleTotalFreqPre = data.schedulePAXFreqPre + data.scheduleCargoFreqPre;
                            //Delta Columns
                            data.scheduleFltNrDelta = getDelta(data.scheduleFltNr, data.scheduleFltNrPre);
                            data.schedulePAXFreqDelta = getDelta(data.schedulePAXFreq, data.schedulePAXFreqPre);
                            data.scheduleCargoFreqDelta = getDelta(data.scheduleCargoFreq, data.scheduleCargoFreqPre);
                            data.scheduleTotalFreqDelta = getDelta(data.scheduleTotalFreq, data.scheduleTotalFreqPre);
                        }
                    }
                }
                tableData.push(data);

            });
            }

            let tableColumns = settings.competitorMonitoring.tableColumns.filter(function(col) {
                return col.headGroup != 'Actions';
            }).map(function(col) {
                return {
                    category: col.headGroup,
                    title: col.text,
                    data: col.field,
                    className: 'aes-' + col.field,
                    visible: col.visible,
                    sortable: 1,
                    number: col.number,
                    filterable: col.headGroup != 'Actions'
                };
            });

            if (!compAirlines.length) {
                let divRow = $('<div class="row aes-dashboard-controls"></div>').append(displayCompetitorMonitoringAirlinesTableOptions(), displayCompetitorMonitoringAirlinesTableColumns());
                div.append(divRow, '<p><span class="warning">No airlines marked for competitor monitoring. Open airline info page to mark airline for tracking.</span></p>');
                return;
            }

            let table = buildDashboardTable({
                tableId: 'aes-table-competitorMonitoring',
                columns: tableColumns,
                data: tableData,
                selectable: true,
                footer: false,
                rowId: function(row) {
                    return 'aes-compMon-row-' + row.airlineId;
                }
            });
            applyDashboardTableFilters(table.table, settings.competitorMonitoring.filter || [], tableColumns, 'data');
            let divRow = $('<div class="row aes-dashboard-controls"></div>').append(
                displayCompetitorMonitoringAirlinesTableOptions(table.table, compAirlinesSchedule, div, removeCompetitorFromIndex),
                displayCompetitorMonitoringAirlinesTableFilters(table.table, tableColumns),
                displayCompetitorMonitoringAirlinesTableColumns()
            );
            div.append(divRow, table.tableWell);

        };

        if (scheduleKeys.length) {
            dashboardStorage.get(scheduleKeys, displayTable);
        } else {
            displayTable({});
        }
    };

    let loadFromIndex = function(competitorIds) {
        competitorIds = competitorIds.map(String).filter(function(id, position, ids) {
            return ids.indexOf(id) == position;
        });
        let competitorKeys = competitorIds.map(function(competitorId) {
            return AES.getCompetitorMonitoringKey(server, airline.id, competitorId);
        });

        if (!competitorKeys.length) {
            loadSchedulesAndDisplayTable();
            return;
        }

        dashboardStorage.get(competitorKeys, function(items) {
            competitorKeys.forEach(function(key) {
                let compData = items[key];
                if (compData && compData.type == 'competitorMonitoring' && compData.server == server && compData.ownerId == airline.id && compData.tracking) {
                    compAirlines.push(compData);
                }
            });
            saveCompetitorMonitoringIndex();
            loadSchedulesAndDisplayTable();
        });
    };

    let migrateLegacyCompetitorMonitoringData = function() {
        dashboardStorage.get(null, function(items) {
            let legacyKeysToRemove = [];
            let migratedCompetitorData = {};

            //Get data
            for (let key in items) {
                if (items[key].type && items[key].type == 'competitorMonitoring' && items[key].server == server) {
                    let compData = items[key];
                    if (!compData.ownerId && compData.id && airline.id) {
                        const newKey = AES.getCompetitorMonitoringKey(server, airline.id, compData.id);
                        compData = {
                            ...compData,
                            key: newKey,
                            ownerId: airline.id,
                            ownerAirline: airline
                        };
                        migratedCompetitorData[newKey] = compData;
                        legacyKeysToRemove.push(key);
                    }

                    if (compData.ownerId == airline.id && compData.tracking) {
                        compAirlines.push(compData);
                    }
                }
            }

            saveCompetitorMonitoringIndex();
            if (Object.keys(migratedCompetitorData).length) {
                dashboardStorage.set(migratedCompetitorData, function() {
                    dashboardStorage.remove(legacyKeysToRemove, function() {});
                });
            }
            loadSchedulesAndDisplayTable();
        });
    };

    dashboardStorage.get([indexKey], function(result) {
        if (Array.isArray(result[indexKey])) {
            loadFromIndex(result[indexKey]);
        } else {
            migrateLegacyCompetitorMonitoringData();
        }
    });
}

function displayCompetitorMonitoringAirlineScheduleTable(mainDiv, scheduleData, data) {
    mainDiv.hide();
    //Build schedule rows
    let rows = [];
    let hrow = [];
    if (data.scheduleDateUse) {
        let columns = [
            {
                field: 'schedOrigin',
                text: 'Origin',
                headGroup: 'Schedule',
                visible: 1,
                number: 0,
      },
            {
                field: 'schedDestination',
                text: 'Destination',
                headGroup: 'Schedule',
                visible: 1,
                number: 0,
      },
            {
                field: 'schedHub',
                text: 'Hub',
                headGroup: 'Schedule',
                visible: 1,
                number: 0,
      },
            {
                field: 'schedOd',
                text: 'OD',
                headGroup: 'Schedule',
                visible: 1,
                number: 0,
      },
            {
                field: 'schedDir',
                text: 'Direction',
                headGroup: 'Schedule',
                visible: 1,
                number: 0,
      },
            {
                field: 'schedFltNr',
                text: '# of flight numbers',
                headGroup: 'Schedule',
                visible: 1,
                number: 1,
      },
            {
                field: 'schedPaxFreq',
                text: 'PAX frequency',
                headGroup: 'Schedule',
                visible: 1,
                number: 1,
      },
            {
                field: 'schedCargoFreq',
                text: 'Cargo frequency',
                headGroup: 'Schedule',
                visible: 1,
                number: 1,
      },
            {
                field: 'schedTotalFreq',
                text: 'Total Frequency',
                headGroup: 'Schedule',
                visible: 1,
                number: 1,
      }
    ];
        //Table Head
        let th = [];
        columns.forEach(function(col) {
            if (col.visible) {
                //Sort
                let sort = $('<a></a>').html(col.text);
                sort.click(function() {
                    SortTable(col.field, col.number, 'aes-table-competitorMonitoring-airline-schedule', 'aes-comp-sched-');
                });
                th.push($('<th style="cursor: pointer;"></th>').html(sort));
            }
        });
        hrow.push($('<tr></tr>').append(th));
        //Table Body
        scheduleData.date[data.scheduleDateUse].schedule.forEach(function(od) {
            let td = [];
            let fltNr = 0;
            let paxFreq = 0;
            let cargoFreq = 0;
            for (let flight in od.flightNumber) {
                cargoFreq += od.flightNumber[flight].cargoFreq,
                    paxFreq += od.flightNumber[flight].paxFreq,
                    fltNr++;
            }
            let totalFreq = cargoFreq + paxFreq;
            //hub
            let hub = od.od.slice(0, 3);
            let cellValue = {
                schedOrigin: od.origin,
                schedDestination: od.destination,
                schedOd: od.od,
                schedDir: od.direction,
                schedFltNr: fltNr,
                schedPaxFreq: paxFreq,
                schedCargoFreq: cargoFreq,
                schedTotalFreq: totalFreq,
                schedHub: hub
            }
            columns.forEach(function(cell) {
                if (cell.visible) {
                    td.push($('<td class="aes-comp-sched-' + cell.field + '" ></td>').html(cellValue[cell.field]));
                }
            });
            rows.push($('<tr></tr>').append(td));
        });
    } else {
        rows.push('<tr><td><span class="warning">No schedule found</span></td></tr>');
    }

    //Build layout
    let thead = $('<thead></thead>').append(hrow);
    let tbody = $('<tbody></tbody>').append(rows);
    let table = $('<table id="aes-table-competitorMonitoring-airline-schedule" class="table table-bordered table-striped table-hover"></table>').append(thead, tbody);
    let tableWell = $('<div style="overflow-x:auto;" class="as-table-well"></div>').append(table);
    let button = $('<button type="button" class="btn btn-default">Back to overview</button>');
    let panelDiv = $('<div class="as-panel"></div>').append(button, tableWell);
    let heading = $('<h4>' + data.airlineName + ' ' + data.airlineCode + ' schedule</h4>');
    let div = $('<div id="aes-compMonitor-schedule"></div>').append(heading, panelDiv);
    mainDiv.after(div);
    //Button clicks
    button.click(function() {
        div.remove();
        mainDiv.show();
    });
}

function displayCompetitorMonitoringAirlinesTableColumns() {
    let visibleCount = settings.competitorMonitoring.tableColumns.filter(function(col) {
        return col.headGroup != 'Actions';
    }).filter(function(col) {
        return col.visible;
    }).length;
    let picker = buildDashboardColumnsPicker(settings.competitorMonitoring.tableColumns.filter(function(col) {
        return col.headGroup != 'Actions';
    }), {
        groupField: 'headGroup',
        labelField: 'text',
        valueField: 'field',
        visibleField: 'visible',
        onChange: function(col, checked) {
            col.visible = checked ? 1 : 0;
            dashboardStorage.set({ settings: settings }, function() {
                displayCompetitorMonitoring();
            });
        }
    });
    let div = $('<div class="col-md-4"></div>').append(
        buildDashboardControlPanel('Columns', visibleCount + ' shown', picker, false)
    );
    return div;
}

function displayCompetitorMonitoringAirlinesTableFilters(table, columns) {
    let div = $('<div class="col-md-4"></div>').append(buildDashboardFilterPanel({
        filters: settings.competitorMonitoring.filter || [],
        columns: columns,
        valueField: 'data',
        labelField: 'title',
        onApply: function(filter, status) {
            status.removeClass().addClass('warning').text(' saving...');
            settings.competitorMonitoring.filter = filter;
            dashboardStorage.set({ settings: settings }, function() {
                status.removeClass().addClass('warning').text(' filtering...');
                applyDashboardTableFilters(table, filter, columns, 'data');
                status.removeClass().addClass('good').text(' done!');
            });
        }
    }));
    return div;
}

function displayCompetitorMonitoringAirlinesTableOptions(table, compAirlinesSchedule, mainDiv, removeCompetitorFromIndex) {
    let actions = $('<div class="btn-group aes-dashboard-control-actions"></div>');
    let openAirlineBtn = $('<button type="button" class="btn btn-default">Open airline page</button>');
    let showScheduleBtn = $('<button type="button" class="btn btn-default">Show airline schedule</button>');
    let removeBtn = $('<button type="button" class="btn btn-default aes-dashboard-confirm-action">Remove competitor</button>');
    let reloadBtn = $('<button type="button" class="btn btn-default">Reload table</button>');
    if (table) {
        actions.append(openAirlineBtn, showScheduleBtn, removeBtn);
    }
    actions.append(reloadBtn);
    let optionsDiv = $('<div class="col-md-4"></div>').append(
        buildDashboardControlPanel('Actions', '', actions, true)
    );

    openAirlineBtn.click(function() {
        getSelectedCompetitorRows(table).slice(0, 6).forEach(function(rowData) {
            window.open('/app/info/enterprises/' + rowData.airlineId, '_blank');
        });
    });

    showScheduleBtn.click(function() {
        let rows = getSelectedCompetitorRows(table);
        if (!rows.length || !compAirlinesSchedule[rows[0].airlineId]) {
            return;
        }
        displayCompetitorMonitoringAirlineScheduleTable(mainDiv, compAirlinesSchedule[rows[0].airlineId], rows[0]);
    });

    removeBtn.click(function() {
        let btn = $(this);
        let rows = getSelectedCompetitorRows(table);
        if (!rows.length) {
            btn.removeClass('btn-warning').addClass('btn-default').text('Select competitor first').delay(900).queue(function(next) {
                $(this).text('Remove competitor');
                next();
            });
            return;
        }
        if (!btn.data('confirm')) {
            btn.data('confirm', true).removeClass('btn-default').addClass('btn-warning').text('Confirm remove ' + rows.length);
            return;
        }

        let keys = rows.map(function(rowData) {
            return rowData.competitorMonitoringKey;
        });
        dashboardStorage.get(keys, function(compMonitoringData) {
            let updates = {};
            rows.forEach(function(rowData) {
                let compData = compMonitoringData[rowData.competitorMonitoringKey];
                if (compData) {
                    compData.tracking = 0;
                    updates[compData.key] = compData;
                }
            });
            dashboardStorage.set(updates, function() {
                rows.forEach(function(rowData) {
                    $('#aes-compMon-row-' + rowData.airlineId, table).remove();
                    removeCompetitorFromIndex(rowData.airlineId);
                });
                btn.data('confirm', false).removeClass('btn-warning').addClass('btn-default').text('Remove competitor');
            });
        });
    });

    //Reload table
    reloadBtn.click(function() {
        displayCompetitorMonitoring();
    });

    return optionsDiv;
}

function getSelectedCompetitorRows(table) {
    return $('tbody tr:visible', table).has('input:checked').map(function() {
        return $(this).data('aesDashboardRowData');
    }).toArray().filter(function(rowData) {
        return !!rowData;
    });
}

function getDefaultCompetitorMonitoringColumns() {
    let columns = [
        {
            field: 'airlineId',
            text: 'ID',
            headGroup: 'Airline',
            visible: 1,
            number: 1
    },
        {
            field: 'airlineCode',
            text: 'Code',
            headGroup: 'Airline',
            visible: 1,
            number: 0
    },
        {
            field: 'airlineName',
            text: 'Name',
            headGroup: 'Airline',
            visible: 1,
            number: 0
    },
        {
            field: 'overviewDate',
            text: 'Overview date',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewPreDate',
            text: 'Overview previous date',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewRating',
            text: 'Rating',
            headGroup: 'Overview',
            visible: 1,
            number: 0
    },
        {
            field: 'overviewRatingDelta',
            text: 'Rating &Delta;',
            headGroup: 'Overview',
            visible: 0,
            number: 0
    },
        {
            field: 'overviewTotalPax',
            text: 'Total pax',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalPaxDelta',
            text: 'Total pax &Delta;',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalCargo',
            text: 'Total cargo',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewTotalCargoDelta',
            text: 'Total cargo &Delta;',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStations',
            text: 'Stations',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStationsDelta',
            text: 'Stations &Delta;',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewFleet',
            text: 'Fleet',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewFleetDelta',
            text: 'Fleet &Delta;',
            headGroup: 'Overview',
            visible: 1,
            number: 1
    },
        {
            field: 'overviewStaff',
            text: 'Staff',
            headGroup: 'Overview',
            visible: 0,
            number: 1
    },
        {
            field: 'overviewStaffDelta',
            text: 'Staff &Delta;',
            headGroup: 'Overview',
            visible: 0,
            number: 1
    },
        {
            field: 'fafWeek',
            text: 'Week',
            headGroup: 'Figures',
            visible: 0,
            number: 0
    },
        {
            field: 'fafWeekPre',
            text: 'Previous week',
            headGroup: 'Figures',
            visible: 0,
            number: 0
    },
        {
            field: 'fafAirportsServed',
            text: 'Airports served',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafAirportsServedDelta',
            text: 'Airports served &Delta;',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafOperatedFlights',
            text: 'Operated flights',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafOperatedFlightsDelta',
            text: 'Operated flights &Delta;',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafSeatsOffered',
            text: 'Seats offered',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafSeatsOfferedDelta',
            text: 'Seats offered &Delta;',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafsko',
            text: 'Seat kilometer offered (SKO)',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafskoDelta',
            text: 'Seat kilometer offered (SKO) &Delta;',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'fafCargoOffered',
            text: 'Units offered',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'fafCargoOfferedDelta',
            text: 'Units offered &Delta;',
            headGroup: 'Figures',
            visible: 1,
            number: 1
    },
        {
            field: 'faffko',
            text: 'Freight kilometer offered (FKO)',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'faffkoDelta',
            text: 'Freight kilometer offered (FKO) &Delta;',
            headGroup: 'Figures',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleDate',
            text: 'Schedule Date',
            headGroup: 'Schedule',
            visible: 0,
            number: 0
    },
        {
            field: 'scheduleDatePre',
            text: 'Previous Schedule Date',
            headGroup: 'Schedule',
            visible: 0,
            number: 0
    },
        {
            field: 'scheduleHubs',
            text: 'Hubs (routes)',
            headGroup: 'Schedule',
            visible: 1,
            number: 0
    },
        {
            field: 'scheduleFltNr',
            text: '# of flight numbers',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleFltNrDelta',
            text: '# of flight numbers &Delta;',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'schedulePAXFreq',
            text: 'PAX frequency',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'schedulePAXFreqDelta',
            text: 'PAX frequency &Delta;',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleCargoFreq',
            text: 'Cargo frequency',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleCargoFreqDelta',
            text: 'Cargo frequency &Delta;',
            headGroup: 'Schedule',
            visible: 0,
            number: 1
    },
        {
            field: 'scheduleTotalFreq',
            text: 'Total frequency',
            headGroup: 'Schedule',
            visible: 1,
            number: 1
    },
        {
            field: 'scheduleTotalFreqDelta',
            text: 'Total frequency &Delta;',
            headGroup: 'Schedule',
            visible: 1,
            number: 1
    }
  ];
    return columns.filter(function(column) {
        return column.headGroup != 'Actions';
    });
}

function setDefaultCompetitorMonitoringSettings() {
    let columns = getDefaultCompetitorMonitoringColumns();
    settings.competitorMonitoring = {
        tableColumns: columns,
        filter: []
    };
}

function ensureCompetitorMonitoringSettings() {
    if (!settings.competitorMonitoring) {
        setDefaultCompetitorMonitoringSettings();
        return;
    }

    if (!Array.isArray(settings.competitorMonitoring.filter)) {
        settings.competitorMonitoring.filter = [];
    }

    let defaultColumns = getDefaultCompetitorMonitoringColumns();
    if (!Array.isArray(settings.competitorMonitoring.tableColumns)) {
        settings.competitorMonitoring.tableColumns = defaultColumns;
        return;
    }

    settings.competitorMonitoring.tableColumns = settings.competitorMonitoring.tableColumns.filter(function(column) {
        return column.headGroup != 'Actions';
    });

    settings.competitorMonitoring.tableColumns.forEach(function(column) {
        if (column.field == 'faffkoDela') {
            column.field = 'faffkoDelta';
            column.text = 'Freight kilometer offered (FKO) &Delta;';
        }
    });

    defaultColumns.forEach(function(defaultColumn) {
        let existing = settings.competitorMonitoring.tableColumns.find(function(column) {
            return column.field == defaultColumn.field;
        });
        if (!existing) {
            settings.competitorMonitoring.tableColumns.push(defaultColumn);
        }
    });
}

function getRatingNr(rating) {
    switch (rating) {
        case 'AAA':
            return 10;
            break;
        case 'AA':
            return 9;
            break;
        case 'A':
            return 8;
            break;
        case 'BBB':
            return 7;
            break;
        case 'BB':
            return 6;
            break;
        case 'B':
            return 5;
            break;
        case 'CCC':
            return 4;
            break;
        case 'CC':
            return 3;
            break;
        case 'C':
            return 2;
            break;
        case 'D':
            return 1;
            break;
        default:
            return 0;
    }
}

function getDelta(newNr, oldNr) {
    return newNr - oldNr;
};
//Display Aircraft aircraftProfitability
function displayAircraftProfitability() {
    if (!settings.aircraftProfitability) {
        settings.aircraftProfitability = {};
    }
    if (!settings.aircraftProfitability.hideColumn) {
        settings.aircraftProfitability.hideColumn = [];
    }
    //columns
    let columns = [
        {
            category: 'Aircraft',
            title: 'Aircraft ID',
            data: 'aircraftId',
            sortable: 1,
            visible: 1,
            number: 1,
            id: 1
    },
        {
            category: 'Aircraft',
            title: 'Registration',
            data: 'registration',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Aircraft',
            title: 'Equipment',
            data: 'equipment',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Aircraft',
            title: 'Fleet',
            data: 'fleet',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Aircraft',
            title: 'Nickname',
            data: 'nickname',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Aircraft',
            title: 'Note',
            data: 'note',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Aircraft',
            title: 'Age',
            data: 'age',
            sortable: 1,
            visible: 1,
            number: 1,
            aggregate: 'average'
    },
        {
            category: 'Aircraft',
            title: 'Maintenance',
            data: 'maintenance',
            sortable: 1,
            visible: 1,
            number: 1
    },
        {
            category: 'Aircraft',
            title: 'Date',
            data: 'dateAircraft',
            sortable: 1,
            visible: 1
    },
        {
            category: 'Profit',
            title: 'Total flights',
            data: 'totalFlights',
            sortable: 1,
            visible: 1,
            number: 1
    },
        {
            category: 'Profit',
            title: 'Finished flights',
            data: 'finishedFlights',
            sortable: 1,
            visible: 1,
            number: 1
    },
        {
            category: 'Profit',
            title: 'Profit/loss flights',
            data: 'profitFlights',
            sortable: 1,
            visible: 1,
            number: 1
    },
        {
            category: 'Profit',
            title: 'Profit',
            data: 'profit',
            sortable: 1,
            visible: 1,
            number: 1,
            format: 'money'
    },
        {
            category: 'Profit',
            title: 'Profit extract date',
            data: 'dateProfit',
            sortable: 1,
            visible: 1
    }
  ];
    if (settings.aircraftProfitability.hideColumn.length) {
        columns.forEach(function(column) {
            settings.aircraftProfitability.hideColumn.forEach(function(hideColumn) {
                if (column.data == hideColumn) {
                    column.visible = 0;
                }
            });
        });
    }

    let key = server + airline.id + 'aircraftFleet';
    //Get storage fleet data
    dashboardStorage.get(key, function(result) {
        //get aircraft flight data
        let aircraftFleetData = result[key];
        if (aircraftFleetData) {
            let keys = [];
            aircraftFleetData.fleet.forEach(function(value) {
                keys.push(server + 'aircraftFlights' + value.aircraftId);
            });
            dashboardStorage.get(keys, function(result) {
                for (let aircraftFlightData in result) {
                    for (let i = 0; i < aircraftFleetData.fleet.length; i++) {
                        if (aircraftFleetData.fleet[i].aircraftId == result[aircraftFlightData].aircraftId) {
                            aircraftFleetData.fleet[i].profit = {
                                date: result[aircraftFlightData].date,
                                finishedFlights: result[aircraftFlightData].finishedFlights,
                                profit: result[aircraftFlightData].profit,
                                profitFlights: result[aircraftFlightData].profitFlights,
                                time: result[aircraftFlightData].time,
                                totalFlights: result[aircraftFlightData].totalFlights,
                            };
                        }
                    }
                }
                let data = prepareAircraftProfitabilityData(aircraftFleetData);
                let tableDiv;
                if (data.length) {
                    tableDiv = generateTable({
                        column: columns,
                        data: data,
                        columnPrefix: 'aes-aircraftProfit-',
	                    tableSettings: 1,
	                    options: ['selectFirstSix','openAircraft', 'hideSelected', 'reloadTableAircraftProfit', 'removeAircraft'],
	                    filter: settings.aircraftProfitability.filter,
	                    hideColumn: settings.aircraftProfitability.hideColumn,
	                    tableSettingStorage: 'aircraftProfitability',
	                    onColumnChange: displayAircraftProfitability
	                });
                } else {
                    //Never happens or only when fleet = 0 because of updated script this output is copied bellow
                    tableDiv = $('<p class="warning"></p>').text('No aircraft data in memory. Open fleet management to extract aircraft data.')
                }
                //Div
                let div = $('<div class="as-panel"></div>').append(tableDiv);
                let mainDiv = $("#aes-div-dashboard");
                //Build layout
                mainDiv.empty();
                let title = $('<h3></h3>').text('Aircraft Profitability');
                mainDiv.append(title, div);

            });
        } else {
            //No data
            //Div
            let tableDiv = $('<p class="warning"></p>').text('No aircraft data in memory. Open fleet management to extract aircraft data.')
            let div = $('<div class="as-panel"></div>').append(tableDiv);
            let mainDiv = $("#aes-div-dashboard");
            //Build layout
            mainDiv.empty();
            let title = $('<h3></h3>').text('Aircraft Profitability');
            mainDiv.append(title, div);
        }
    });

    function prepareAircraftProfitabilityData(storage) {
        let data = [];
        storage.fleet.forEach(function(value) {
            let profit = {};
            if (value.profit) {
                profit.totalFlights = value.profit.totalFlights;
                profit.finishedFlights = value.profit.finishedFlights;
                profit.profitFlights = value.profit.profitFlights;
                profit.profit = value.profit.profit;
                profit.dateProfit = AES.formatDateString(value.profit.date) + ' ' + value.profit.time;
            }
            data.push({
                aircraftId: value.aircraftId,
                registration: value.registration,
                equipment: value.equipment,
                fleet: value.fleet,
                nickname: value.nickname,
                note: value.note,
                age: value.age,
                maintenance: value.maintenance,
                dateAircraft: AES.formatDateString(value.date) + ' ' + value.time,
                totalFlights: profit.totalFlights,
                finishedFlights: profit.finishedFlights,
                profitFlights: profit.profitFlights,
                profit: profit.profit,
                dateProfit: profit.dateProfit
            });
        });
        return data;
    }
}

//Auto table generator
function generateTable(tableOptionsRule) {
    let dashboardTable = buildDashboardTable({
        columns: tableOptionsRule.column,
        data: tableOptionsRule.data,
        columnPrefix: tableOptionsRule.columnPrefix,
        selectable: !!tableOptionsRule.tableSettings,
        footer: true,
        rowId: function(dataValue) {
            let idColumn = tableOptionsRule.column.find(function(column) {
                return column.id;
            });
            return idColumn ? dataValue[idColumn.data] : null;
        }
    });
    applyDashboardTableFilters(dashboardTable.table, tableOptionsRule.filter || [], tableOptionsRule.column, 'titlecode', tableOptionsRule.columnPrefix);
    return $('<div></div>').append(buildGeneratedDashboardTableSettings(tableOptionsRule, dashboardTable.table), dashboardTable.tableWell);
}
//Display general helper functions
function generalAddScheduleRow(tbody) {
    let td1 = $('<td></td>').text("Schedule");
    let td2 = $('<td></td>');
    let td3 = $('<td></td>');
    let row = $('<tr></tr>').append(td1, td2, td3);
    tbody.append(row);
    //Get schedule
    let scheduleKey = server + airline.id + 'schedule';
    dashboardStorage.get([scheduleKey], function(result) {
        let scheduleData = result[scheduleKey];
        if (scheduleData) {
            let lastUpdate = getDate('schedule', scheduleData.date);
            let diff = AES.getDateDiff([todayDate.date, lastUpdate]);
            let span = $('<span></span>').text('Last schedule extract ' + AES.formatDateString(lastUpdate) + ' (' + diff + ' days ago). Extract new schedule if there are new routes.');
            if (diff >= 0 && diff < 7) {
                span.addClass('good');
            } else {
                span.addClass('warning');
            }
            td2.append(span);
            generalUpdateScheduleAction(td3);



        } else {
            //no schedule
            td2.html('<span class="bad">No Schedule data found. Extract schedule or some AES parts will not work</span>');
            generalUpdateScheduleAction(td3);
        }
    });
}

function generalUpdateScheduleAction(td3) {
    let btn = $('<button type="button" class="btn btn-default">Extract schedule data</button>');
    btn.click(function() {
        settings.schedule.autoExtract = 1;
        //get schedule link
        let link = $('#enterprise-dashboard table:eq(0) tfoot td a:eq(2)');
        dashboardStorage.set({ settings: settings }, function() {
            link[0].click();
        });
    });
    td3.append(btn);
}

function generalAddPersonnelManagementRow(tbody) {
    let td = [];
    td.push($('<td></td>').text("Personnel Management"));
    td.push($('<td></td>'));
    td.push($('<td></td>'));
    let row = $('<tr></tr>').append(td);
    tbody.append(row);
    //Get Status
    let key = server + airline.id + 'personnelManagement';
    dashboardStorage.get([key], function(result) {
        let personnelManagementData = result[key];
        if (personnelManagementData) {
            let lastUpdate = personnelManagementData.date;
            let diff = AES.getDateDiff([todayDate.date, lastUpdate]);
            let span = $('<span></span>').text('Last personnel salary update: ' + AES.formatDateString(lastUpdate) + ' (' + diff + ' days ago).');
            if (diff >= 0 && diff < 7) {
                span.addClass('good');
            } else {
                span.addClass('warning');
            }
            td[1].append(span);
        } else {
            //no schedule
            td[1].html('<span class="bad">No personnel salary update date found.</span>');
        }
    });

    //Action
    let btn = $('<button type="button" class="btn btn-default">Open personnel management</button>');
    btn.click(function() {
        //get schedule link
        let link = $('#as-navbar-main-collapse > ul > li:eq(4) > ul > li:eq(5) > a');
        link[0].click();
    });
    td[2].append(btn);
}
//Display  default
function displayDefault() {
    let mainDiv = $("#aes-div-dashboard");
    mainDiv.empty();
}

//Table sort and other functions
function SortTable(column, number, tableId, columnPrefix) {
    let tableRows = $('#' + tableId + ' tbody tr');
    let tableBody = $('#' + tableId + ' tbody');
    tableBody.empty();
    let indexes = [];
    tableRows.each(function() {
        if (number) {
            let value = parseFloat($(this).find("." + columnPrefix + column).text());
            if (value) {
                indexes.push(value);
            } else {
                indexes.push(0);
            }
        } else {
            indexes.push($(this).find("." + columnPrefix + column).text());
        }
    });
    indexes = [...new Set(indexes)];
    let sorted = [...indexes];
    if (number) {
        sorted.sort(function(a, b) {
            if (a > b) return -1;
            if (a < b) return 1;
            if (a = b) return 0;
        });
    } else {
        sorted.sort();
    }
    let same = 1;
    for (let i = 0; i < indexes.length; i++) {
        if (indexes[i] !== sorted[i]) {
            same = 0;
        }
    }
    if (same) {
        if (number) {
            sorted.sort(function(a, b) {
                if (a < b) return -1;
                if (a > b) return 1;
                if (a = b) return 0;
            });
        } else {
            sorted.reverse();
        }
    }
    for (let i = 0; i < sorted.length; i++) {
        for (let j = tableRows.length - 1; j >= 0; j--) {
            if (number) {
                let value = parseFloat($(tableRows[j]).find("." + columnPrefix + column).text());
                if (!value) {
                    value = 0;
                }
                if (value == sorted[i]) {
                    tableBody.append($(tableRows[j]));
                    tableRows.splice(j, 1);
                }
            } else {
                if ($(tableRows[j]).find("." + columnPrefix + column).text() == sorted[i]) {
                    tableBody.append($(tableRows[j]));
                    tableRows.splice(j, 1);
                }
            }
        }
    }
}

//Helper
function getDate(type, scheduleData) {
    switch (type) {
        case 'schedule':
            //scheduleData must be schedule object with dates as properties
            let dates = [];
            for (let date in scheduleData) {
                if (Number.isInteger(parseInt(date))) {
                    dates.push(date);
                }
            }
            dates.reverse();
            return dates[0];
        default:
            return 0;
    }
}
