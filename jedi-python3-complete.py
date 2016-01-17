import json
from http.server import BaseHTTPRequestHandler, HTTPServer
import socket
import time

# sys.path.append(os.path.realpath(__file__))

import jedi


class http_completion(BaseHTTPRequestHandler):
    """
    Completion handler which returns the completions for a given source,
    line and cursor positon.
    """
    def _set_headers(self):
        """set the standard headers for a JSON response"""
        self.send_response(200)
        self.send_header("Content-type", "application/json")
        self.end_headers()

    def do_POST(self):
        """
        Payload to receive:
            source: whole source to parse
            line / column : current line and column

        Returns:
            array with dictionaries in it (name, description, docstring)
        """
        self._set_headers()

        content_length = self.headers.get('Content-Length')
        length = int(content_length)
        read = self.rfile.read(length).decode('utf-8')
        read = json.loads(read)

        if read["type"] == "goto":
            payload = goto_def(read["source"], read["line"], read["column"], read["path"])
            payload = json.dumps(payload)

        else:
            payload = completions(read["source"], read["line"], read["column"], read["path"])
            payload = json.dumps(payload)

        self.wfile.write(bytes(payload,'utf-8'))
        return


def run_server():
    """run the httpd"""
    address = ('127.0.0.1', 7777)

    while True:
        try:
            print("Starting httpd")
            httpd = HTTPServer(address, http_completion)
            httpd.serve_forever()
        except (socket.error, KeyboardInterrupt) as exc:
            if exc.__class__ == KeyboardInterrupt:
                break

            # If we cannot bind to the port sleep wait 1 second and retry.
            # This can happen when reloading Atom e.x.
            time.sleep(1)


def completions(source, line, column, path):
    """
    generate list with completions for the line and column.

    Arguments:
        source: source code to generate completion for
        line, column: current cursor position in the source code

    Returns:
        list with dictionaries containing the name, docstring and description
        for all completions.
    """
    script = jedi.api.Script(
        source = source,
        line = line + 1,
        column = column,
        path = path
    )

    completions = list()

    try:
        for completion in script.completions():
            completions.append(completion.name
#                {
#                "name": completion.name,
#                "description": completion.description,
#                "type":completion.type
#            }
            );

        return completions
    except:
        return []

def goto_def(source, line, column, path):

    try:
        script = jedi.api.Script( source, line , column ,path)
        defs = script.goto_definitions()
    except:
        return []

    if defs:
        is_built = script.goto_definitions()[0].in_builtin_module()
        module_name = script.goto_definitions()[0].module_name

    defs_string = list()
    for get in defs:
        defs_string.append({
            "type": get.type,
            "description": get.description,
            "module_path": get.module_path,
            "line": get.line,
            "column":get.column,
            "is_built_in": is_built,
            "module_name": module_name
        })
        break

    return defs_string

if __name__ == "__main__":
    run_server()
