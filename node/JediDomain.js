/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
//    var _domainManager = null;
    
    var cp = require("child_process");

    function cmdGetCompletion(data, setpy, pythonjediPath, cb) {
        var stdout = '',
            stderr = '';
        var child = cp.spawn(setpy, [pythonjediPath, data]); // create child process
        var chunks = [];

        child.stdout.on("data", function (data) {
            chunks.push(data);
        });
        
        child.stdout.on("end", function () {
            chunks = Buffer.concat(chunks);
            stdout = String(chunks);
        });
        
        child.stderr.on("data", function (error) {
            stderr = error.toString();
        });
           
        child.on("close", function (code) {
            if (code > 0) {
                console.log(code);
                cb(stderr, null);
            }
            cb(null, stdout);
        });
    }

    /**
     * Initializes the test domain with several test commands.
     * @param {DomainManager} domainManager The DomainManager for the server
     */
    function init(domainManager) {
        if (!domainManager.hasDomain("python-jedi")) {
            domainManager.registerDomain("python-jedi", {major: 0, minor: 1});
        }
        domainManager.registerCommand(
            "python-jedi",       // domain name
            "getCompletion",     // command name
            cmdGetCompletion,    // command handler function
            true                 // this command is asynchronous in Node
        );
    }
    
    exports.init = init;
    
}());
