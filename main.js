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
//TODO: styling, probably copy/paste from JShint
//TODO: rewrite formatHint
//TODO: put jump-to feature to the standart API
//TODO: write docs utility?
//TODO: add linter (use flake8)
//TODO; enhance hint popping

define(function (require, exports, module) {
    "use strict";

    var AppInit             = brackets.getModule("utils/AppInit"),
        EditorManager       = brackets.getModule("editor/EditorManager"),
        DocumentManager     = brackets.getModule("document/DocumentManager"),
        CodeHintManager     = brackets.getModule("editor/CodeHintManager"),
        NodeDomain          = brackets.getModule("utils/NodeDomain"),
        NodeConnection      = brackets.getModule("utils/NodeConnection"),
        ExtensionUtils      = brackets.getModule("utils/ExtensionUtils"),
        CommandManager      = brackets.getModule("command/CommandManager"),
        Commands            = brackets.getModule("command/Commands"),
        KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
        fileutils           = brackets.getModule("file/FileUtils"),
        Menus               = brackets.getModule("command/Menus"),
        Dialogs             = brackets.getModule("widgets/Dialogs"),
        PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
        Mustache            = brackets.getModule("thirdparty/mustache/mustache"),
        prefs               = PreferencesManager.getExtensionPrefs("brackets-python-tools"),
        MY_COMMAND_ID       = "python-tools.settings";
    
    var KEYWORDS = ['False', 'None', 'True', 'and', 'as', 'assert', 'break',
                    'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
                    'finally', 'for', 'from', 'global', 'if', 'import', 'in',
                    'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
                    'return', 'try', 'while', 'with', 'yield'];

    prefs.definePreference("path_to_python", "string", "python3");
    
    var pythonDomain    = new NodeDomain("python-tools", ExtensionUtils.getModulePath(module, "node/PythonDomain")),
        pythonToolsPath = ExtensionUtils.getModulePath(module, 'python_utils.py'),
        hintTemplate    = require("text!templates/hint.html");
    
    Mustache.parse(hintTemplate); // cache template

    /**
    @constructor
    */
    function PyHints() {
        this.data = {
            source : '',
            line :   '',
            column : '',
            path :   '',
            type:    ''
        };
    }

    function getQuery(cond) {
        var editor = EditorManager.getActiveEditor(),
            pos    = editor.getCursorPos(true),
            line   = editor.document.getLine(pos.line),
            start  = pos.ch,
            end    = start;
        
        // no idea what this while does, see https://regex101.com/r/gxeIyg/1/
        // probably finds place for jedi to start autocompletion?
        while (start >= 0) {
            if ((/[\s.()\[\]{}=\-@!$%\^&\?'"\/|\\`~;:<>,*+]/g).test(line[start - 1])) {
                break;
            } else {
                start--;
            }
        }
        if (cond === 'query') {
            return line.substring(start, end);
        } else {
            var word = {
                start: {
                    line: pos.line,
                    ch: start
                }, end: {
                    line: pos.line,
                    ch: end
                }
            };
            return word;
        }
    }
    
    function _shorten(str, length) {
        if (str.length <= length) return str;
        else return str.substr(0, length) + "…";
    }

    function formatHint(hint, query) {
        var $fhint = $(Mustache.render(hintTemplate, {
            'hint': {
                first: hint.name.slice(0, query.length),
                last: hint.complete
            },
            'docstring': _shorten(hint.docstring.trim(), 250),
            'description': _shorten(hint.description, 100)
        }));
        $fhint.data = hint;
        return $fhint;
    }

    function _getPython() {
        return 'python3'; //TODO
    }

    function _continueHinting(hint) {
        return false;
    }

    PyHints.prototype.getHints = function(implicitChar) {
        var editor   = EditorManager.getActiveEditor(),
            cursor   = editor.getCursorPos(true),
            word     = editor._codeMirror.findWordAt(cursor),
            line     = editor.document.getRange({line: word.anchor.line, ch: 0}, word.head),
            hash     = line.search(/(\#)/g),
            pypath   = _getPython(),
            deferred = new $.Deferred(),
            query    = {
                source: DocumentManager.getCurrentDocument().getText(), // file contents
                line:   cursor.line,                                    // line no., starting with 0
                column: cursor.ch,                                      // column no.
                path:   editor.document.file._path,                     // file path
                type:  'autocomplete'                                   // type of query
            };
        pythonDomain.exec("pythonShell", JSON.stringify(query), pypath, pythonToolsPath)
            .done(function (result) {       // if successfull
                var hintList = JSON.parse(result),
                    query = getQuery.call(this, 'query');

                var $hintArray = hintList.map(function(hint) {
                    return formatHint(hint, query);
                });
                var resolve_obj = {
                    hints: $hintArray,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                };
                deferred.resolve(resolve_obj);
            })
            .fail(function (err) {          // if error
                console.error('Error: ' + err);
                if (deferred.state() === "pending") {
                    deferred.reject("Error: " + err.toString());
                }
            });
        return deferred;
    }

    PyHints.prototype.hasHints = function (editor, implicitChar) {
        if (implicitChar === null || implicitChar === ".") return true;

        var cursor = editor.getCursorPos(true),
            word = editor._codeMirror.findWordAt(cursor),
            token_type = editor._codeMirror.getTokenTypeAt(cursor),
            line = editor.document.getRange({line: word.anchor.line, ch: 0}, word.head);

        token_type = token_type? token_type.substr(9) : null;              // strip python prefix

        var canGetHints = (["comment",
                            "string",
                            "keyword"].indexOf(token_type) === -1) &&      // if not in comment or string
            (/\b((\w+[\w\-]*)|([.:;\[{(< ]+))$/g).test(implicitChar) &&    // looks like select last word in a line
            (implicitChar.trim() !== '')                                   // if this last word is not empty
                                                                           // see https://regex101.com/r/GFQNbp/1
        return canGetHints;
    }

    PyHints.prototype.insertHint = function (hint) {
        hint = hint.data.name;
        var currentDoc = DocumentManager.getCurrentDocument();
        var word = getQuery('wordObj');
        currentDoc.replaceRange(hint, word.start, word.end);
        return _continueHinting(hint);
    };

    /*
    function gotoDefinition() {
        
        var editor = EditorManager.getActiveEditor();
        
        var cursor = editor.getCursorPos(true);
        var data = {
            source: DocumentManager.getCurrentDocument().getText(),
            line: cursor.line + 1,
            column: cursor.ch + 1,
            path: editor.document.file._path,
            type: 'goto'
        };
        
        var extension = fileutils.getFileExtension(data.path);
        if (extension === "py") {
            var path = prefs.get('path_to_python');
            var setpy = path === '' ? "python3" : path;
            pythonDomain.exec("getCompletion", JSON.stringify(data), setpy, pythonjediPath)
                .done(function (result) {
                    var fileInfo = JSON.parse(result)[0];
                    if (fileInfo !== undefined && !fileInfo.is_built_in) {
                        CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath: fileInfo.module_path, paneId: "first-pane"});
                        setTimeout(function () {
                            var editor = EditorManager.getActiveEditor();
                            editor.setCursorPos(fileInfo.line - 1, fileInfo.column, true);
                        }, 100);
                        
                    }
                })
                .fail(function (err) {
                    console.error('Error: ' + err);
                });
        }
    }
    */
    
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
        
        var pyHints = new PyHints(),
            menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        CodeHintManager.registerHintProvider(pyHints, ["python"], 9);
        //CommandManager.register("GOTO DEFINITION", GOTO, gotoDefinition);
        CommandManager.register("Python Tools Settings", MY_COMMAND_ID, handlePreferences);
        menu.addMenuDivider();
        menu.addMenuItem(MY_COMMAND_ID);
        menu.addMenuDivider();
        ExtensionUtils.loadStyleSheet(module, "styles/styles.less");
    });
});
