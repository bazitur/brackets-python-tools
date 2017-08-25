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
import sys
import os
sys.path.append(os.path.dirname(__file__))
import jedi
sys.path.pop(0) # remove jedi from completion


class PythonTools:
    def __init__(self):
        pass

    def input(self):
        """
        Input single line from stdin as JSON, deserializes it and returns
        request object.
        """
        return loads(sys.stdin.readline())

    def output(self, responce):
        """
        Serializes JSON responce and writes it to a stdout.
        """
        sys.stdout.write(dumps(responce))
        sys.stdout.write('\n')

    def process(self, request):
        """
        Lookups request type and dispatches it to other methods.
        Raises error, if request type is unknown.
        """
        if request["type"] == "goto":
            return self.goto_definition(request)
        elif request["type"] == "autocomplete":
            return self.autocomplete(request)
        else:
            raise Error('Not Achievable')

    def autocomplete(self, request):
        script = jedi.api.Script(
            source = request["source"],
            line   = request["line"] + 1, # Jedi starts line count with 1
            column = request["column"],
            path   = request["path"]
        )
        completions = []
        try:
            for completion in script.completions():
                completions.append({
                    "complete":    completion.complete,    # completion
                    "name":        completion.name,        # full name?
                    "type":        completion.type,        # type of completion
                    "description": completion.description, # not that clear
                    "docstring":   completion.docstring(raw=False, fast=True) # docstring
                })
            return completions
        except:
            return []

    def goto_definition(self, request):
        try:
            script = jedi.api.Script(request["source"], request["line"],
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
