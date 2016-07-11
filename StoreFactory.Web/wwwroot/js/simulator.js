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
    
    // Initial Calc
    calculate();
});
