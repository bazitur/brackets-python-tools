(function() {
    "use strict";
    var spawn = require("child_process").spawn;

    /* from https://gist.github.com/TooTallNate/1785026 */
    //TODO: child restart is broken
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
    function cmdPythonShell(data, pyPath, pyScript, callBack) {
        var stdout = '', stderr = '', chunks = [];

        if (!child) {
            // spawn process if not exists. Else use the old one
            child = spawn(pyPath, ['-u', pyScript]);
            emitLines(child.stdout);
        }
        //TODO: finally understood where do tons of event handlers come from
        //TODO: separate process creation and querying
        child.stdout.on("line", function (line) {
            callBack(null, line);
        });

        child.stderr.on("data", function (error) {
            var formattedError = error.toString();
            console.error("Python Domain Error: " + formattedError);
            callBack(formattedError, null);
        });

        child.stdin.write(data);
        child.stdin.write('\n');
    }

    function cmdFlake8(pyPath, fileName, callBack) {
        var result = [], stderr = '';
        var args = ['-m', 'flake8', '--exit-zero',
                    '--format=%(row)d||%(col)d||%(code)s||%(text)s', fileName];
        var flake8 = spawn(pyPath, args);

        flake8.stdout.on('data', function (data) {
            data = data.toString();
            data.split("\n").forEach(function (line) {
                if (line && line.trim()) {
                    line = line.split("||");
                    result.push({
                        row:    line[0],
                        column: line[1],
                        code:   line[2],
                        text:   line[3]
                    });
                }
            });
        });

        flake8.stderr.on('data', function (data) {
            stderr = data.toString();
        });

        flake8.on('close', function (code) {
            if (code === 0) callBack(null, result);
            else callBack(stderr, null);
        });
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
        domainManager.registerCommand(
            "python-tools",
            "Flake8",
            cmdFlake8,
            true
        );
    }

    exports.init = init;
}());
