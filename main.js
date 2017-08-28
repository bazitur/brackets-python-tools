/*
 * The MIT License (MIT)
 *
 * Copyright (c) 2016 K.Saravanan
 * Copyright (c) 2017 Basil Miturich
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

//TODO: fix double-lettering bug
//TODO: put hints that start with parameter upper than class, for example
//TODO: put jump-to feature to the standart API
//TODO: add linter (use flake8)
//TODO: add nice extended definition, like the first line in formatted docs
//TODO: enhance hint popping
//TODO: enhance checking whether can get hint (e.g. no hint on empty space)
//TODO: write my own rst parser!

define(function (require, exports, module) {
    "use strict";

    var AppInit             = brackets.getModule("utils/AppInit"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        CodeHintManager     = brackets.getModule("editor/CodeHintManager"),
        NodeDomain          = brackets.getModule("utils/NodeDomain"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        prefs               = PreferencesManager.getExtensionPrefs("brackets-python-tools"),
        pythonToolsPath     = ExtensionUtils.getModulePath(module, 'python_utils.py'),
        MY_COMMAND_ID       = "python-tools.settings";
    
    var PyHints = require("PyHints"),
        PyDocs  = require("PyDocs");

    prefs.definePreference("path_to_python", "string", "python3");
    var pyPath = "python3", //TODO
        pythonDomain = new NodeDomain("python-tools", ExtensionUtils.getModulePath(module, "node/PythonDomain"));


    /* A wrapper around call to python script.
     * @return $.Deferred()
     */
    function pythonAPI (request) {
        var serializedRequest = JSON.stringify(request),
            deferred = new $.Deferred(),
            deserializedResponse;

        pythonDomain.exec("pythonShell", serializedRequest, pyPath, pythonToolsPath)
            .done(function(data) {
                deserializedResponse = JSON.parse(data);
                deferred.resolve(deserializedResponse);
            })
            .fail(function(error) {
                console.error("Python Tools Error: " + error);
                deferred.reject(error);
            });
        return deferred;
    }

    function handlePreferences() {
        var path = prefs.get('path_to_python');
        var prefTpl = require("text!templates/preferences.html");
        var dialog = Dialogs.showModalDialogUsingTemplate(prefTpl, false);
        var getDialogElements = dialog.getElement();
        var cancelBtn =  getDialogElements.find('#cancel');
        var okBtn = getDialogElements.find('#ok');
        var pythonPath = getDialogElements.find('#pythonPath');
        pythonPath.val(prefs.get('path_to_python'));
        cancelBtn.click(function () {
            dialog.close();
        });
        okBtn.click(function () {
            prefs.set('path_to_python', pythonPath.val().trim());
            prefs.save();
            dialog.close();
        });
    }
    
    AppInit.appReady(function () {
        
        var python_hints = new PyHints(pythonAPI),
            python_docs  = new PyDocs(pythonAPI);

        CodeHintManager.registerHintProvider(python_hints, ["python"], 9);
        EditorManager.registerInlineDocsProvider(python_docs);

        ExtensionUtils.loadStyleSheet(module, "styles/hints.less");
        ExtensionUtils.loadStyleSheet(module, "styles/docs.less");
    });
});
