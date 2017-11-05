/* global global, require, exports */
(function() {
    "use strict";
    var spawn = require("child_process").spawn;
    var pythonDirectory;
    /*
     * @constructor
     */
    function PythonShell(pythonPath, pythonScript) {
        this.pythonPath = pythonPath;
        this.pythonScript = pythonScript;
        this.needsRestart = false;
    }

    PythonShell.prototype.send = function (data, callBack) {
        this.callBack = callBack;
        if (!this.process) callBack(true, null);
        else {
            this.process.stdin.write(JSON.stringify(data));
            this.process.stdin.write("\n");
        }
    };

    PythonShell.prototype.setSettings = function (settings, callBack) {
        this.pythonPath = settings.pythonPath;
        this.pythonScript = settings.pythonScript;
        pythonDirectory = settings.pythonDirectory;
        callBack(null, "");
    };

    PythonShell.prototype.handleData = function (buffer) {
        var data;
        try {
            data = JSON.parse(buffer.toString());
        } catch (error) {
            data = null;
            var err = error;
        }
        if (this.callBack) {
            data !== null? this.callBack(null, data) : this.callBack(err, null);
        } else {
            console.error("Unhandled data");
        }
    };

    PythonShell.prototype.handleError = function (errorBuffer) {
        var error = errorBuffer.toString();
        // should not restart the process there, may continue infinitely
        this.needsRestart = true;

        if (this.callBack) {
            this.callBack(error, null);
        } else {
            console.error("Unhandled error: %s", error);
        }
    };

    PythonShell.prototype.handleClose = function (code) {
        if (this.callBack) {
            if (code === 0)
                this.callBack(null, true);
            else
                this.callBack(null, code);
        }
        this.needsRestart = true;
    };

    PythonShell.prototype.start = function (callBack) {
        if (this.process && this.process.connected
            && (!this.process.killed) && (!this.needsRestart)) {
            callBack(null, true);   // cache normal process
        } else if (this.process) {
            this.process.kill();
            this.needsRestart = false;
        }

        this.process = spawn(this.pythonPath, ["-u", this.pythonScript], {
            windowsHide: true,
            cwd: pythonDirectory
        });
        this.process.on("error", function () {
            callBack(null, "Error spawning process");
        });
        this.process.stdout.on("data", this.handleData.bind(this));
        this.process.stderr.on("data", this.handleError.bind(this));
        this.process.on("close", this.handleClose.bind(this));

        // resolve in 500 milliseconds if no errors had occured
        this.callBack = callBack;
        global.setTimeout(function () { callBack(null, true) }, 500);
    };

    var pyShell = new PythonShell(null, null);

    function cmdFlake8(pyPath, fileName, lineLength, ignoredErrors, callBack) {
        var result = [], stderr = '';

        var args = ['-m', 'flake8', '--exit-zero',
                    '--max-line-length=' + lineLength.toString(),
                    '--format=%(row)d||%(col)d||%(code)s||%(text)s'];

        if (ignoredErrors.length > 0)
            args.push('--ignore='+ignoredErrors.join(','));
        args.push(fileName);

        var flake8 = spawn(pyPath, args, {
            windowsHide: true,
            cwd: pythonDirectory
        });

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

        [{
            name: "startShell",
            func: pyShell.start.bind(pyShell)
        }, {
            name: "sendToShell",
            func: pyShell.send.bind(pyShell)
        }, {
            name: "setSettings",
            func: pyShell.setSettings.bind(pyShell)
        }, {
            name: "Flake8",
            func: cmdFlake8
        }].forEach(function (item) {
            domainManager.registerCommand(
                "python-tools",
                item.name,
                item.func,
                true        // is async
            );
        });
    }

    exports.init = init;
}());
