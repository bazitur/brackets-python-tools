(function() {
    "use strict";
    var child_process = require("child_process");

    /* from https://gist.github.com/TooTallNate/1785026 */
    function emitLines(stream) {
        var backlog = '';
        stream.on('data', function (data) {
            backlog += data;
            var n = backlog.indexOf('\n');
            // got a \n? emit one or more 'line' events
            while (~n) {
                stream.emit('line', backlog.substring(0, n));
                backlog = backlog.substring(n + 1);
                n = backlog.indexOf('\n');
            }
        });
        stream.on('end', function () {
            if (backlog) {
                stream.emit('line', backlog);
            }
        });
    }
    var child = null;
    function cmdPythonShell(data, setpy, pythonjediPath, callBack) {
        var stdout = '', stderr = '', chunks = [];

        if (!child) { // spawn process if not exists. Else use the old one
            child = child_process.spawn(setpy, ['-u', pythonjediPath]);
            emitLines(child.stdout);
        }

        child.stdout.on("line", function (line) {
            callBack(null, line);
        });

        child.stderr.on("data", function (error) {
            stderr = error.toString();
            callBack(stderr, null);
        });

        child.stdin.write(data);
        child.stdin.write('\n');
    }

    function init(domainManager) {
        if (!domainManager.hasDomain("python-tools")) {
            domainManager.registerDomain("python-tools", {major: 0, minor: 1});
        }
        domainManager.registerCommand(
            "python-tools",       // domain name
            "pythonShell",        // command name
            cmdPythonShell,       // command handler function
            true                  // this command is asynchronous in Node
        );
    }

    exports.init = init;

}());
