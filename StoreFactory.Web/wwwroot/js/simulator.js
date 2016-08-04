$(document).ready(function () {
    var $material = $("#SelectedMaterialId");
    var $temp = $("#Temperature");
    var $time = $("#DwellTime");
    
    var $tempVal = $("#tempValue");
    var $timeVal = $("#timeValue");
    
    // Sliders
    $temp.on("input", function() {
        $tempVal.text($(this).val());
        calculate();
    });
    
    $time.on("input", function() {
        $timeVal.text($(this).val());
        calculate();
    });
    
    $material.change(calculate);
    
    function calculate() {
        var data = {
            materialId: $material.val(),
            temperature: $temp.val(),
            dwellTime: $time.val()
        };
        
        $.post("/Simulator/Calculate", data, function(result) {
            $("#resLength").text(result.lengthFactor.toFixed(3));
            $("#resWidth").text(result.widthFactor.toFixed(3));
            $("#resSleeve").text(result.sleeveFactor.toFixed(3));
            
            // Trigger Visualizer Update (Phase 4)
            if (typeof updateVisualizer === "function") {
                updateVisualizer(result);
            }
        });
    }
    
    // Chart
    var chartCtx = document.getElementById("shrinkageChart");
    if (chartCtx) {
        var myChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: [180, 185, 190, 195],
                datasets: [{
                    label: 'Shrinkage Factor',
                    data: [0.99, 0.985, 0.98, 0.97],
                    borderColor: "rgba(75,192,192,1)",
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: {
                    yAxes: [{
                        ticks: {
                            beginAtZero: false,
                            suggestedMin: 0.9,
                            suggestedMax: 1.1
                        }
                    }]
                }
            }
        });
    }

    // Initial Calc
    calculate();
});
