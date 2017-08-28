define(function (require, exports, module) {
    "use strict";

    var EditorManager   = brackets.getModule("editor/EditorManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        Mustache        = brackets.getModule("thirdparty/mustache/mustache"),

        hintTemplate    = require("text!templates/hint.html"),
        pythonAPI       = null;

    // helpers
    /**
    I have no idea what this function does!
    */
    function getQuery(cond) {
        var editor = EditorManager.getActiveEditor(),
            pos    = editor.getCursorPos(true),
            line   = editor.document.getLine(pos.line),
            start  = pos.ch,
            end    = start;

        while (start >= 0) {
            if ((/[\s.()\[\]{}=\-@!$%\^&\?'"\/|\\`~;:<>,*+]/g).test(line[start - 1])) {
                break;
            } else {
                start--;
            }
        }
        if (cond === 'query') { //REMOVE: no uses with cond == "query
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
    function _continueHinting(hint) {
        return false;
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
        var editor   = EditorManager.getActiveEditor(),
            cursor   = editor.getCursorPos(true),
            word     = editor._codeMirror.findWordAt(cursor),
            line     = editor.document.getRange({line: word.anchor.line, ch: 0}, word.head),
            deferred = new $.Deferred(),
            query    = {
                source: DocumentManager.getCurrentDocument().getText(), // file contents
                line:   cursor.line,                                    // line no., starting with 0
                column: cursor.ch,                                      // column no.
                path:   editor.document.file._path,                     // file path
                type:   'autocomplete'                                  // type of query
            };
        pythonAPI(query)
            .done(function (hintList) {       // if successfull
                var query = getQuery.call(this, 'query');
                //TODO: dont'show single empty hint, like in `from math import pi|`
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
                console.error('Python Hints Error: ' + err);
            });
        return deferred;
    }

    PyHints.prototype.hasHints = function (editor, implicitChar) {
        if (implicitChar === null || implicitChar === ".") return true;

        var token_type = editor._codeMirror.getTokenTypeAt(editor.getCursorPos(true));
        token_type = token_type? token_type.substr(9) : null;              // strip python prefix

        var canGetHints = (["comment", "string", "keyword"].indexOf(token_type)===-1) && // if not in comment or string
                           (implicitChar.trim() !== '')
        return canGetHints;
    }
    PyHints.prototype.insertHint = function (hint) {
        var hintName = hint.data.name;
        var currentDoc = DocumentManager.getCurrentDocument();
        var word = getQuery('wordObj');
        currentDoc.replaceRange(hintName, word.start, word.end);
        return false; //TODO
    };

    module.exports = PyHints;
});
