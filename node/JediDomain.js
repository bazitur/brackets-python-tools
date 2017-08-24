(function() {
    "use strict";
    var child_process = require("child_process");

    // is this mysterious cb a callback?
    function cmdGetCompletion(data, setpy, pythonjediPath, cb) {
        var stdout = '',
            stderr = '',
            child = child_process.spawn(setpy, [pythonjediPath, data]), // create child process
            chunks = [];

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
            if (code > 0) {       // if got error
                console.log(code);
                cb(stderr, null);
            }
            cb(null, stdout);     // pass stdout
        });
    }

    /**
     * Initializes the test domain with several test commands.
     * @param {DomainManager} domainManager The DomainManager for the server
     */
    function init(domainManager) {
        if (!domainManager.hasDomain("python-tools")) {
            domainManager.registerDomain("python-tools", {major: 0, minor: 1});
        }
        domainManager.registerCommand(
            "python-tools",       // domain name
            "getCompletion",     // command name
            cmdGetCompletion,    // command handler function
            true                 // this command is asynchronous in Node
        );
    }
    
    exports.init = init;
    
}());
