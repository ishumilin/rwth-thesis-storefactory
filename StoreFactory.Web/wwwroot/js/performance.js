/*global Chart */

// Performance analysis page script.
// Reads /data/analysis.json (precomputed) and renders performance charts.

$(document).ready(function () {
    var speedupChart;
    var efficiencyChart;
    var scalingChart;
    var overheadChart;

    initCharts();
    loadAnalysis();

    function initCharts() {
        var speedCtx = document.getElementById("perfSpeedupChart");
        if (speedCtx) {
            speedupChart = new Chart(speedCtx, {
                type: 'line',
                data: { datasets: [{
                    label: 'Speedup',
                    data: [],
                    borderColor: "rgba(255,99,132,1)",
                    fill: false,
                    pointRadius: 3
                }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    legend: { position: 'bottom', labels: { boxWidth: 10 } },
                    scales: {
                        yAxes: [{ ticks: { beginAtZero: true } }],
                        xAxes: [{ type: 'linear', position: 'bottom', ticks: { beginAtZero: true, stepSize: 1 } }]
                    }
                }
            });
        }

        var effCtx = document.getElementById("perfEfficiencyChart");
        if (effCtx) {
            efficiencyChart = new Chart(effCtx, {
                type: 'line',
                data: { datasets: [{
                    label: 'Efficiency',
                    data: [],
                    borderColor: "rgba(54,162,235,1)",
                    fill: false,
                    pointRadius: 3
                }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    legend: { position: 'bottom', labels: { boxWidth: 10 } },
                    scales: {
                        yAxes: [{ ticks: { beginAtZero: true, suggestedMax: 1 } }],
                        xAxes: [{ type: 'linear', position: 'bottom', ticks: { beginAtZero: true, stepSize: 1 } }]
                    }
                }
            });
        }

        var scaleCtx = document.getElementById("perfScalingChart");
        if (scaleCtx) {
            scalingChart = new Chart(scaleCtx, {
                type: 'line',
                data: { datasets: [{
                    label: 'Seconds',
                    data: [],
                    borderColor: "rgba(75,192,192,1)",
                    fill: false,
                    pointRadius: 3
                }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    legend: { position: 'bottom', labels: { boxWidth: 10 } },
                    scales: {
                        yAxes: [{ ticks: { beginAtZero: true } }],
                        xAxes: [{ type: 'linear', position: 'bottom', ticks: { beginAtZero: true, stepSize: 1 } }]
                    }
                }
            });
        }

        var overheadCtx = document.getElementById("perfOverheadChart");
        if (overheadCtx) {
            overheadChart = new Chart(overheadCtx, {
                type: 'bar',
                data: { labels: [], datasets: [{
                    label: 'Overhead (s)',
                    data: [],
                    backgroundColor: "rgba(153,102,255,0.5)",
                    borderColor: "rgba(153,102,255,1)",
                    borderWidth: 1
                }] },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 0 },
                    legend: { display: false },
                    scales: { yAxes: [{ ticks: { beginAtZero: true } }] }
                }
            });
        }
    }

    function loadAnalysis() {
        $.getJSON("/data/analysis_performance.json", function (data) {
            renderSummary(data);
            renderCharts(data);
        }).fail(function () {
            console.warn("Could not load /data/analysis_performance.json. Run python analysis scripts to generate it.");
        });
    }

    function renderSummary(data) {
        if (!data || !data.timing || !data.meta) return;
        $("#perfSpeedup").text(data.timing.speedup.toFixed(2) + "x");
        $("#perfSingle").text(data.timing.single_seconds.toFixed(3));
        $("#perfParallel").text(data.timing.parallel_seconds.toFixed(3));
        $("#perfRows").text(data.meta.rows);
        $("#perfWorkers").text(data.meta.workers);

        var peak = 0;
        if (data.performance && data.performance.efficiency) {
            data.performance.efficiency.forEach(function (point) {
                if (point.efficiency > peak) peak = point.efficiency;
            });
        }
        $("#perfEfficiency").text(peak.toFixed(2));
    }

    function renderCharts(data) {
        if (!data) return;

        if (speedupChart && data.scaling) {
            speedupChart.data.datasets[0].data = data.scaling.map(function (p) {
                return { x: p.workers, y: p.speedup };
            });
            speedupChart.update();
        }

        if (efficiencyChart && data.performance && data.performance.efficiency) {
            efficiencyChart.data.datasets[0].data = data.performance.efficiency.map(function (p) {
                return { x: p.workers, y: p.efficiency };
            });
            efficiencyChart.update();
        }

        if (scalingChart && data.scaling) {
            scalingChart.data.datasets[0].data = data.scaling.map(function (p) {
                return { x: p.workers, y: p.seconds };
            });
            scalingChart.update();
        }

        if (overheadChart && data.performance && data.performance.overhead) {
            overheadChart.data.labels = data.performance.overhead.map(function (p) { return p.workers; });
            overheadChart.data.datasets[0].data = data.performance.overhead.map(function (p) { return p.overhead; });
            overheadChart.update();
        }
    }
});