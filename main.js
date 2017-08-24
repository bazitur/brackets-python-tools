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

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

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
        prefs               = PreferencesManager.getExtensionPrefs("python-jedi-brackets"),
        GOTO                = 'saravanan.python-jedi-brackets.goto',
        MY_COMMAND_ID       = "python-jedi-brackets.settings",
        gotoKey             = 'Ctrl-Alt-j';
    
    prefs.definePreference("path_to_python", "string", "python3");
    
    var jedidomain = new NodeDomain("python-tools", ExtensionUtils.getModulePath(module, "node/JediDomain"));
    var pythonjediPath = ExtensionUtils.getModulePath(module, 'python3_jedi.py');
    
    KeyBindingManager.addBinding(GOTO, gotoKey);
    /**
     * @constructor
     */
    function PyHints() {
        this.data = {
            source : '',
            line : '',
            column : '',
            path : '',
            type: ''
        };
    }

    function getQuery(cond) {
        var editor = EditorManager.getActiveEditor();
        var pos = editor.getCursorPos(true);
        var line = editor.document.getLine(pos.line);
        var start = pos.ch;
        var end = start;
        
        // dunno what this while does, see https://regex101.com/r/gxeIyg/1/
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
    
    function formatHint(hint, query) {
        var matchHint = new RegExp("^" + query, "i");
        //var matchHint = new RegExp("^" + query, "i"); // what is that? never used
        var $fhint = $('<span>').addClass('python-jedi-hints');

        var match_hint = $("<span>").addClass('matched-hint')
            .text(hint.name.slice(0, query.length));

        $fhint.append(match_hint)
            .append(hint.complete);

        var circle_icon = $('<span>').text(hint.type[0])
            .addClass("docstring"); //<span class='docstring'>[f for function]</span>

        if (hint.docstring && hint.docstring.length !== 0) {
            circle_icon.attr('title', hint.docstring); //TODO: redo docs!
        }

        circle_icon.attr('title', hint.docstring).appendTo($fhint);
        $fhint.data = hint.name;

        if (hint.description.length !== 0) {
            $('<span>' + hint.description + '</span>').appendTo($fhint).addClass("description");
        }
        // <span class="python-jedi-hints"><span class="matched-hint">thi</span>s<span class="docstring" title="">m</span><span class="description">module: python3_jedi</span></span>

        return $fhint;
    }

    PyHints.prototype.hasHints = function (editor, implicitChar) {
        var cursor = editor.getCursorPos(true);

        this.data.source  = DocumentManager.getCurrentDocument().getText();
        this.data.line    = cursor.line;
        this.data.column  = cursor.ch;
        this.data.path    = editor.document.file._path;
        this.data.type    = 'autocomplete';
        
        var word = editor._codeMirror.findWordAt(cursor);
        var line = editor.document.getRange({line: word.anchor.line, ch: 0}, word.head);
        var hash = line.search(/(\#)/g);
        
        var canGetHints = !(hash!==-1 && hash<this.data.column)      &&    // if not commented?
            (/\b((\w+[\w\-]*)|([.:;\[{(< ]+))$/g).test(implicitChar) &&    // looks like select last word in a line
            (implicitChar.trim() !== '')                                   // if this last word is not empty
                                                                           // see https://regex101.com/r/GFQNbp/1
        
        if (canGetHints) {
            var deferred = new $.Deferred();
            var path = prefs.get('path_to_python');
            var setpy = path.trim() === '' ? "python3" : path;

            jedidomain.exec("getCompletion", JSON.stringify(this.data), setpy, pythonjediPath) // execute JediDomain.js
                .done(function (result) {       // if successfull
                    var hintList = JSON.parse(result);
                    var query = getQuery.call(this, 'query');

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
            this.completion = deferred;
            return true;
        } else {
            return false;
        }
    };
    
    
    
    PyHints.prototype.getHints = function (implicitChar) {
        if (CodeHintManager.isOpen()) {
            return null;
        }
        return this.completion;
    };
    
    PyHints.prototype.insertHint = function (hint) {
        hint = hint.data;
        var currentDoc = DocumentManager.getCurrentDocument();
        var word = getQuery.call(this, 'wordObj');
        currentDoc.replaceRange(hint, word.start, word.end);
        return false;
    };

    function gotoDefinition() {
        
        var editor = EditorManager.getActiveEditor();
        
        var cursor = editor.getCursorPos(true);
        var data = {
            source : DocumentManager.getCurrentDocument().getText(),
            line : cursor.line + 1,
            column : cursor.ch + 1,
            path : editor.document.file._path,
            type : 'goto'
        };
        
        var extension = fileutils.getFileExtension(data.path);
        if (extension === "py") {
            var path = prefs.get('path_to_python');
            var setpy = path === '' ? "python3" : path;
            jedidomain.exec("getCompletion", JSON.stringify(data), setpy, pythonjediPath)
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
        CommandManager.register("GOTO DEFINITION", GOTO, gotoDefinition);
        CommandManager.register("Python Jedi Settings", MY_COMMAND_ID, handlePreferences);
        menu.addMenuDivider();
        menu.addMenuItem(MY_COMMAND_ID);
        menu.addMenuDivider();
        ExtensionUtils.loadStyleSheet(module, "styles/styles.css");
    });
});
