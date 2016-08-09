/*global Chart, updateVisualizer */

$(document).ready(function () {
    var $material = $("#SelectedMaterialId");
    var $temp = $("#Temperature");
    var $time = $("#DwellTime");
    var $tempVal = $("#tempValue");
    var $timeVal = $("#timeValue");

    var $surfaceFactor = $("#surfaceFactor");
    var $minLength = $("#minLength");
    var $constraintStatus = $("#constraintStatus");
    var $interpMode = $("#interpMode");

    var $optStatus = $("#optStatus");
    var $targetFactor = $("#targetFactor");

    var $expNote = $("#expNote");
    var $expTable = $("#expTable");

    var myChart;
    var surfaceCache = {}; // key: materialId|factor

    var pendingTimer = null;
    var lastResult = null;
    var calculateRequest = null;
    var curveRequest = null;
    var surfaceRequest = null;
    var lastRequestAt = 0;
    var minRequestIntervalMs = 25;

    function debounceCalculate() {
        if (pendingTimer) {
            clearTimeout(pendingTimer);
        }
        var now = Date.now();
        var wait = Math.max(0, minRequestIntervalMs - (now - lastRequestAt));
        pendingTimer = setTimeout(function () {
            lastRequestAt = Date.now();
            calculateAndUpdate();
        }, wait);
    }

    // Sliders
    $temp.on("input", function () {
        $tempVal.text($(this).val());
        debounceCalculate();
    });

    $time.on("input", function () {
        $timeVal.text($(this).val());
        debounceCalculate();
    });

    $material.change(function () {
        surfaceCache = {};
        debounceCalculate();
        refreshExperiments();
    });

    $surfaceFactor.change(function () {
        debounceCalculate();
    });

    $minLength.on("input", function () {
        updateConstraints();
    });

    // Presets
    $("#presetLow").click(function () {
        setControls(80, 3);
    });
    $("#presetBalanced").click(function () {
        setControls(130, 8);
    });
    $("#presetMax").click(function () {
        setControls(200, 20);
    });
    $("#presetSafe").click(function () {
        setControls(110, 2);
    });

    function setControls(t, d) {
        $temp.val(t);
        $time.val(d);
        $tempVal.text(t);
        $timeVal.text(d);
        debounceCalculate();
    }

    // Optimize
    $("#btnOptimize").click(function () {
        $optStatus.text("Searching...");

        $.post("/Simulator/Optimize", {
            materialId: parseInt($material.val(), 10),
            factor: "length",
            target: parseFloat($targetFactor.val())
        }).done(function (res) {
            $optStatus.text("Found T=" + res.temperature + ", D=" + res.dwellTime + " (score=" + res.score.toFixed(4) + ")");
            setControls(res.temperature, res.dwellTime);
        }).fail(function () {
            $optStatus.text("Optimize failed. Check server logs.");
        });
    });

    // Experiment log
    $("#btnLog").click(function () {
        if (!lastResult) return;
        var entry = {
            materialId: parseInt($material.val(), 10),
            temperature: parseFloat($temp.val()),
            dwellTime: parseFloat($time.val()),
            lengthFactor: lastResult.lengthFactor,
            widthFactor: lastResult.widthFactor,
            sleeveFactor: lastResult.sleeveFactor,
            note: $expNote.val() || ""
        };

        $.post("/Simulator/Log", entry).done(function () {
            $expNote.val("");
            refreshExperiments();
        }).fail(function () {
            alert("Log failed. Check server logs.");
        });
    });

    $("#btnExportCsv").click(function () {
        exportCsv();
    });

    function exportCsv() {
        $.getJSON("/Simulator/Experiments", function (rows) {
            var header = ["unixMs", "materialId", "temperature", "dwellTime", "lengthFactor", "widthFactor", "sleeveFactor", "note"].join(",");
            var lines = [header];
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                lines.push([
                    r.unixMs,
                    r.materialId,
                    r.temperature,
                    r.dwellTime,
                    r.lengthFactor,
                    r.widthFactor,
                    r.sleeveFactor,
                    '"' + String(r.note || "").replace(/"/g, '""') + '"'
                ].join(","));
            }

            var csv = lines.join("\n");
            var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            var url = URL.createObjectURL(blob);
            var a = document.createElement("a");
            a.href = url;
            a.download = "simulator_experiments.csv";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function refreshExperiments() {
        $.getJSON("/Simulator/Experiments", function (rows) {
            $expTable.empty();
            // render last 15 entries
            var start = Math.max(0, rows.length - 15);
            for (var i = rows.length - 1; i >= start; i--) {
                var r = rows[i];
                var dt = new Date(r.unixMs);
                var tr = "<tr>" +
                    "<td>" + dt.toLocaleTimeString() + "</td>" +
                    "<td>" + r.materialId + "</td>" +
                    "<td>" + r.temperature + "</td>" +
                    "<td>" + r.dwellTime + "</td>" +
                    "<td>" + r.lengthFactor.toFixed(3) + "</td>" +
                    "<td>" + r.widthFactor.toFixed(3) + "</td>" +
                    "<td>" + r.sleeveFactor.toFixed(3) + "</td>" +
                    "</tr>";
                $expTable.append(tr);
            }
        });
    }

    // Charts
    initChart();

    function initChart() {
        var chartCtx = document.getElementById("shrinkageChart");
        if (!chartCtx) return;
        myChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Length Factor (curve)',
                        data: [],
                        borderColor: "rgba(75,192,192,1)",
                        fill: false,
                        pointRadius: 0
                    },
                    {
                        label: 'Current setting',
                        data: [],
                        borderColor: "rgba(255,99,132,1)",
                        backgroundColor: "rgba(255,99,132,1)",
                        fill: false,
                        showLine: false,
                        pointRadius: 5
                    }
                ]
            },
            options: {
                responsive: true,
                animation: { duration: 0 },
                tooltips: { enabled: true },
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: false,
                            suggestedMin: 0.80,
                            suggestedMax: 1.10
                        }
                    }],
                    xAxes: [{
                        type: 'linear',
                        position: 'bottom',
                        ticks: {
                            min: 30,
                            max: 200,
                            stepSize: 20
                        }
                    }]
                }
            }
        });
    }

    function updateCurveChart(materialId, dwellTime, currentTemp, currentLength) {
        if (curveRequest && curveRequest.readyState !== 4) {
            curveRequest.abort();
        }
        curveRequest = $.post("/Simulator/Curve", {
            materialId: materialId,
            dwellTime: dwellTime,
            startTemperature: 30,
            endTemperature: 200,
            step: 10
        }).done(function (res) {
            // Use {x,y} pairs so we can use a linear x-axis and place the marker correctly.
            var points = [];
            for (var i = 0; i < res.temperatures.length; i++) {
                points.push({ x: res.temperatures[i], y: res.length[i] });
            }

            myChart.data.labels = []; // not used in linear mode
            myChart.data.datasets[0].label = "Length Factor (dwell=" + dwellTime + ")";
            myChart.data.datasets[0].data = points;
            myChart.data.datasets[1].data = [{ x: currentTemp, y: currentLength }];
            myChart.update();
        }).fail(function () {
            console.warn("Curve request failed.");
        });
        return curveRequest;
    }

    // Surface / contours
    function updateSurface(materialId, factor, marker) {
        var key = materialId + "|" + factor;
        var dfd = $.Deferred();
        if (surfaceCache[key]) {
            drawContours(surfaceCache[key], marker);
            dfd.resolve();
            return dfd.promise();
        }

        if (surfaceRequest && surfaceRequest.readyState !== 4) {
            surfaceRequest.abort();
        }
        surfaceRequest = $.post("/Simulator/Surface", {
            materialId: materialId,
            factor: factor,
            startTemperature: 30,
            endTemperature: 200,
            stepTemperature: 10,
            startDwellTime: 1,
            endDwellTime: 20,
            stepDwellTime: 1
        }).done(function (res) {
            surfaceCache[key] = res;
            drawContours(res, marker);
        }).fail(function () {
            console.warn("Surface request failed.");
        });
        return surfaceRequest;
    }

    function drawContours(surface, marker) {
        var canvas = document.getElementById("surfaceCanvas");
        if (!canvas) return;
        var ctx = canvas.getContext("2d");

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Layout
        var padL = 35, padR = 10, padT = 10, padB = 25;
        var w = canvas.width - padL - padR;
        var h = canvas.height - padT - padB;

        // Axes
        ctx.strokeStyle = "#aaa";
        ctx.beginPath();
        ctx.moveTo(padL, padT);
        ctx.lineTo(padL, padT + h);
        ctx.lineTo(padL + w, padT + h);
        ctx.stroke();

        var temps = surface.temperatures;
        var dwells = surface.dwellTimes;
        var values = surface.values;

        // Determine contour levels
        var minV = 999, maxV = -999;
        for (var i = 0; i < values.length; i++) {
            for (var j = 0; j < values[i].length; j++) {
                var v = values[i][j];
                if (v < minV) minV = v;
                if (v > maxV) maxV = v;
            }
        }

        // subtle heatmap background (grid fill)
        drawHeatmap(ctx, padL, padT, w, h, temps, dwells, values, minV, maxV);

        // 6 contour levels
        var levels = [];
        var n = 6;
        for (var k = 1; k <= n; k++) {
            levels.push(minV + (k / (n + 1)) * (maxV - minV));
        }

        // Marching squares
        for (var li = 0; li < levels.length; li++) {
            var level = levels[li];
            ctx.strokeStyle = contourColor(li, levels.length);
            ctx.lineWidth = 1;
            ctx.beginPath();

            for (var di = 0; di < dwells.length - 1; di++) {
                for (var ti = 0; ti < temps.length - 1; ti++) {
                    var v00 = values[di][ti];
                    var v10 = values[di][ti + 1];
                    var v01 = values[di + 1][ti];
                    var v11 = values[di + 1][ti + 1];

                    var idx = 0;
                    if (v00 >= level) idx |= 1;
                    if (v10 >= level) idx |= 2;
                    if (v11 >= level) idx |= 4;
                    if (v01 >= level) idx |= 8;
                    if (idx === 0 || idx === 15) continue;

                    // cell corners in canvas space
                    var x0 = padL + (ti / (temps.length - 1)) * w;
                    var x1 = padL + ((ti + 1) / (temps.length - 1)) * w;
                    var y0 = padT + (di / (dwells.length - 1)) * h;
                    var y1 = padT + ((di + 1) / (dwells.length - 1)) * h;

                    // Edge interpolation helpers
                    function lerp(a, b, va, vb) {
                        if (vb - va === 0) return (a + b) / 2;
                        return a + (level - va) * (b - a) / (vb - va);
                    }

                    var e0x = lerp(x0, x1, v00, v10);
                    var e0y = y0;
                    var e1x = x1;
                    var e1y = lerp(y0, y1, v10, v11);
                    var e2x = lerp(x0, x1, v01, v11);
                    var e2y = y1;
                    var e3x = x0;
                    var e3y = lerp(y0, y1, v00, v01);

                    // Cases: draw line segments
                    // Based on common marching squares lookup
                    switch (idx) {
                        case 1:
                        case 14:
                            moveLine(e3x, e3y, e0x, e0y);
                            break;
                        case 2:
                        case 13:
                            moveLine(e0x, e0y, e1x, e1y);
                            break;
                        case 3:
                        case 12:
                            moveLine(e3x, e3y, e1x, e1y);
                            break;
                        case 4:
                        case 11:
                            moveLine(e1x, e1y, e2x, e2y);
                            break;
                        case 5:
                            moveLine(e3x, e3y, e2x, e2y);
                            moveLine(e0x, e0y, e1x, e1y);
                            break;
                        case 6:
                        case 9:
                            moveLine(e0x, e0y, e2x, e2y);
                            break;
                        case 7:
                        case 8:
                            moveLine(e3x, e3y, e2x, e2y);
                            break;
                        case 10:
                            moveLine(e3x, e3y, e0x, e0y);
                            moveLine(e1x, e1y, e2x, e2y);
                            break;
                    }

                    function moveLine(ax, ay, bx, by) {
                        ctx.moveTo(ax, ay);
                        ctx.lineTo(bx, by);
                    }
                }
            }

            ctx.stroke();

            // Label each contour level
            ctx.fillStyle = "#666";
            ctx.font = "10px Arial";
            ctx.fillText(level.toFixed(3), padL + w + 2, padT + 12 + li * 12);
        }

        // Axis labels
        ctx.fillStyle = "#666";
        ctx.font = "10px Arial";
        ctx.fillText("T", padL + w - 8, padT + h + 18);
        ctx.fillText("D", 8, padT + 10);

        // Marker for current setting
        if (marker) {
            var mx = padL + ((marker.t - 30) / (200 - 30)) * w;
            var my = padT + ((marker.d - 1) / (20 - 1)) * h;
            ctx.fillStyle = "rgba(255,99,132,1)";
            ctx.beginPath();
            ctx.arc(mx, my, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawHeatmap(ctx, padL, padT, w, h, temps, dwells, values, minV, maxV) {
        // Draw semi-transparent cell rectangles to make the surface readable.
        // values[dIndex][tIndex]
        for (var di = 0; di < dwells.length - 1; di++) {
            for (var ti = 0; ti < temps.length - 1; ti++) {
                var v = values[di][ti];
                var t = (v - minV) / (maxV - minV || 1);
                if (t < 0) t = 0;
                if (t > 1) t = 1;

                // blue (high) -> red (low)
                var r = Math.round(220 * (1 - t) + 30 * t);
                var g = Math.round(80 + 60 * t);
                var b = Math.round(220 * t + 40 * (1 - t));

                var x0 = padL + (ti / (temps.length - 1)) * w;
                var x1 = padL + ((ti + 1) / (temps.length - 1)) * w;
                var y0 = padT + (di / (dwells.length - 1)) * h;
                var y1 = padT + ((di + 1) / (dwells.length - 1)) * h;

                ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.12)';
                ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
            }
        }
    }

    function contourColor(i, total) {
        // simple gradient (teal -> purple)
        var t = total <= 1 ? 0 : i / (total - 1);
        var r = Math.round(50 + 120 * t);
        var g = Math.round(160 - 100 * t);
        var b = Math.round(180 + 60 * t);
        return "rgb(" + r + "," + g + "," + b + ")";
    }

    function updateConstraints() {
        if (!lastResult) return;
        var minL = parseFloat($minLength.val());
        if (lastResult.lengthFactor >= minL) {
            $constraintStatus.removeClass("alert-danger").addClass("alert-success");
            $constraintStatus.text("OK: length factor >= " + minL.toFixed(2));
        } else {
            $constraintStatus.removeClass("alert-success").addClass("alert-danger");
            $constraintStatus.text("FAIL: length factor < " + minL.toFixed(2));
        }
    }

    function calculateAndUpdate() {
        showLoading(true);
        var data = {
            materialId: $material.val(),
            temperature: $temp.val(),
            dwellTime: $time.val()
        };

        if (calculateRequest && calculateRequest.readyState !== 4) {
            calculateRequest.abort();
        }
        calculateRequest = $.post("/Simulator/Calculate", data, function (result) {
            lastResult = result;
            $("#resLength").text(result.lengthFactor.toFixed(3));
            $("#resWidth").text(result.widthFactor.toFixed(3));
            $("#resSleeve").text(result.sleeveFactor.toFixed(3));

            // Warning logic
            if (result.lengthFactor < 0.95 || result.widthFactor < 0.95) {
                if ($("#warningMsg").length === 0) {
                    $("#resultsPanel").append('<div id="warningMsg" class="alert alert-danger" style="margin-top:10px">High Shrinkage Detected!</div>');
                }
            } else {
                $("#warningMsg").remove();
            }

            // Visualizer
            if (typeof updateVisualizer === "function") {
                updateVisualizer(result);
            }

            // Curve chart (single call)
            if (myChart) {
                updateCurveChart(parseInt($material.val(), 10), parseFloat($time.val()), parseInt($temp.val(), 10), result.lengthFactor);
            }

            // Contour surface
            updateSurface(parseInt($material.val(), 10), $surfaceFactor.val(), { t: parseFloat($temp.val()), d: parseFloat($time.val()) });

            // Constraints
            updateConstraints();

            // Explainability (simple)
            $interpMode.text("2D bilinear + fallbacks");
        }).always(function () {
            showLoading(false);
        });
    }

    function showLoading(isLoading) {
        // minimal loading indicator (overlay on results panel)
        if (isLoading) {
            if ($("#loadingOverlay").length === 0) {
                $("#resultsPanel").append('<div id="loadingOverlay" style="margin-top:10px" class="text-muted">Calculating...</div>');
            }
        } else {
            $("#loadingOverlay").remove();
        }
    }

    // Initial load
    refreshExperiments();
    calculateAndUpdate();
});
