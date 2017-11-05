/* global define, $ */
define(function (require, exports, module) {
    "use strict";
    var status;

    function PyStatus (handler) {
        status = $('<div id="python-tools-status">');
        $("#status-overwrite").after(status);
        status.after($('<div id="python-tools-status-dummy">'));
        status.on("click", handler);
    }

    PyStatus.prototype.update = function (cls, title) {
        status.removeClass();
        status.addClass(cls);

        title = title || null;
        if (title)
            status.attr("title", title);
        else
            status.removeAttr("title");
    }

    module.exports = PyStatus;
});
