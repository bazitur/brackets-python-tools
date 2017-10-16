define(function (require, exports, module) {
    "use strict";
    var Type = brackets.getModule("language/CodeInspection").Type;

    var pythonDomain = null;
    var pythonPath = null;

    function PyLint(pyDomain, pyPath) {
        pythonDomain = pyDomain;
        pythonPath = pyPath;
    }

    PyLint.prototype.scanFileAsync = function(text, fullPath) {
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
                            type: ["E1", "E7", "E9"].indexOf(error.code.slice(0, 2)) !== -1?
                                  Type.ERROR : Type.WARNING
                        }
                    }),
                    aborted: false
                }

                if (window.bracketsInspectionGutters) {
                    window.bracketsInspectionGutters.set(
                        'brackets-python-tools', fullPath, report, true
                        //was: EXTENSION_UNIQUE_NAME, fullPath, report, preferences.get('gutterMarks', projectRoot)
                    );
                } else {
                    console.error('No bracketsInspectionGutters found on window, gutters disabled.');
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
