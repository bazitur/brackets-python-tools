define(function (require, exports, module) {
    "use strict";

    var Dialogs         = brackets.getModule("widgets/Dialogs"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        InlineWidget    = brackets.getModule("editor/InlineWidget").InlineWidget,
        KeyEvent        = brackets.getModule("utils/KeyEvent"),
        Mustache        = brackets.getModule("thirdparty/mustache/mustache");

    // Lines height for scrolling
    var SCROLL_LINE_HEIGHT = 40;
    var docsTemplate = require("text!templates/docs.html");
    var pythonAPI = null;


    function PyDocs(pyAPI) {
        pythonAPI = pyAPI;
        return inlineProvider;
    }

    // Load template
    function inlineProvider(hostEditor, pos) {
        var langId = hostEditor.getLanguageForSelection().getId();
        if (langId !== "python") return null;

        var cursor   = hostEditor.getCursorPos(true),
            word     = hostEditor._codeMirror.findWordAt(cursor),
            line     = hostEditor.document.getRange({line: word.anchor.line, ch: 0}, word.head),
            result   = new $.Deferred(),
            request  = {
                source: DocumentManager.getCurrentDocument().getText(), // file contents
                line:   cursor.line,                                    // line no., starting with 0
                column: cursor.ch,                                      // column no.
                path:   hostEditor.document.file._path,                 // file path
                type:   'docs'                                          // type of query
            };
        pythonAPI(request)
            .done(function (response) {
                if (response.docs === null) {
                    result.reject();
                }
                var inlineWidget = new InlineDocsViewer(response);
                inlineWidget.load(hostEditor);
                result.resolve(inlineWidget);
            })
            .fail(function () {
                result.reject();
            });

        return result.promise();
    }

    function InlineDocsViewer(docs) {
        InlineWidget.call(this);

        var html = Mustache.render(docsTemplate, docs);

        this.$wrapperDiv = $(html);
        this.$htmlContent.append(this.$wrapperDiv);

        Dialogs.addLinkTooltips(this.$wrapperDiv);

        this.$scroller = this.$wrapperDiv.find(".scroller");
        this._onKeydown = this._onKeydown.bind(this);
    }

    InlineDocsViewer.prototype = Object.create(InlineWidget.prototype);
    InlineDocsViewer.prototype.constructor = InlineDocsViewer;
    InlineDocsViewer.prototype.parentClass = InlineWidget.prototype;

    InlineDocsViewer.prototype.$wrapperDiv = null;
    InlineDocsViewer.prototype.$scroller = null;

    /**
     * Convert keydown events into navigation actions.
     *
     * @param {KeyboardEvent} event
     * @return {boolean} indication whether key was handled
     */
    InlineDocsViewer.prototype._onKeydown = function (event) {
        var keyCode  = event.keyCode,
            scroller = this.$scroller[0],
            scrollPos;

        // Ignore key events with modifier keys
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
            return false;
        }

        // Handle keys that we're interested in
        scrollPos = scroller.scrollTop;

        switch (keyCode) {
        case KeyEvent.DOM_VK_UP:
            scrollPos = Math.max(0, scrollPos - SCROLL_LINE_HEIGHT);
            break;
        case KeyEvent.DOM_VK_PAGE_UP:
            scrollPos = Math.max(0, scrollPos - scroller.clientHeight);
            break;
        case KeyEvent.DOM_VK_DOWN:
            scrollPos = Math.min(scroller.scrollHeight - scroller.clientHeight,
                                 scrollPos + SCROLL_LINE_HEIGHT);
            break;
        case KeyEvent.DOM_VK_PAGE_DOWN:
            scrollPos = Math.min(scroller.scrollHeight - scroller.clientHeight,
                                 scrollPos + scroller.clientHeight);
            break;
        default:
            // Ignore other keys
            return false;
        }

        scroller.scrollTop = scrollPos;

        // Disallow further processing
        event.stopPropagation();
        event.preventDefault();
        return true;
    };

    InlineDocsViewer.prototype.onAdded = function () {
        InlineDocsViewer.prototype.parentClass.onAdded.apply(this, arguments);

        // Set height initially, and again whenever width might have changed (word wrap)
        this._sizeEditorToContent();
        $(window).on("resize", this._sizeEditorToContent);

        // Set focus
        this.$scroller[0].focus();
        this.$wrapperDiv[0].addEventListener("keydown", this._onKeydown, true);
    };

    InlineDocsViewer.prototype.onClosed = function () {
        InlineDocsViewer.prototype.parentClass.onClosed.apply(this, arguments);

        $(window).off("resize", this._sizeEditorToContent);
        this.$wrapperDiv[0].removeEventListener("keydown", this._onKeydown, true);
    };

    InlineDocsViewer.prototype._sizeEditorToContent = function () {
        this.hostEditor.setInlineWidgetHeight(this, this.$wrapperDiv.height() + 20, true);
    };

    module.exports = PyDocs;
});
