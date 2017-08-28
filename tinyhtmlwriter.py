# -*- coding: utf-8 -*-
"""
Docutils Tiny HTML Writer is another docutils html writer, with very light html
output. It will create mainly for use in other project's like doc generators or
web publishers, which want to use their own html headers and footers.
"""

__author__ = "Ondřej Tůma (McBig) <mcbig@zeropage.cz>"
__date__ = "27 Jun 2015"
__version__ = "1.2.0"
__docformat__ = 'reStructuredText'
__url__ = "https://github.com/ondratu/docutils-tinyhtmlwriter"

from docutils import nodes as n, writers
from docutils.transforms import writer_aux
from docutils.core import publish_string, publish_parts
from docutils.frontend import validate_nonnegative_int, validate_boolean, \
    validate_comma_separated_list

# import sys


class Writer(writers.Writer):
    """ Writer compatible class for docutils. """

    supported = ('html', 'xhtml')
    """Formats this writer supports."""

    settings_spec = (
        'HTML-Specific Options',
        None,
        (('Link label for headers.',
          ['--link'], {}),
         ('Top label for headers.',
          ['--top'], {}),
         ('Specify the initial header level.  Default is 1 for "<h1>".  '
          'Does not affect document title & subtitle (see --no-doc-title).',
          ['--initial-header-level'],
          {'choices': '1 2 3 4 5 6'.split(), 'default': 1,
           'metavar': '<level>', 'validator': validate_nonnegative_int}),
         ('Disable the system messages in output html.',
          ['--no-system-messages'],
          {'default': 0, 'action': 'store_true',
           'validator': validate_boolean}),
         ('Enable html hyperlinks in footnotes section.',
          ['--foot-hyperlinks'],
          {'default': 0, 'action': 'store_true',
           'validator': validate_boolean}),
         ('Comma separated list of stylesheet URLs or FILEs.',
          ['--stylesheet'],
          {'metavar': 'URL[,URL,...]', 'default': '',
           'validator': validate_comma_separated_list}),
         ('Embed the stylesheet(s) in the output HTML file.  The stylesheet '
          'files must be accessible during processing. This is NOT default.',
          ['--embed-stylesheet'],
          {'default': 0, 'action': 'store_true',
           'validator': validate_boolean}),
         ))
    settings_defaults = {}

    output = None
    visitor_attributes = (
        'head_prefix', 'head', 'stylesheet', 'body_prefix',
        'docinfo', 'html_title', 'body',
        'html_line', 'html_footnotes', 'html_citations', 'html_hyperlinks',
        'body_suffix'
    )
    visitor_addons = ('title', 'sections', 'hyperlinks')

    def __init__(self):
        writers.Writer.__init__(self)
        self.translator_class = HTMLTranslator

    def translate(self):
        visitor = self.visitor = self.translator_class(self.document)
        self.document.walkabout(visitor)
        self.output = ''.join(
            sum((getattr(visitor, a) for a in self.visitor_attributes), []))

    def get_transforms(self):
        return writers.Writer.get_transforms(self) + [writer_aux.Admonitions]

    def assemble_parts(self):
        writers.Writer.assemble_parts(self)
        for part in self.visitor_attributes:
            self.parts[part] = ''.join(getattr(self.visitor, part))
        for part in self.visitor_addons:
            self.parts[part] = getattr(self.visitor, part)


class HTMLTranslator(n.NodeVisitor, object):
    list_types = {'arabic': '1',
                  'loweralpha': 'a',
                  'upperalpha': 'A',
                  'lowerroman': 'i',
                  'upperroman': 'I',
                  '-': 'disc',
                  '*': 'circle',
                  '+': 'square'}
    admonitions = ('attention', 'caution', 'danger', 'error', 'hint',
                   'important', 'note', 'tip', 'warning')
    html_escape_table = {'&': "&amp;",
                         '"': "&quot;",
                         "'": "&apos;",
                         '>': "&gt;",
                         '<': "&lt;"}
    head = [
        '<meta http-equiv="Content-Type" '
        'content="text/html; charset=utf-8">\n',
        '<meta name="viewport" '
        'content="width=device-width, initial-scale=1.0">\n',
        '<meta name="generator" content="docutils-tinyhtmlwriter %s %s">\n' %
        (__version__, __url__)]

    def __init__(self, document):
        super(HTMLTranslator, self).__init__(document)
        self.settings = document.settings
        self.section_level = self.settings.initial_header_level
        self.head_prefix = [
            '<!DOCTYPE html>\n',
            '<html lang="%s">\n' % self.settings.language_code,
            '<head>\n']
        self.stylesheet = []
        # compatible fix with docutils_html5 writer...
        # FIXME: better is check if instance is str or unicode...
        if not isinstance(self.settings.stylesheet, (list, tuple)):
            self.settings.stylesheet = self.settings.stylesheet.strip()
            if self.settings.stylesheet:
                self.settings.stylesheet = [self.settings.stylesheet]

        if self.settings.embed_stylesheet:
            for stylesheet in self.settings.stylesheet:
                with open(stylesheet, 'rt') as style:
                    self.stylesheet.append(
                        '<style type="text/css">\n%s</style>\n' % style.read())
        else:
            for stylesheet in self.settings.stylesheet:
                self.stylesheet.append(
                    '<link rel="stylesheet" href="%s" type="text/css" />\n' %
                    stylesheet)
        self.body_prefix = ['</head>\n', '<body>\n']
        self.title = ''
        self.html_title = []
        self.docinfo = []           # TODO: use for docinfo
        self.body = []
        self.body_suffix = ['</body>\n', '</html>\n']
        self.subtitle = []          # TODO: for subtitle
        self.html_line = []
        self.html_footnotes = []
        self.html_citations = []
        self.html_hyperlinks = []
        self._references = {}

        # addons
        self.sections = []
        self.footnotes = []         # TODO
        self.citations = []         # TODO
        self.hyperlinks = []        # list of tuples hyperlinks references

        for admonition in self.admonitions:
            self.__setattr__('visit_%s' % admonition, self.visit_admonition)
            self.__setattr__('depart_%s' % admonition, self.depart_admonition)

        for div in ('figure', 'caption', 'legend', 'topic', 'sidebar',
                    'line_block', 'line'):
            self.__setattr__('visit_%s' % div, self.visit_div)
            self.__setattr__('depart_%s' % div, self.depart_div)

        for tbl in ('field_list', 'option_list', 'docinfo'):
            self.__setattr__('visit_%s' % tbl, self.visit_table)
            self.__setattr__('depart_%s' % tbl, self.depart_table)
        for row in ('field', 'option_list_item'):
            self.__setattr__('visit_%s' % row, self.visit_row)
            self.__setattr__('depart_%s' % row, self.depart_row)
        for col in ('field_name', 'field_body', 'option_group', 'description'):
            self.__setattr__('visit_%s' % col, self.visit_entry)
            self.__setattr__('depart_%s' % col, self.depart_entry)

    def html_escape(self, node):
        return "".join(self.html_escape_table.get(c, c) for c in node.astext())

    def visit_div(self, node):
        self.body.append('<div class="%s">' % node.tagname)

    def depart_div(self, node):
        self.body.append('</div>\n')

    def visit_document(self, node):
        self.title = node.get('title', '')
        self.head.append('<title>%s</title>\n' % self.title)

    def depart_document(self, node):
        if self.html_footnotes or self.html_citations or self.html_hyperlinks:
            self.html_line.append('<hr class="under-line">\n')

            if self.html_footnotes:
                self.html_footnotes.insert(0, '<table class="footnotes">\n')
                self.html_footnotes.append('</table>\n')
            if self.html_citations:
                self.html_citations.insert(0, '<table class="citations">\n')
                self.html_citations.append('</table>\n')
            if self.html_hyperlinks:
                self.html_hyperlinks.insert(0, '<table class="hyperlinks">\n')
                self.html_hyperlinks.append('</table>\n')

    def visit_meta(self, node):
        self.head.append(str(node)[:-2]+'>\n')

    def depart_meta(self, node):
        pass

    def visit_authors(self, node):
        self.head.append('<meta name="authors" content="%s">\n' %
                         self.html_escape(node).replace('\n', ' '))
        self.body.append('<tr><th>Authors:</th><td>%s</td></tr>\n' %
                         self.html_escape(node))
        raise n.SkipNode

    def visit_author(self, node):
        self.head.append('<meta name="author" content="%s">\n' %
                         self.html_escape(node).replace('\n', ''))
        raise n.SkipNode

    def visit_version(self, node):
        self.body.append('<tr><th>Version:</th><td>%s</td></tr>\n' %
                         self.html_escape(node))
        raise n.SkipNode

    def visit_status(self, node):
        self.body.append('<tr><th>Status:</th><td>%s</td></tr>\n' %
                         self.html_escape(node))
        raise n.SkipNode

    def visit_block_quote(self, node):
        self.body.append('<blockquote>\n')

    def depart_block_quote(self, node):
        self.body.append('</blockquote>\n')

    def visit_paragraph(self, node):
        self.body.append('<p>')

    def depart_paragraph(self, node):
        self.body.append('</p>')
        parent_classes = tuple(
            getattr(n, it) for it in ('field_body', 'entry', 'admonition') +
                                     (self.admonitions))
        if isinstance(node.parent, parent_classes):
            self.body.append('\n')
        elif node.parent.tagname not in \
                ('list_item', 'definition', 'footnote', 'citation'):
            self.body.append('\n\n')

    def visit_Text(self, node):
        self.body.append(self.html_escape(node))
        if isinstance(node.parent, n.field_name):
            self.body.append(':')

    def depart_Text(self, node):
        pass

    def visit_literal(self, node):
        self.body.append('<code>')

    def depart_literal(self, node):
        self.body.append('</code>')

    def visit_literal_block(self, node):
        attrs = ' class="%s"' % \
                ' '.join(node['classes']) if node['classes'] else ''
        if node['ids']:
            attrs += ' id="%s"' % node['ids'][0]
        self.body.append('<pre%s>\n' % attrs)

    def depart_literal_block(self, node):
        self.body.append('\n</pre>\n')

    def visit_doctest_block(self, node):
        self.body.append('<pre class="doctest">\n')

    def depart_doctest_block(self, node):
        self.body.append('\n</pre>\n')

    def visit_math_block(self, node):
        self.body.append('<pre class="math">\n')

    def depart_math_block(self, node):
        self.body.append('\n</pre>\n')

    def visit_inline(self, node):
        classes = node.get('classes', [])
        if isinstance(node.parent, n.literal_block):
            if 'keyword' in classes:
                self.body.append('<b>')
            elif 'function' in classes or 'class' in classes:
                self.body.append('<em>')
            elif 'escape' in classes:
                self.body.append('<i><b>')
            elif 'string' in classes:
                self.body.append('<i>')
            elif 'comment' in classes:
                self.body.append('<i>')
            elif 'decorator' in classes:
                self.body.append('<var>')
            elif 'number' in classes:
                self.body.append('<u>')
            elif 'operator' in classes and 'word' in classes:
                self.body.append('<tt>')
            elif 'builtin' in classes or 'exception' in classes:
                self.body.append('<kbd>')
        else:
            cls = ' class="%s"' % ' '.join(classes) if classes else ''
            self.body.append('<span%s>' % cls)

    def depart_inline(self, node):
        if isinstance(node.parent, n.literal_block):
            classes = node.get('classes', [])
            if 'keyword' in classes:
                self.body.append('</b>')
            elif 'function' in classes or 'class' in classes:
                self.body.append('</em>')
            elif 'escape' in classes:
                self.body.append('</b></i>')
            elif 'string' in classes:
                self.body.append('</i>')
            elif 'comment' in classes:
                self.body.append('</i>')
            elif 'decorator' in classes:
                self.body.append('</var>')
            elif 'number' in classes:
                self.body.append('</u>')
            elif 'operator' in classes and 'word' in classes:
                self.body.append('</tt>')
            elif 'builtin' in classes or 'exception' in classes:
                self.body.append('</kbd>')
        else:
            self.body.append('</span>')

    def visit_bullet_list(self, node):
        self.body.append('<ul type="%s">\n' %
                         self.list_types[node.get('bullet', '*')])

    def depart_bullet_list(self, node):
        self.body.append('</ul>\n\n')

    def visit_enumerated_list(self, node):
        self.body.append('<ol type="%s">\n' %
                         self.list_types[node['enumtype']])

    def depart_enumerated_list(self, node):
        self.body.append('</ol>\n\n')

    def visit_list_item(self, node):
        self.body.append('<li>')

    def depart_list_item(self, node):
        self.body.append('</li>\n')

    def visit_definition_list(self, node):
        self.body.append('<dl>\n')

    def depart_definition_list(self, node):
        self.body.append('</dl>\n')

    def visit_definition_list_item(self, node):
        pass

    def depart_definition_list_item(self, node):
        pass

    def visit_footnote_reference(self, node):
        self.body.append('<a href="#%s">' % node.get('refid'))

    def depart_footnote_reference(self, node):
        self.body.append('</a>')

    def visit_footnote(self, node):
        self.context = self.body
        self.body = self.html_footnotes
        self.body.append('<tr>')
        self.body.append('<td><a name="%s"></a>' % node['ids'][0])

    def depart_footnote(self, node):
        self.body.append('</td></tr>\n')
        self.body = self.context

    def visit_citation_reference(self, node):
        self.body.append('<a href="#%s">[' % node['refid'])

    def depart_citation_reference(self, node):
        self.body.append(']</a>')

    def visit_citation(self, node):
        self.context = self.body
        self.body = self.html_citations
        self.body.append('<tr>')
        self.body.append('<td><a name="%s"></a>' % node['names'][0])

    def depart_citation(self, node):
        self.body.append('</td></tr>\n')
        self.body = self.context

    def visit_label(self, node):
        if isinstance(node.parent, (n.footnote, n.citation)):
            self.body.append('<b>[ ')

    def depart_label(self, node):
        if isinstance(node.parent, (n.footnote, n.citation)):
            self.body.append(' ]</b></td><td>')

    def visit_emphasis(self, node):
        self.body.append('<em>')

    def depart_emphasis(self, node):
        self.body.append('</em>')

    def visit_strong(self, node):
        self.body.append('<b>')

    def depart_strong(self, node):
        self.body.append('</b>')

    def visit_title_reference(self, node):
        self.body.append('<cite>')

    def depart_title_reference(self, node):
        self.body.append('</cite> ')

    def visit_reference(self, node):
        if 'refuri' in node:
            self.body.append('<a href="%s">' %
                             node['refuri'].replace('&', '&amp;'))
            if 'name' in node:
                self._references[node['name'].lower()] = node['name']
        else:
            self.body.append('<a href="#%s">' % node['refid'])

    def depart_reference(self, node):
        self.body.append('</a>')

    def visit_substitution_reference(self, node):
        raise RuntimeError()

    def visit_substitution_definition(self, node):
        raise n.SkipNode

    def visit_target(self, node):
        if 'refid' in node:
            self.body.append('<a name="%s"></a>' % node['refid'])
        if 'refuri' in node and node['names']:
            name = node['names'][0]
            if self.settings.foot_hyperlinks and name in self._references:
                refuri = node['refuri']
                self.hyperlinks.append((self._references[name], refuri))
                refuri = refuri.replace('&', '&amp;')
                self.html_hyperlinks.append(
                    '<tr><th>%s</th><td><a href="%s">%s</a></td></tr>\n' %
                    (self._references[name], refuri, refuri))

    def depart_target(self, node):
        pass

    def visit_raw(self, node):
        if 'html' in node['format']:
            self.body.append("%s\n" % node.astext())
            raise n.SkipNode

    def depart_raw(self, node):
        pass

    def visit_section(self, node):
        if 'system-messages' in node['classes']:
            if self.settings.no_system_messages:
                raise n.SkipNode
        else:
            self.section_level += 1
            ids = node['ids'][0]
            name = node['names'][0] if node['names'] else node['dupnames']

            self.body.append('\n<a name="%s"></a>' % ids)
            self.sections.append((self.section_level, name, ids))

    def depart_section(self, node):
        if 'system-messages' not in node['classes']:
            self.section_level -= 1

    def visit_title(self, node):
        # TODO: sections will append from here if parent.tagname == section
        if isinstance(node.parent, n.section) \
                and 'system-messages' not in node.parent['classes']:
            if self.section_level != 1:
                lvl, name, ids = self.sections[-1]
                # update section name
                self.sections[-1] = (lvl, self.html_escape(node), ids)
            if self.section_level < 7:
                self.body.append('<h%d>' % self.section_level)
            else:
                self.body.append('<div class="h%d">' % self.section_level)
        else:
            if isinstance(node.parent, n.document):
                self.context = self.body
                self.body = self.html_title
                self.title = self.html_escape(node)
                self.body.append('<h1 class="title">')
            else:
                self.body.append('<div class="title">')

    def depart_title(self, node):
        if isinstance(node.parent, n.section) \
                and 'system-messages' not in node.parent['classes']:
            if self.section_level != 1 and \
                    (self.settings.link or self.settings.top):
                last_section = self.sections[-1]
                self.body.append('<span class="links">')
                if self.settings.link:
                    self.body.append('<a href="#%s">%s</a>' %
                                     (last_section[2], self.settings.link))
                if self.settings.link and self.settings.top:
                    self.body.append(' | ')
                if self.settings.top:
                    self.body.append('<a href="#">%s</a>' % self.settings.top)
                self.body.append('</span>')

        if self.section_level < 7 and isinstance(node.parent, n.section) \
                and 'system-messages' not in node.parent['classes']:
            self.body.append('</h%d>\n' % self.section_level)
        else:
            if isinstance(node.parent, n.document):
                self.body.append('</h1>\n')
                self.body = self.context
            else:
                self.body.append('</div>\n')

    def visit_subtitle(self, node):
        if isinstance(node.parent, n.document):
            self.body.append('<h2>')
        else:
            self.body.append('<p class="subtitle">')

    def depart_subtitle(self, node):
        if isinstance(node.parent, n.document):
            self.body.append('</h2\n>')
        else:
            self.body.append('</p>\n')

    def visit_term(self, node):
        self.body.append('<dt>')

    def depart_term(self, node):
        pass

    def visit_definition(self, node):
        self.body.append('</dt>\n')
        self.body.append('<dd>')

    def depart_definition(self, node):
        self.body.append('</dd>\n')

    def visit_classifier(self, node):
        self.body.append(': <tt>')

    def depart_classifier(self, node):
        self.body.append('</tt>')

    def visit_system_message(self, node):
        if self.settings.no_system_messages:
            raise n.SkipNode
        self.body.append('<fieldset>\n')
        self.body.append('<legend>System message</legend>\n')

    def depart_system_message(self, node):
        self.body.append('</fieldset>\n\n')

    def visit_image(self, node):
        attrs = 'src="%s"' % node['uri']
        if 'alt' in node:
            attrs += ' alt="%s"' % node['alt']
        if 'width' in node:
            attrs += ' width="%s"' % node['width']
        if 'height' in node:
            attrs += ' height="%s"' % node['height']
        if node['ids']:
            attrs += ' id="%s"' % node['ids'][0]
        self.body.append("<img %s>" % attrs)

    def depart_image(self, node):
        pass

    # ---- Tables part
    def visit_table(self, node):
        cls = ' class="%s"' % \
            node.tagname if not isinstance(node, n.table) else ''
        self.body.append('<table%s>\n' % cls)

    def depart_table(self, node):
        self.body.append('</table>\n')

    def visit_tgroup(self, node):
        pass

    def depart_tgroup(self, node):
        pass

    def visit_colspec(self, node):
        pass

    def depart_colspec(self, node):
        pass

    def visit_thead(self, node):
        self.body.append('<thead>')

    def depart_thead(self, node):
        self.body.append('</thead>\n')

    def visit_tbody(self, node):
        self.body.append('<tbody>')

    def depart_tbody(self, node):
        self.body.append('</tbody>\n')

    def visit_row(self, node):
        self.body.append('<tr>')

    def depart_row(self, node):
        self.body.append('</tr>\n')

    def visit_entry(self, node):
        colspan = ' colspan=%d' % \
                  (int(node['morecols'])+1) if 'morecols' in node else ''
        rowspan = ' rowspan=%d' % \
                  (int(node['morerows'])+1) if 'morerows' in node else ''
        if isinstance(node.parent, n.thead) \
                or isinstance(node, n.field_name):
            self.body.append('<th%s>' % (colspan + rowspan))
        else:
            self.body.append('<td%s>' % (colspan + rowspan))

    def depart_entry(self, node):
        if isinstance(node.parent, n.thead) \
                or isinstance(node, n.field_name):
            self.body.append('</th>')
        else:
            self.body.append('</td>')

    # ---- Options part
    def visit_option(self, node):
        self.body.append('<code>')

    def depart_option(self, node):
        self.body.append('</code>')

    def visit_option_string(self, node):
        pass

    def depart_option_string(self, node):
        self.body.append(' ')

    def visit_option_argument(self, node):
        self.body.append('<i>')

    def depart_option_argument(self, node):
        self.body.append('</i>')

    def visit_transition(self, node):
        self.body.append('<hr>')

    def depart_transition(self, node):
        pass

    def visit_admonition(self, node):
        self.body.append('<fieldset class="%s">\n' % node.tagname)
        self.body.append('<legend>%s</legend>\n' % node.tagname.capitalize())

    def depart_admonition(self, node):
        self.body.append('</fieldset>\n\n')

    def visit_comment(self, node):
        self.body.append('<!-- ')

    def depart_comment(self, node):
        self.body.append(' -->\n')

    def visit_pending(self, node):
        raise n.SkipNode

    def visit_problematic(self, node):
        self.body.append('<span class="problematic">')

    def depart_problematic(self, node):
        self.body.append('</span>')

def format_docs(rst):
    # store full html output to html variable
    writer = Writer()
    html = publish_string(source=rst,
                          writer=writer,
                          writer_name='html',
                          settings_overrides={'link': 'link', 'top': 'top'})

    # disable system message in html, no in stderr
    parts = publish_parts(source=rst,
                          writer=writer,
                          writer_name='html',
                          settings_overrides={'report_level': 5})

    # store only html body
    body = parts['html_title'] + parts['body'] + parts['html_line'] + \
        parts['html_footnotes'] + parts['html_citations'] + \
        parts['html_hyperlinks']

    return body
