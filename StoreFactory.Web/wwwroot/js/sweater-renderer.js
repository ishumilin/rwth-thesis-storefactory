// Sweater Visualizer using HTML5 Canvas
var visualizer = (function() {
    var canvas, ctx;
    
    function init() {
        canvas = document.getElementById('sweaterCanvas');
        if (canvas) {
            ctx = canvas.getContext('2d');
            // Initial draw
            drawSweater({ lengthFactor: 1, widthFactor: 1, sleeveFactor: 1 });
        }
    }
    
    function drawSweater(shrinkage) {
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        var centerX = canvas.width / 2;
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
        
        // Draw Shrunk
        ctx.strokeStyle = '#d9534f'; // Bootstrap Danger Red
        ctx.setLineDash([]);
        ctx.lineWidth = 3;
        
        drawShape(
            centerX, 
            topY, 
            bodyWidth * shrinkage.widthFactor, 
            bodyLength * shrinkage.lengthFactor, 
            sleeveLength * shrinkage.sleeveFactor
        );
    }

    function drawShape(cx, y, w, l, s) {
        ctx.beginPath();
        // Simple Body Rectangle
        ctx.rect(cx - w/2, y, w, l);
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
