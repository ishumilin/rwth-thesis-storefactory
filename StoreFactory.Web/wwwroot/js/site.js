// Global site JS.

// Enable Bootstrap tooltips globally (used by Simulator question-mark help icons).
// Works for Bootstrap 3 + jQuery.
$(function () {
    if ($.fn.tooltip) {
        $('[data-toggle="tooltip"]').tooltip({
            container: 'body',
            html: true,
            trigger: 'hover focus'
        });
    }
});