/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4,
maxerr: 50, node: true */
/*global */

(function () {
    "use strict";
    
//    var _domainManager = null;
    
    var cp = require("child_process");
    
    /**
     * @private
     * Handler function for the simple.getMemory command.
     * @param {boolean} total If true, return total memory; if false, return free memory only.
     * @return {number} The amount of memory.
     */
    function cmdGetCompletion(data, setpy, cb) {
        var stdout = '', stderr = '';
        var child = cp.spawn(setpy, ['.config/Brackets/extensions/user/python-jedi-brackets/python3_jedi.py', data]);
        child.stdout.on("data", function (data) {
            stdout = data.toString();
        });
        
        child.stderr.on("data", function (error) {
            stderr = error.toString();
        });
           
        child.on("close", function (code) {
//            console.log(code);
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
//        _domainManager = domainManager;
        if (!domainManager.hasDomain("python-jedi")) {
            domainManager.registerDomain("python-jedi", {major: 0, minor: 1});
        }
        domainManager.registerCommand(
            "python-jedi",       // domain name
            "getCompletion",    // command name
            cmdGetCompletion,   // command handler function
            true         // this command is asynchronous in Node
        );
    }
    
    exports.init = init;
    
}());
        