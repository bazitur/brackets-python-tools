# The MIT License (MIT)
#
# Copyright (c) 2016 K.Saravanan
# Copyright (c) 2017 Basil Miturich
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in
# all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.

from json import loads, dumps
import sys
import re
from traceback import format_tb

PY2 = sys.version_info.major == 2

if PY2:
    from string import split


def split_docstring(string):
    if PY2:
        return split(string, "\n\n", maxsplit=1)
    else:
        return string.split("\n\n", maxsplit=1)


TRIM_REGEX = r"(^[=*]+|[=*]+$)"
TRIM_REGEX = re.compile(TRIM_REGEX)

try:
    import jedi # noqa
    WITH_JEDI = True
except ImportError:
    WITH_JEDI = False

# try:
#     from tinyhtmlwriter import format_docs
#     WITH_DOCUTILS = True
# except ImportError:
#     WITH_DOCUTILS = False
# TODO: move docs styling back!

WITH_DOCUTILS = False


class PythonToolsError(Exception):
    """ Class for python tools errors """
    __name__ = "PythonToolsError"


class PythonTools:
    def __init__(self):
        self.settings = {}

    def input(self):
        """
        Input single line from stdin as JSON, deserializes it and returns
        request object.
        """
        return loads(sys.stdin.readline())

    def output(self, response):
        """
        Serializes JSON response and writes it to a stdout.
        """
        sys.stdout.write(dumps(response))
        sys.stdout.write("\n")

    def process(self, request):
        """
        Lookups request type and dispatches it to other methods.
        Raises error, if request type is unknown.
        """
        dispatches = {
            "goto": self.goto_definition,
            "docs": self.get_documentation,
            "setup": self.setup,
            "paramter_hint": self.parameter_hint,
            "autocomplete": self.autocomplete
        }
        processor = dispatches.get(request.get("type", None), None)
        try:
            if processor is None:
                raise PythonToolsError('Unknown command "%s"' % request["type"])
            else:
                return {
                    "status": "OK",
                    "content": processor(request)
                }
        except Exception as E:
            return {
                "status": "ERROR",
                "error": {
                    "name": E.__class__.__name__,
                    "value": str(E),
                    "traceback": format_tb(sys.exc_info()[2])
                }
            }

    def _script_from_request(self, request):
        if not WITH_JEDI:
            raise PythonToolsError("Jedi unawailable")
        return jedi.api.Script(
            source=request["source"],
            line=request["line"] + 1,       # Jedi starts line count with 1
            column=request["column"],
            path=request["path"]
        )

    def setup(self, request):
        """
        Set up initial settings.
        """
        settings = request["settings"]

        if WITH_JEDI:
            jedi.settings.case_insensitive_completion = \
                not settings["is_case_sensitive"]

        return {
            "with_jedi": WITH_JEDI,
            "with_docutils": WITH_DOCUTILS
        }

    def autocomplete(self, request):
        script = self._script_from_request(request)
        completions = []
        for completion in script.completions():
            docstring = completion.docstring(raw=True, fast=True)
            if completion.type == "keyword":
                continue
            completions.append({
                "complete":    completion.complete,
                "name":        completion.name,
                "type":        completion.type,
                "description": completion.description,
                "docstring":   docstring
            })
        # TODO: sort completions here!
        return completions

    def format_title(self, title):
        return TRIM_REGEX.sub("", title)

    def get_documentation(self, request):
        script = self._script_from_request(request)

        response = {
            "docs": None,
            "formatted": False,
            "title": None
        }

        completions = script.completions()

        if len(completions) > 0:
            completion = completions[0]
            docstring = completion.docstring(raw=False, fast=False)
            if "\n\n" in docstring:
                title, body = split_docstring(docstring)
                if body.strip():
                    if WITH_DOCUTILS:
                        docs = body
#                        try:
#                            docs = format_docs(body)
#                            response["formatted"] = True
#                        except:
#                            docs = body
                    else:
                        docs = body
                    response["docs"] = docs
                    response["title"] = self.format_title(title)
        return response

    def goto_definition(self, request):
        script = self._script_from_request(request)
        assignments = list(script.goto_assignments())
        definitions = list(script.goto_definitions())

        if assignments:
            goto = assignments
        elif definitions and not definitions[0].in_builtin_module():
            goto = definitions
        else:
            return {"success": False}

        definition = goto[0]
        return {
            "path":    definition.module_path,
            "line":    definition.line,
            "column":  definition.column,
            "success": True
        }

    def parameter_hint(self, request):
        # it looks like parameter hinting is not a part of standart Brackets API
        raise NotImplemented

    def watch(self):
        """
        Wait for input, delegate it to self.process, and output its response.
        """
        while True:
            request = self.input()
            response = self.process(request)
            self.output(response)


if __name__ == "__main__":
    python_tools = PythonTools()
    python_tools.watch()
