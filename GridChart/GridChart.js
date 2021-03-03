define(["jquery", "css!./gridchart.css", "./d3.min"], function($, cssContent) {
    'use strict';

    var GridChart = {};

    GridChart.Executors = {};

    GridChart.Executors.series = function (tasks, callback) {
        var nTasks = tasks.length;
        var results = [];
        for (var taskN = 0; taskN < nTasks; ++taskN) {
            results.push(null);
        }

        var currTaskN = 0;
        var callbackCalled = false;

        var finish = function (e) {
            if (!callbackCalled) {
                if (e != null) {
                    console.error(e);
                }
                callbackCalled = true;
                callback(e, results);
            }
        }

        var executeNext = function () {
            if (currTaskN >= nTasks) {
                finish();
            } else {
                var task = tasks[currTaskN];

                try {
                    task(function (e, result) {
                        if (e != null) return finish(e);

                        results[currTaskN] = result;

                        ++currTaskN;
                        executeNext();
                    })
                } catch (e) {
                    finish(e);
                }
            }
        }

        executeNext();
    }

    GridChart.Executors.parallel = function (tasks, callback) {
        var nTasks = tasks.length;
        var results = [];

        for (var resultN = 0; resultN < nTasks; ++resultN) {
            results.push(null);
        }

        var finishedTaskN = 0;
        var callbackCalled = false;

        var finish = function (e) {
            if (!callbackCalled) {
                if (e != null) {
                    console.error(e);
                }
                callbackCalled = true;
                callback(e, results);
            }
        }

        var executeTask = function (taskN) {
            var task = tasks[taskN];

            try {
                task(function (e, result) {
                    if (e != null) return finish(e);

                    results[taskN] = result;
                    ++finishedTaskN;

                    if (finishedTaskN >= nTasks) {
                        finish();
                    }
                })
            } catch (e) {
                finish(e);
            }
        }

        for (var taskN = 0; taskN < nTasks; ++taskN) {
            executeTask(taskN);
        }
    }

    GridChart.Executors.executeAfterIdle = function (delay, callback) {
        var state = {
            timeoutId: null,
            touchTime: null
        }

        return {
            touch: function () {
                state.touchTime = Date.now();

                if (state.timeoutId == null) {
                    var onTimeout = function () {
                        var now = Date.now();
                        var elapsed = now - state.touchTime;
                        var timeLeft = delay - elapsed;

                        if (timeLeft > 0) {
                            state.timeoutId = setTimeout(onTimeout, timeLeft);
                        } else {
                            state.timeoutId = null;
                            state.touchTime = null;
                            callback();
                        }
                    }
                    state.timeoutId = setTimeout(onTimeout, delay);
                }
            }
        }
    }

    var vizNCols = 4;
    var batchSize = 1000;

    //$("<style>").html(cssContent).appendTo("head");
    return {
        initialProperties: {
            version: 1.0,
            qHyperCubeDef: {
                qDimensions: [],
                qMeasures: [],
                qInitialDataFetch: [{
                    qWidth: vizNCols,
                    qHeight: batchSize
                }]
            }
        },
        definition: {
            type: "items",
            component: "accordion",
            items: {
                dimensions: {
                    uses: "dimensions",
                    min: 2,
                    max: 2
                },
                measures: {
                    uses: "measures",
                    min: 1,
                    max: 2,
                    items: {
                        Note: {
                            label: "Note :- 1st Measure if for Transparency, BG for circle & Color is for value",
                            component: "text"
                        },
                        Note2: {
                            label: "Note :- 2nd Measure is for circle size (Transparency, BG & Color will not work)",
                            component: "text"
                        },
                        Bubblecolor: {
                            type: "string",
                            ref: "qAttributeExpressions.0.qExpression",
                            label: "Bubble Color",
                            //expression: "always",
                            component: "expression",
                            defaultValue: "=rgb(255,0,0)"
                        },
                        Textcolor: {
                            type: "string",
                            ref: "qAttributeExpressions.1.qExpression",
                            label: "Text Color",
                            //expression: "always",
                            component: "expression",
                            defaultValue: "=rgb(0,0,0)"
                        }
                    }
                },
                sorting: {
                    uses: "sorting"
                },
                settings: {
                    uses: "settings",
                    items: {
                        colorPanel: {
                            type: "items",
                            label: "Color",
                            items: {
                                circleSize: {
                                    ref: "circleSize",
                                    label: "Circle Size",
                                    type: "number",
                                    defaultValue: 80
                                },
                                Color: {
                                    ref: "nodeColor.value",
                                    label: "Color",
                                    type: "string",
                                    defaultValue: "#4682B4"
                                },
                                Transparency: {
                                    ref: "nodeColor.transSwitch",
                                    component: "switch",
                                    type: "boolean",
                                    label: "Transparency",
                                    options: [{
                                        value: true,
                                        label: "On"
                                    }, {
                                        value: false,
                                        label: "Off"
                                    }],
                                    defaultValue: false
                                }
                            }
                        },
                        textPanel: {
                            type: 'items',
                            label: 'Text',
                            items: {
                                showText: {
                                    ref: 'nodeText.show',
                                    label: 'Show item text',
                                    type: 'boolean',
                                    defaultValue: true,
                                    options: [
                                        {
                                            value: true,
                                            label: "Show"
                                        },
                                        {
                                            value: false,
                                            label: "Hide"
                                        }
                                    ]
                                },
                                rotateLabels: {
                                    ref: 'xAxis.labels.rotate',
                                    label: 'Rotate X Labels',
                                    type: 'boolean',
                                    defaultValue: false,
                                    options: [
                                        {
                                            value: true,
                                            label: 'Rotate'
                                        },
                                        {
                                            value: false,
                                            label: 'Don\'t Rotate'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        snapshot: {
            canTakeSnapshot: true
        },
        support: {
            snapshot: true,
            export: true,
            exportData: true
        },
        paint: function($element, layout) {
            // Create a reference to the app, which will be used later to make selections
            var self = this;

            var vizOpts = layout.qHyperCube;
            var totalItems = vizOpts.qSize.qcy;

            // collect the data
            var qMatrix = layout.qHyperCube.qDataPages[0].qMatrix;

            var receivedItems = qMatrix.length;

            var extractItem = function (d) {
                return {
                    "Dim1": d[0].qText,
                    "Dim1_key": d[0].qElemNumber,
                    "Dim2": d[1].qText,
                    "Dim2_key": d[1].qElemNumber,
                    "Value": d[2].qNum,
                    "Text": d[2].qText,
                    //"InputColor": d[3] ? d[3].qText : "N/A"
                    "InputColor": d[2].qAttrExps.qValues["0"].qText,
                    "TextColor": d[2].qAttrExps.qValues["1"].qText,
                    "circleSize": d[3] ? d[3].qNum : layout.circleSize
                }
            }

            var renderViz = function (data) {
                // render
                var nodeTextOpts = layout.nodeText != null ? layout.nodeText : { show: true };
                var showNodeText = nodeTextOpts.show == true;

                var xAxisTextOpts = layout.xAxis || {};
                var xAxisLabelsOpts = xAxisTextOpts.labels || {};
                var rotateXAxis = xAxisLabelsOpts.rotate == true;

                // Get the selected counts for the 2 dimensions, which will be used later for custom selection logic
                var selections = {
                    dim1_count: layout.qHyperCube.qDimensionInfo[0].qStateCounts.qSelected,
                    dim2_count: layout.qHyperCube.qDimensionInfo[1].qStateCounts.qSelected
                };
                // Get the extension container properties
                var ext_prop = {
                    height: $element.height(),
                    width: $element.width(),
                    id: "container_" + layout.qInfo.qId
                };

                var containerId = "#" + ext_prop.id;
                var containerW = ext_prop.width;
                var containerH = ext_prop.height;

                // Get the user properties
                var user_prop = layout.nodeColor;
                // Create or empty the chart container
                if (document.getElementById(ext_prop.id)) {
                    $("#" + ext_prop.id).empty();
                } else {
                    $element.append($("<div />").attr("id", ext_prop.id).width(containerW).height(containerH));
                }
                // Draw the visualization
                viz(self, data, ext_prop, selections, user_prop);

                function viz(self, data, ext_prop, selections, user_prop) {
                    var mnItemHeight = 3;
                    var mnChartH = data.length*mnItemHeight;

                    var xAxisH = 20;

                    // define initial margin
                    var renderLayout = function (containerId, wrapperW, wrapperH, chartW, chartH, xAxisH, yAxisW) {
                        var container = d3.select(containerId);
                        var wrapper = container.append('div')
                                               .style('width', wrapperW + 'px')
                                               .style('height', wrapperH + 'px')
                                               .style('overflow-y', 'auto')
                                               .style('overflow-x', 'hidden')
                                               .style('margin-top', '0px')
                                               .style('margin-left', '0px');
                        var svg = wrapper.append("svg")
                                         .attr("width", wrapperW)
                                         .attr("height", chartH).append("g");
                        svg.attr("transform", "translate(" + yAxisW + ",0)");

                        return {
                            container: container,
                            wrapper: wrapper,
                            svg: svg
                        }
                    }

                    var renderAxis = function (container, data, wrapperW, wrapperH, chartW, chartH, xAxisH, yAxisW) {
                        var y = d3.scale.ordinal().domain(data.map(function(d) {
                            return d.Dim2;
                        })).rangeBands([0, chartH]);

                        var yAxis = d3.svg.axis().scale(y).orient("left");
                        var yAxis_g = svg.append("g").attr("class", "y axis").call(yAxis);

                        // Update y scale based on new chart height
                        y.rangeBands([0, chartH]);

                        var x = d3.scale.ordinal().domain(data.map(function(d) {
                            return d.Dim1;
                        })).rangeBands([0, chartW]);

                        //.orient("bottom").ticks(1).innerTickSize(-height)
                        var xAxis = d3.svg.axis().scale(x).outerTickSize(-chartH);

                        // create the initial x axis so we can determine it's height
                        var xAxisSvg = container.append('svg')
                                              .attr('width', wrapperW)
                                              .attr('height', xAxisH);
                        // xAxisSvg.attr('transform', 'translate(' + yAxisW + ',0)');
                        var xAxisG = xAxisSvg.append("g")
                                            .attr('transform', 'translate(' + yAxisW + ',0)')
                                            .attr("class", "x axis")
                                            .call(xAxis);
                        if (rotateXAxis) {
                            xAxisG.selectAll('text')
                                    .style('text-anchor', 'end')
                                    .attr('transform', 'translate(-8,0)rotate(-45)');
                        }

                        return {
                            y: y,
                            yAxisG: yAxis_g,
                            x: x,
                            xAxisSvg: xAxisSvg,
                            xAxisG: xAxisG
                        }
                    }

                    // Define the div for the tooltip
                    var tooltip = d3.select("body").append("div").attr("class", "Gridtooltip").style("opacity", 0);
                    // Define the width and height, which will match in this example
                    var wrapperW = containerW;
                    var wrapperH = containerH;

                    var chartW = wrapperW - 10;
                    var chartH = Math.max(wrapperH - 4, mnChartH);

                    // PHASE 1: Render, measure bounds and remove
                    var layoutResult = renderLayout(
                        containerId,
                        wrapperW,
                        wrapperH,
                        chartW,
                        chartH,
                        xAxisH,
                        0
                    );
                    var container = layoutResult.container;
                    var svg = layoutResult.svg;
                    var wrapper = layoutResult.wrapper;

                    var axisResult = renderAxis(
                        container,
                        data,
                        wrapperW,
                        wrapperH,
                        chartW,
                        chartH,
                        xAxisH,
                        0
                    );
                    var yAxisG = axisResult.yAxisG;
                    var xAxisG = axisResult.xAxisG;
                    var xAxisSvg = axisResult.xAxisSvg;

                    var yAxisRealW = yAxisG[0][0].getBoundingClientRect().width;

                    // find the largest axis element
                    var xAxisRealH = xAxisH;
                    var currLabel = xAxisG[0][0].firstChild;
                    while (currLabel != null) {
                        var currLabelH = currLabel.getBoundingClientRect().height;
                        if (currLabelH > xAxisRealH) {
                            xAxisRealH = currLabelH;
                        }

                        currLabel = currLabel.nextSibling;
                        if (currLabel.localName != 'g') { currLabel = null; }
                    }

                    wrapper.remove();
                    yAxisG.remove();
                    xAxisSvg.remove();

                    var realWrapperH = containerH - xAxisRealH;
                    var realWrapperW = wrapperW;
                    var realChartW = chartW - yAxisRealW - 10;
                    // var realChartH = chartH;
                    var realChartH = Math.max(realWrapperH - 4, mnChartH);

                    // PHASE 2: Render the chart and axis
                    var layoutResult = renderLayout(
                        containerId,
                        realWrapperW,
                        realWrapperH,
                        realChartW,
                        realChartH,
                        xAxisRealH,
                        yAxisRealW
                    )
                    var container = layoutResult.container;
                    var svg = layoutResult.svg;
                    var wrapper = layoutResult.wrapper;

                    var axisResult = renderAxis(
                        container,
                        data,
                        realWrapperW,
                        realWrapperH,
                        realChartW,
                        realChartH,
                        xAxisRealH,
                        yAxisRealW
                    );
                    var y = axisResult.y;
                    var yAxisG = axisResult.yAxisG;
                    var x = axisResult.x;
                    var xAxisG = axisResult.xAxisG;
                    var xAxisSvg = axisResult.xAxisSvg;

                    // Create a scale for the bubble size
                    var max_r = Math.min(x.rangeBand(), y.rangeBand()) / 2;
                    var min_to_max_ratio = d3.min(data, function(d) {
                        return d.Value
                    }) / d3.max(data, function(d) {
                        return d.Value
                    });
                    var min_r = max_r * min_to_max_ratio;
                    var r = d3.scale.linear().domain([d3.min(data, function(d) {
                        return d.Value;
                    }), d3.max(data, function(d) {
                        return d.Value
                    })]).range([min_r, max_r]);
                    // Create an opacity scale
                    var opacity = d3.scale.linear().domain([d3.min(data, function(d) {
                        return d.Value
                    }), d3.max(data, function(d) {
                        return d.Value
                    })]).range([min_to_max_ratio, 1]);
                    // Add the circles
                    var circles = svg.selectAll(".circles")
                                        .data(data)
                                        .enter()
                                        .append("g")
                                        .attr("class", "gcircle")
                                        .append("circle")
                                        .attr("class", "circles")
                                        .attr("cx", function(d) {
                            // center point of the circle
                            return x(d.Dim1) + x.rangeBand() / 2;
                        }).attr("cy", function(d) {
                            return y(d.Dim2) + y.rangeBand() / 2;
                        })
                        //.attr("r",function(d) { console.log(r); return r(d.Value)})
                        .attr("r", function(d) {
                            var radius = r(d.circleSize);
                            return radius;
                        }).attr("fill", function(d) {
                            return d.InputColor == undefined ? user_prop.value : ARGBtoRGBA(d.InputColor);
                        }).on("mouseover", function(d) {
                            //tooltip.transition().duration(200).style("opacity", .9);
                            //tooltip.html(d.Text ).style("left", (d3.event.pageX) + "px").style("top", (d3.event.pageY - 28) + "px");
                        }).on("mouseout", function(d) {
                            //tooltip.transition().duration(500).style("opacity", 0);
                        });;
                    //.attr("fill",function(d) { console.log(d); return ARGBtoRGBA(d.qAttrExps.qValues["0"].qText);});
                    // Add title text for the circles
                    circles.append("title").text(function(d) {
                        return d.Text;
                    });

                    // Add the circles Text
                    if (showNodeText) {
                        svg.selectAll(".gcircle").append("text").attr("x", function(d) {
                            return (x(d.Dim1) + x.rangeBand() / 2);
                        }).attr("y", function(d) {
                            return (y(d.Dim2) + y.rangeBand() / 2);
                        }).attr("font-size", "1.2em").attr("text-anchor", "middle").attr("alignment-baseline", "central").attr("fill", function(d) {
                            return d.TextColor;
                        }).text(function(d) {
                            return d.Text;
                        }).append("title").text(function(d) {
                            return d.Text;
                        });
                    }

                    // Add the selection logic on clicking the circles
                    circles.on("click", function(d) {
                        // Logic for appropriate circle selection
                        if (selections.dim1_count != 1 && selections.dim2_count == 1) {
                            self.backendApi.selectValues(0, [d.Dim1_key], true);
                        } else if (selections.dim2_count != 1 && selections.dim1_count == 1) {
                            self.backendApi.selectValues(1, [d.Dim2_key], true);
                        } else {
                            self.backendApi.selectValues(0, [d.Dim1_key], true);
                            self.backendApi.selectValues(1, [d.Dim2_key], true);
                        }
                    });
                    // Add transparency if the user enabled it
                    if (user_prop.transSwitch == true) {
                        circles.attr("fill-opacity", function(d) {
                            return opacity(d.Value)
                        })
                    }
                    // x-axis click to select
                    d3.selectAll(".x.axis .tick").on("click", function(d) {
                        self.backendApi.selectValues(0, [getProp(data, "Dim1", d, "Dim1_key")], true);
                    });
                    // y-axis click to select
                    d3.selectAll(".y.axis .tick").on("click", function(d) {
                        self.backendApi.selectValues(1, [getProp(data, "Dim2", d, "Dim2_key")], true);
                    });
                };
                // Helper functions
                function distinctValues(array, prop) {
                    var values = [];
                    array.forEach(function(d) {
                        if (values.indexOf(d[prop]) == -1) {
                            values.push(d[prop]);
                        }
                    })
                    return values;
                }

                function getProp(array, source_prop, source_val, target_prop) {
                    var output;
                    for (var i = 0; i <= array.length; i++) {
                        if (array[i][source_prop] == source_val) {
                            output = array[i][target_prop];
                            break;
                        }
                    }
                    return output;
                }

                function ARGBtoRGBA(text) {
                    if (text.slice([0], [3]).toLowerCase() === "rgb") {
                        return text;
                    } else if (text.slice([0], [4]).toLowerCase() === "argb") {
                        var new_a_val = text.slice([5], [text.indexOf(",")]) / 255;
                        return "rgba(" + text.slice([text.indexOf(",") + 1]).replace(")", "") + "," + new_a_val + ")"
                    }
                }
            }

            var data = qMatrix.map(extractItem);

            // if (receivedItems < totalItems) {
                // fetch additional items
            var totalBatches = Math.ceil(totalItems / batchSize);
            var fetchBatches = totalBatches - 1;

            var fetchTask = function (offset, limit) {
                return function (callback) {
                    var pageOpts = [{
                        qTop: offset,
                        qLeft: 0,
                        qWidth: vizNCols,
                        qHeight: limit
                    }]
                    console.log('fetching batch, offset: ' + offset);
                    self.backendApi.getData(pageOpts).then(function (dataPages) {
                        console.log('received result for offset: ' + offset);
                        callback(null, dataPages);
                    })
                }
            }

            var fetchTasks = [];
            for (var taskN = 0; taskN < fetchBatches; ++taskN) {
                var offset = (taskN+1)*batchSize;
                var limit = batchSize;
                fetchTasks.push(fetchTask(offset, limit))
            }

            console.log('fetching ' + fetchTasks.length + ' batches')
            GridChart.Executors.series(fetchTasks, function (e, dataPagesArr) {
                if (e != null) {
                    console.error('Failed to fetch data for the visualization!');
                }

                for (var batchN = 0; batchN < dataPagesArr.length; ++batchN) {
                    var dataArr = dataPagesArr[batchN];
                    var qMatrix = dataArr[0].qMatrix;
                    var batch = qMatrix.map(extractItem);
                    data = data.concat(batch);
                }

                console.log('rendering visualization with ' + data.length + ' items')
                renderViz(data);
            })
        }
    };
});
