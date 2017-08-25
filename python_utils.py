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

import json
import sys
import os
sys.path.append(os.path.dirname(__file__))
import jedi
sys.path.pop(0) # remove jedi from completion

def main(read):
    if read["type"] == "goto":      # GOTO definition, probably?
        payload = goto_def(read["source"], read["line"], read["column"], read["path"])
    else:                           # Autocomplete?
        payload = completions(read["source"], read["line"], read["column"], read["path"])
    return payload

def completions(source, line, column, path):
    script = jedi.api.Script(
        source = source,
        line = line + 1,
        column = column,
        path = path
    )
    completions = []
    try:
        for completion in script.completions():
            completions.append({
                "complete":    completion.complete,    # completion
                "name":        completion.name,        # full name?
                "type":        completion.type,        # type of completion
                "description": completion.description, # not tht clear
                "docstring":   completion.docstring(raw=False, fast=True) # docstring
            })
        return completions
    except:
        return []

def goto_def(source, line, column, path):
    try:
        script = jedi.api.Script(source, line, column, path)
        defs = script.goto_definitions()
    except:
        return []
    if defs:
        is_built = script.goto_definitions()[0].in_builtin_module()
        module_name = script.goto_definitions()[0].module_name

    defs_string = list()
    for get in defs:
        defs_string.append({
            "module_path": get.module_path,
            "line": get.line,
            "column":get.column,
            "is_built_in": is_built,
        })
        break

    return defs_string

if __name__ == "__main__":
    while True:
        inp = sys.stdin.readline()
        inp = json.loads(inp)
        out = json.dumps(main(inp))
        sys.stdout.write(out)
        sys.stdout.write('\n')
