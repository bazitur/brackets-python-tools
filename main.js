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

/* global define, brackets, $, window */

//TODO: ignore flake8 `indentation contains tabs` if Brackets uses tabs
//TODO: run flake8 from project root, as well as python utils.
//TODO: fix sphinx' special roles uses in inline documentation - maybe just use Sphinx?
//TODO: move flake8 to standart API, if it'll ever get API.
//TODO: add terminal?

define(function (require, exports, module) {
    "use strict";

    var CONSTANTS = require("constants");

    var EXTENSION_NAME = CONSTANTS.EXTENSION_NAME,
        ERROR_CODES    = CONSTANTS.ERROR_CODES;

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
        CoreStrings        = brackets.getModule("strings"),

        preferences        = PreferencesManager.getExtensionPrefs(EXTENSION_NAME);

    var LocalStrings     = require("strings"),
        settingsTemplate = require("text!templates/preferences.html"),
        errorTemplate    = require("text!templates/error.html");

    var SETTINGS_CMD_ID  = EXTENSION_NAME + ".settings";
    
    var PyHints  = require("PyHints"),
        PyDocs   = require("PyDocs"),
        PyLint   = require("PyLint"),
        PyGoto   = require("PyGoto"),
        PyStatus = require("PyStatus");

    var SCRIPT_FULL_PATH = ExtensionUtils.getModulePath(module, 'pythonfiles/python_utils.py');
    var PYTHON_DIRECTORY = ExtensionUtils.getModulePath(module, 'pythonfiles/');

    var pythonDomain = new NodeDomain("python-tools", ExtensionUtils.getModulePath(module, "node/PythonDomain"));

    var status = new PyStatus(handleSettings);

    preferences.definePreference("pathToPython", "string", "python", {
        description: LocalStrings.PATH_TO_PYTHON_TITLE,
        validator: function (value) {
            return value.trim().length > 0;
        }
    });
    preferences.definePreference("isCaseSensitive", "boolean", true, {
        description: LocalStrings.IS_CASE_SENSITIVE_TITLE
    });
    preferences.definePreference("maxLineLength", "number", 79, {
        description: LocalStrings.MAX_LINE_LENGTH_TITLE,
        validator: function (value) {
            return 70 <= value && value <= 300;
        }
    });
    preferences.definePreference("ignoredErrors", "array", [], {
        description: LocalStrings.IGNORED_ERRORS_TITLE,
        validator: function (arr) {
            return arr.every(function (el) { return ERROR_CODES.includes(el); });
        }
    });

    var pathToPython = preferences.get("pathToPython");

    /* A wrapper around call to python script.
     * @return $.Deferred()
     */
    function pythonAPI (request) {
        var deferred = new $.Deferred();

        pythonDomain.exec("sendToShell", request)
            .done(function(data) {
                if (data.status === "OK")
                    deferred.resolve(data.content);
                else if (data.status === "ERROR") {
                    console.error(
                        "Non-critical error in Python Domain:\n" +
                        data.error.traceback.join("") +
                        data.error.name + ": " +
                        data.error.value
                    );
                    deferred.reject(data.content);
                }
            })
            .fail(function(error) {
                console.error("Critical error in Python Domain");
                console.error(error);
                deferred.reject(error);
            });
        return deferred;
    }

    /* Settings dialog handler.
     * @return null
     */
    function handleSettings() {
        var renderedTemplate = Mustache.render(settingsTemplate, {
            PYTHON_TOOLS_SETTINGS_TITLE: LocalStrings.PYTHON_TOOLS_SETTINGS_TITLE,
            PATH_TO_PYTHON_TITLE:        LocalStrings.PATH_TO_PYTHON_TITLE,
            IS_CASE_SENSITIVE_TITLE:     LocalStrings.IS_CASE_SENSITIVE_TITLE,
            MAX_LINE_LENGTH_TITLE:       LocalStrings.MAX_LINE_LENGTH_TITLE,
            IGNORED_ERRORS_TITLE:        LocalStrings.IGNORED_ERRORS_TITLE,
            BUTTON_CANCEL:               CoreStrings.CANCEL,
            BUTTON_SAVE:                 CoreStrings.SAVE,

            pathToPython:    preferences.get("pathToPython"),
            isCaseSensitive: preferences.get("isCaseSensitive"),
            maxLineLength:   preferences.get("maxLineLength"),
            ignoredErrors:   JSON.stringify(preferences.get("ignoredErrors"))
        });
        var dialog = Dialogs.showModalDialogUsingTemplate(renderedTemplate, false);
        var getDialogElements = dialog.getElement();
        var cancelButton =  getDialogElements.find('#cancel-button');
        var okButton = getDialogElements.find('#ok-button');

        var newPathToPython    = getDialogElements.find('#pathToPython'),
            newIsCaseSensitive = getDialogElements.find('#isCaseSensitive'),
            newMaxLineLength   = getDialogElements.find("#maxLineLength"),
            newIgnoredErrors   = getDialogElements.find("#ignoredErrors");

        cancelButton.click(function () {
            dialog.close();
        });
        okButton.click(function () {
            dialog.close();
            newPathToPython = newPathToPython.val().trim();
            if (newPathToPython) preferences.set('pathToPython', newPathToPython);

            try {
                newIgnoredErrors = JSON.parse(newIgnoredErrors.val());
            } catch (error) {
                console.error(error);
                newIgnoredErrors = null;
            }

            if (newIgnoredErrors) {
                preferences.set("ignoredErrors", newIgnoredErrors);
            }

            preferences.set("isCaseSensitive", newIsCaseSensitive.prop("checked"));
            preferences.set("maxLineLength", newMaxLineLength.val());

            preferences.save();
        });
    }
    
    function setUpPythonShell () {
        status.update("loading", LocalStrings.SHELL_CONNECTING);
        pythonDomain.exec("setSettings", {
            pythonPath: preferences.get("pathToPython"),
            pythonScript: SCRIPT_FULL_PATH,
            pythonDirectory: PYTHON_DIRECTORY
        }).done(function() {
            pythonDomain.exec("startShell")
                .done(function() {
                    pythonAPI({
                        "type": "setup",
                        "settings": {
                            "is_case_sensitive": preferences.get("isCaseSensitive")
                        }
                    }).done(function (data) {
                        status.update("connected", LocalStrings.SHELL_CONNECTED);
                    }).fail(function(error) {
                        internalError(error);
                    });
                })
                .fail(function(error){
                    internalError(error);
                });
        });
    }

    /* Show error modal with some help and error content.
     * @param {string} error error text
     */
    function internalError (error) {
        status.update("error", LocalStrings.SHELL_ERROR);
        Dialogs.showModalDialog(
            "python-tools-error",
            LocalStrings.ERROR_TITLE,
            Mustache.render(errorTemplate, {
                ERROR_NOTICE: Mustache.render(LocalStrings.ERROR_NOTICE, {
                    HOMEPAGE_REF: CONSTANTS.HOMEPAGE
                }),
                ERROR_TEXT:   LocalStrings.ERROR_TEXT,

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

        window.setTimeout(setUpPythonShell, 20);
        preferences.on("change", setUpPythonShell);

        CommandManager.register(
            LocalStrings.PYTHON_TOOLS_SETTINGS_TITLE,
            SETTINGS_CMD_ID,
            handleSettings
        );

        var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        menu.addMenuDivider();
        menu.addMenuItem(SETTINGS_CMD_ID, "Ctrl-Alt-Y");

        ["hints.less",
         "docs.less",
         "modals.css",
         "spinner.css"].forEach(function (stylesheet) {
            ExtensionUtils.loadStyleSheet(module, "styles/" + stylesheet);
        });
    });
});
