# brackets-python-tools: Easy Python development with Brackets

A set of tools which will make Brackets your favourite backend IDE.

## Features
  - Smart autocompletion
  - Go to definition/assignment
  - Inline Python documentation
  - Linter

## Installation
You can install Python Tools from official Brackets Extension Registry.
Additionally, you'll need:
  - Python up and running (Python 3 preferably)
  - `jedi` and `flake8` python modules installed. You can install them via pip:
    ```bash
    ~$ pip install jedi flake8
    ```
  - `docutils` module (optional) for docs rendering. It can be install with pip as well:
    ```bash
    ~$ pip install docutils
    ```

## Usage
This Extension uses Python 3 interpreter in your path by default. You can customize interpreter either in Preferences File or in Python Tools tab.

## Settings
Settings are accessible through standart brackets settings interface or 'File' menu 🡒 Python Tools Settings.

Currently available settings:
  - `pathToPython`: String
    Full path to python executable. Default value is `python3`.
  - `isCaseSensitive`: Boolean
    If code completion should be case sensitive. Default is `true`.

## Credits
This project is based on the [Python Jedi Project](https://github.com/saravanan-k90/python-jedi-brackets).

## License
The source code is licensed MIT. See LICENSE.md for more.