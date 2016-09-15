// Sweater Visualizer using HTML5 Canvas
var visualizer = (function() {
    var canvas, ctx;
    var dpr = 1;
    
    function init() {
        canvas = document.getElementById('sweaterCanvas');
        if (canvas) {
            // Use DPR-aware scaling so the 2D view stays crisp when the canvas
            // is responsive (CSS width: 100%).
            ctx = canvas.getContext('2d');
            setupHiDpiCanvas();

            // Recompute backing store on resize.
            window.addEventListener('resize', function () {
                setupHiDpiCanvas();
                drawSweater(lastShrinkage || { lengthFactor: 1, widthFactor: 1, sleeveFactor: 1 });
            });
            // Initial draw
            drawSweater({ lengthFactor: 1, widthFactor: 1, sleeveFactor: 1 });
        }
    }

    var lastShrinkage = null;

    function setupHiDpiCanvas() {
        if (!canvas || !ctx) return;

        dpr = window.devicePixelRatio || 1;

        // Desired CSS display size
        var cssWidth = canvas.clientWidth || canvas.width;
        var cssHeight = canvas.clientHeight || canvas.height;

        // If height collapses to 0 (e.g., display:none), fall back to attribute.
        if (!cssHeight || cssHeight < 10) {
            // Maintain aspect ratio from attributes
            var aspect = canvas.height / canvas.width;
            cssHeight = Math.round(cssWidth * aspect);
        }

        // Set the backing store size in actual pixels
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);

        // Normalize drawing units to CSS pixels
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Improve line quality
        ctx.imageSmoothingEnabled = true;
    }
    
    function drawSweater(shrinkage) {
        if (!ctx) return;

        lastShrinkage = shrinkage;
        
        // canvas.width/height are in device pixels; drawing is in CSS pixels
        var w = (canvas.width / dpr);
        var h = (canvas.height / dpr);
        ctx.clearRect(0, 0, w, h);
        
        var centerX = w / 2;
        var topY = 50;
        
        // Base Dimensions (Pixels)
        var bodyWidth = 200;
        var bodyLength = 300;
        var sleeveLength = 150;
        
        // Draw Original (Ghost)
        ctx.strokeStyle = '#cccccc';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        drawShape(centerX, topY, bodyWidth, bodyLength, sleeveLength);
        
        // Heat/tension coloring based on magnitude of shrink
        var avg = (shrinkage.lengthFactor + shrinkage.widthFactor + shrinkage.sleeveFactor) / 3;
        // shrink -> red, expand -> blue
        var color = colorForFactor(avg);

        // Draw Shrunk
        ctx.strokeStyle = color;
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        
        drawShape(
            centerX, 
            topY, 
            bodyWidth * shrinkage.widthFactor, 
            bodyLength * shrinkage.lengthFactor, 
            sleeveLength * shrinkage.sleeveFactor
        );

        // Before/After overlay annotations
        ctx.setLineDash([]);
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText('ΔLength: ' + pct(shrinkage.lengthFactor) + '  ΔWidth: ' + pct(shrinkage.widthFactor) + '  ΔSleeve: ' + pct(shrinkage.sleeveFactor), 20, 25);

        // Crosshair dims
        drawDimensionMarkers(centerX, topY, bodyWidth, bodyLength, sleeveLength, shrinkage);
    }

    function pct(factor) {
        var p = (factor - 1) * 100;
        var sign = p > 0 ? '+' : '';
        return sign + p.toFixed(1) + '%';
    }

    function colorForFactor(f) {
        // Map 0.85..1.10 -> red..blue
        var min = 0.85, max = 1.10;
        var t = (f - min) / (max - min);
        if (t < 0) t = 0;
        if (t > 1) t = 1;
        // shrink (low) => red; expand (high) => blue
        var r = Math.round(220 * (1 - t) + 30 * t);
        var g = Math.round(60 * (1 - t) + 120 * t);
        var b = Math.round(50 * (1 - t) + 220 * t);
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function drawDimensionMarkers(cx, y, w0, l0, s0, sh) {
        // Draw current width / length indicator lines
        var w = w0 * sh.widthFactor;
        var l = l0 * sh.lengthFactor;
        var s = s0 * sh.sleeveFactor;

        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        // width line
        ctx.moveTo(cx - w / 2, y + l + 15);
        ctx.lineTo(cx + w / 2, y + l + 15);
        // length line
        ctx.moveTo(cx + w / 2 + 15, y);
        ctx.lineTo(cx + w / 2 + 15, y + l);
        // sleeve line
        ctx.moveTo(cx + w / 2, y + 60);
        ctx.lineTo(cx + w / 2 + s, y + 60);
        ctx.stroke();

        ctx.fillStyle = '#555';
        ctx.font = '12px Arial';
        ctx.fillText('W', cx, y + l + 30);
        ctx.fillText('L', cx + w / 2 + 22, y + l / 2);
        ctx.fillText('S', cx + w / 2 + s / 2, y + 52);
    }

    function drawShape(cx, y, w, l, s) {
        ctx.beginPath();
        // Neck
        ctx.moveTo(cx - 30, y);
        ctx.lineTo(cx + 30, y);
        // Right Shoulder
        ctx.lineTo(cx + w/2, y + 20);
        // Right Sleeve Top
        ctx.lineTo(cx + w/2 + s, y + 60);
        // Right Sleeve Bottom
        ctx.lineTo(cx + w/2 + s - 20, y + 100);
        // Right Armpit
        ctx.lineTo(cx + w/2, y + 80);
        // Right Side
        ctx.lineTo(cx + w/2, y + l);
        // Bottom
        ctx.lineTo(cx - w/2, y + l);
        // Left Side
        ctx.lineTo(cx - w/2, y + 80);
        // Left Armpit
        ctx.lineTo(cx - w/2 - s + 20, y + 100);
        // Left Sleeve Bottom
        ctx.lineTo(cx - w/2 - s, y + 60);
        // Left Sleeve Top
        ctx.lineTo(cx - w/2, y + 20);
        // Left Shoulder
        ctx.lineTo(cx - 30, y);
        
        ctx.stroke();
    }
    
    return {
        init: init,
        update: drawSweater
    };
})();

$(document).ready(function() {
    visualizer.init();
});

// Hook used by simulator.js
function updateVisualizer(result) {
    visualizer.update(result);
}
