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

//TODO: put hints that start with parameter upper than class, for example
//TODO: don't show protected and private members unless stated explicitly
//TODO: enhance docutils
//TODO: fix sphinx' special roles uses in inline documentation
//TODO: show only defined in file or in module completions - kinda impossible?

define(function (require, exports, module) {
    "use strict";

    var EXTENSION_NAME = "bazitur.python-tools";

    var AppInit            = brackets.getModule("utils/AppInit"),

        EditorManager      = brackets.getModule("editor/EditorManager"),
        DocumentManager    = brackets.getModule("document/DocumentManager"),
        CodeHintManager    = brackets.getModule("editor/CodeHintManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        CommandManager     = brackets.getModule("command/CommandManager"),

        CodeInspection     = brackets.getModule("language/CodeInspection"),
        NodeDomain         = brackets.getModule("utils/NodeDomain"),
        ExtensionUtils     = brackets.getModule("utils/ExtensionUtils"),
        Dialogs            = brackets.getModule("widgets/Dialogs"),
        Mustache           = brackets.getModule("thirdparty/mustache/mustache"),
        Menus              = brackets.getModule("command/Menus"),

        preferences        = PreferencesManager.getExtensionPrefs(EXTENSION_NAME);

    var preferencesTemplate = require("text!templates/preferences.html"),
        SETTINGS_CMD_ID  = EXTENSION_NAME + ".settings";
    var errorTemplate = require("text!templates/error.html");
    
    var PyHints = require("PyHints"),
        PyDocs  = require("PyDocs"),
        PyLint  = require("PyLint"),
        PyGoto  = require("PyGoto");

    var pythonToolsPath = ExtensionUtils.getModulePath(module, 'pythonfiles/python_utils.py');

    var pythonDomain = new NodeDomain("python-tools", ExtensionUtils.getModulePath(module, "node/PythonDomain"));

    preferences.definePreference("pathToPython", "string", "python3", {
        description: "Path to Python executable" //TODO: replace with Strings
    });
    preferences.definePreference("isCaseSensitive", "boolean", true, {
        description: "Use case sensitive completion" //TODO: +Strings
    });

    var pathToPython = preferences.get("pathToPython");

    /* A wrapper around call to python script.
     * @return $.Deferred()
     */
    function pythonAPI (request) {
        var serializedRequest = JSON.stringify(request),
            deferred = new $.Deferred(),
            deserializedResponse;

        pythonDomain.exec("pythonShell", serializedRequest, pathToPython, pythonToolsPath)
            .done(function(data) {
                deserializedResponse = JSON.parse(data);
                deferred.resolve(deserializedResponse);
            })
            .fail(function(error) {
                console.error("Python Tools Error via JSON API: " + error);
                deferred.reject(error);
            });
        return deferred;
    }

    function handleSettings() {
        var renderedTemplate = Mustache.render(preferencesTemplate, {
            PYTHON_TOOLS_PREFERENCES_TITLE: "Python Tools Settings",
            PATH_TO_PYTHON_TITLE: "Path to Python executable",
            IS_CASE_SENSITIVE_TITLE: "Use case sensitive completion", //TODO: +Strings
            BUTTON_CANCEL: "Cancel",
            BUTTON_OK: "OK",

            pathToPython: preferences.get("pathToPython"),
            isCaseSensitive: preferences.get("isCaseSensitive")
        });
        var dialog = Dialogs.showModalDialogUsingTemplate(renderedTemplate, false);
        var getDialogElements = dialog.getElement();
        var cancelButton =  getDialogElements.find('#cancel-button');
        var okButton = getDialogElements.find('#ok-button');
        var newPathToPython = getDialogElements.find('#pathToPython');
        var newIsCaseSensitive = getDialogElements.find('#isCaseSensitive');
        cancelButton.click(function () {
            dialog.close();
        });
        okButton.click(function () {
            newPathToPython = newPathToPython.val().trim();
            if (newPathToPython) {
                preferences.set('pathToPython', newPathToPython);
            }
            preferences.set("isCaseSensitive", newIsCaseSensitive.prop("checked"));
            preferences.save();
            dialog.close();
        });
    }
    
    function setUpPythonShell () {
        return pythonAPI({
            "type": "setup",
            "settings": {
                "max_code_hints": PreferencesManager.get("maxCodeHints"),
                "is_case_sensitive": preferences.get("isCaseSensitive")
            }
        });
    }

    function internalError (error) {
        Dialogs.showModalDialog(
            "python-tools-error",
            "Python Tools failed", //TODO: +Strings
            Mustache.render(errorTemplate, {
                error: error
            }
        ));
    }

    AppInit.appReady(function () {
        
        var python_hints = new PyHints(pythonAPI),
            python_docs  = new PyDocs(pythonAPI),
            python_lint  = new PyLint(pythonDomain, pathToPython),
            python_goto  = new PyGoto(pythonAPI).goto;
        // NOTICE: EditorManager requires jump to definition provider to be a function.
        // Thus, passing method to EditorManager.

        CodeHintManager.registerHintProvider(python_hints, ["python"], 9);
        EditorManager.registerInlineDocsProvider(python_docs);
        EditorManager.registerJumpToDefProvider(python_goto);
        CodeInspection.register("python", {
            name: 'Python lint',
            scanFileAsync: python_lint.scanFileAsync
        });

        window.setTimeout(function () {
            var start = new Date().getTime();
            setUpPythonShell().done(function (data) {
                console.log("Established connection with Python shell in " +
                            (new Date().getTime() - start).toString() +
                            " milliseconds");
                if (!data["with_jedi"]) {
                    internalError(JSON.stringify(data));
                }
            }).fail(function(error) {
                internalError(error);
            });
        }, 100);

        preferences.on("change", setUpPythonShell);

        CommandManager.register("Python Tools Settings", SETTINGS_CMD_ID, handleSettings); //TODO: +Strings
        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(SETTINGS_CMD_ID);

        ExtensionUtils.loadStyleSheet(module, "styles/hints.less");
        ExtensionUtils.loadStyleSheet(module, "styles/docs.less");
        ExtensionUtils.loadStyleSheet(module, "styles/modals.css");
    });
});
