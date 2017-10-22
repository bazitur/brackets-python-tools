define(function (require, exports, module) {
    "use strict";
    var Type = brackets.getModule("language/CodeInspection").Type,
        getCurrentDocument = brackets.getModule("document/DocumentManager").getCurrentDocument;

    var pythonDomain = null,
        pythonPath = null;

    var WITH_GUTTERS = new Boolean(window.bracketsInspectionGutters);
    if (!WITH_GUTTERS)
        console.warn('No bracketsInspectionGutters found on window, gutters disabled.');

    function _getErrorSeverity (errorCode) {
        if (["E121", "E123", "E126", "E133", "E226",
             "E241", "E242", "E501", "E704", "W293","W503"].includes(errorCode))
            return Type.META;
        else if (/^(E(1|74|9)|F(6|7|8))/.test(errorCode))
            return Type.ERROR;
        else
            return Type.WARNING;
    }

    function PyLint(pyDomain, pyPath) {
        pythonDomain = pyDomain;
        pythonPath = pyPath;
    }

    PyLint.prototype.scanFileAsync = function(text, fullPath) {
        if (getCurrentDocument().isDirty) {
            // flake8 cannot deal with unsaved files. Abort checks if file is unsaved
            return {
                aborted: true
            };
        }

        var result = new $.Deferred();
        pythonDomain.exec("Flake8", pythonPath, fullPath)
            .done(function (data) {

                var report = {
                    errors: data.map(function(error) {
                        return {
                            pos: {
                                line: error.row - 1,
                                ch: error.column - 1
                            },
                            message: error.code +': ' + error.text,
                            type: _getErrorSeverity(error.code)
                        }
                    }),
                    aborted: false
                }

                if (WITH_GUTTERS) {
                    window.bracketsInspectionGutters.set(
                        'bazitur.python-tools', fullPath, report, true
                        //was: EXTENSION_UNIQUE_NAME, fullPath, report, preferences.get('gutterMarks', projectRoot)
                    );
                }

                result.resolve(report);
            })
            .fail(function (error) {
                result.reject(error);
            });

        return result.promise();
    };

    module.exports = PyLint;
});
