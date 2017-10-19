define(function (require, exports, module) {
    "use strict";

    var EditorManager   = brackets.getModule("editor/EditorManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        Mustache        = brackets.getModule("thirdparty/mustache/mustache"),

        hintTemplate    = require("text!templates/hint.html"),
        cache           = {},
        pythonAPI       = null,
        counter         = null;

    // helpers
    function _shorten(str, length) {
        if (str.length <= length) return str;
        else return str.substr(0, length) + "…";
    }

    function formatHint(hint) {
        var $fhint = $(Mustache.render(hintTemplate, {
            'hint': {
                first: hint.name.slice(0, -hint.complete.length),
                last:  hint.complete
            },
            'docstring': hint.docstring.trim(),
            'description': hint.description,
            'type': hint.type,
            'help': _shorten(hint.docstring, 500)
        }));
        $fhint.data = hint;
        return $fhint;
    }
    // end helpers

    /**
     * @constructor
     */
    function PyHints(pyAPI) {
        pythonAPI = pyAPI;

        this.data = {   //REMOVE: not used anywhere?
            source : '',
            line :   '',
            column : '',
            path :   '',
            type:    ''
        };
    }

    PyHints.prototype.getHints = function(implicitChar) {

        var editor = cache['editor'];
        if (!this.hasHints(editor, implicitChar)) return null;

        var localCounter = new Date().getTime();
        counter = localCounter;

        var deferred = new $.Deferred(),
            cursor   = cache['cursor'],
            query    = {
                source: DocumentManager.getCurrentDocument().getText(), // file contents
                line:   cursor.line,                                    // line no., starting with 0
                column: cursor.ch,                                      // column no.
                path:   editor.document.file._path,                     // file path
                type:   'autocomplete'                                  // type of query
            };
        pythonAPI(query)
            .done(function (hintList) {       // if successfull
                if (localCounter != counter)
                    deferred.reject();

                var $hintArray = hintList
                    .filter(function (hint) {
                        return hint.complete !== '';
                    })
                    .map(formatHint);
                var resolve_obj = {
                    hints: $hintArray,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                };
                deferred.resolve(resolve_obj);
            })
            .fail(function (err) {          // if error
                console.error('Python Hints Error: ' + err);
                deferred.reject(err);
            });
        return deferred;
    }

    PyHints.prototype.hasHints = function (editor, implicitChar) {
        cache['editor'] = editor;

        var cursor = cache['cursor'] = editor.getCursorPos(true),
            token_type = editor._codeMirror.getTokenTypeAt(cursor);
        token_type = token_type? token_type.substr(9) : null;  // strip python prefix

        // if not in forbidden token type
        var canGetHints = (["comment", "string", "string-2"].indexOf(token_type)===-1)
        if (!canGetHints) return false;

        var line = editor.document.getRange({'ch': 0, 'line': cursor.line}, cursor),
            test_regexp = /[A-Za-z_][A-Za-z_0-9]{1,}$/;

        if (test_regexp.test(line)) return true;

        return false;
    }
    PyHints.prototype.insertHint = function (hint) {
        var completion = hint.data.complete,
            editor = cache['editor'],
            cursor = cache['cursor'],
            doc    = editor.document;
        doc.replaceRange(completion, cursor); // insert hint after cursor
        return false;
    };

    module.exports = PyHints;
});
