# The MIT License (MIT)
#
# Copyright (c) 2016 K.Saravanan
# Copyright (c) 2017 Basil Miturich
#
# Permission is hereby granted, free of charge, to any person obtaining a copy of
# this software and associated documentation files (the "Software"), to deal in
# the Software without restriction, including without limitation the rights to use,
# copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
# Software, and to permit persons to whom the Software is furnished to do so,
# subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
# FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
# COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
# IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
# CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

from json import loads, dumps
from docutils.core import publish_parts
import sys
import os
from tinyhtmlwriter import format_docs
sys.path.append(os.path.dirname(__file__))
import jedi
sys.path.pop(0) # remove jedi from completion

jedi.settings.case_insensitive_completion = False
#TODO: add case sensitivity to settings

class PythonToolsError(Exception):
    """ Class for python tools errors """
    pass

class PythonTools:
    def __init__(self):
        pass

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
        sys.stdout.write('\n')

    def process(self, request):
        """
        Lookups request type and dispatches it to other methods.
        Raises error, if request type is unknown.
        """
        dispatches = {
            "goto": self.goto_definition,
            "docs": self.get_documentation,
            "setup": self.setup,
            "code_hint": self.code_hint,
            "autocomplete": self.autocomplete
        }
        processor = dispatches.get(request["type"], None)
        if processor is None:
            raise PythonToolsError('Unknown command "%s"' % request["type"])
        else:
            try:
                return processor(request)
            except Exception as E:
                raise #TODO

    def _script_from_request(self, request):
        return jedi.api.Script(
            source = request["source"],
            line   = request["line"] + 1, # Jedi starts line count with 1
            column = request["column"],
            path   = request["path"]
        )

    def setup(self, request):
        """
        Set up initial settings.
        """
        raise NotImplemented

    def autocomplete(self, request):
        script = self._script_from_request(request)
        completions = []
        try:
            for completion in script.completions():
                docstring = completion.docstring(raw=True, fast=True)
                if completion.type == "keyword":
                    docstring = ""
                completions.append({
                    "complete":    completion.complete,    # completion, only ending
                    "name":        completion.name,        # full completion
                    "type":        completion.type,        # type of completion
                    "description": completion.description,
                    "docstring":   docstring
                })
            #TODO: sort completions here!
            return completions[:50] #TODO: replace 50 with brackets `maxCodeHints` setting
        except:
            return []

    def get_documentation(self, request):
        script = self._script_from_request(request)

        response = {
            "docs": None,
            "title": None
        }

        completions = script.completions()
        definitions = script.goto_definitions()

        if len(completions) > 0:
            completion = completions[0]
            docstring = completion.docstring(raw=False, fast=False)
            if '\n\n' in docstring:
                title, body = docstring.split('\n\n', maxsplit=1)
                if body.strip():
                    response["docs"] = format_docs(body)
                    response["title"] = title

        return response

    def goto_definition(self, request):
        try:
            script = jedi.api.Script(request["source"], request["line"] + 1,
                                     request["column"], request["path"])
            definitions = script.goto_definitions()
        except:
            return []

        if not definitions:
            return []

        definition = definitions[0]
        is_built_in = definition.in_builtin_module()
        module_name = definition.module_name

        response = [{
            "module_path": definition.module_path,
            "line":        definition.line,
            "column":      definition.column,
            "is_built_in": is_built_in
        }]
        return response

    def code_hint(self, request):

        return {}

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
