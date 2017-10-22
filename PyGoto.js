define(function (require, exports, module) {
    "use strict";

    var isWithinProject = brackets.getModule("project/ProjectManager").isWithinProject,
        EditorManager   = brackets.getModule("editor/EditorManager"),
        Commands        = brackets.getModule("command/Commands"),
        CommandManager  = brackets.getModule("command/CommandManager");

    var pythonAPI = null;

    function pyGoto(pyAPI) {
        pythonAPI = pyAPI;
    }

    pyGoto.prototype.goto = function(hostEditor, cursor) {
        if (hostEditor.getModeForDocument() !== "python") {
            return null;
        }

        var result = new $.Deferred();
        pythonAPI({
            "type":   "goto",
            "path":   hostEditor.document.file.fullPath,
            "line":   cursor.line,
            "column": cursor.ch,
            "source": hostEditor.document.getText()
        }).done(function (response) {
            if (response.success && isWithinProject(response.path)) {
                CommandManager.execute(Commands.FILE_OPEN, {fullPath: response.path})
                    .done(function () {
                        var currentEditor = EditorManager.getActiveEditor();
                        currentEditor.setCursorPos(response.line-1, response.column, true);
                        currentEditor.selectWordAt({line: response.line-1, ch: response.column});
                        result.resolve();
                    });
            } else {
                result.reject();
            }
        }).fail(function (error) {
            console.error(error);
            result.reject();
        });

        return result.promise();
    };

    module.exports = pyGoto;
});
