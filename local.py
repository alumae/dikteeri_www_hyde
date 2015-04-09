# -*- coding: utf-8 -*-
from hyde.plugin import Plugin
from hyde.site import Resource
from jinja2 import contextfunction, Markup
from jinja2.utils import pformat
from babel import support
import locale

def yield_all_leaf_nodes(data, field_names):
    if isinstance(data, dict):
        for (k, v) in data.iteritems():
            if k in field_names:
                yield (0, "", v, "")
            else:
                for y in yield_all_leaf_nodes(v, field_names):
                    yield y
    elif isinstance(data, list) or isinstance(data, tuple):
        for item in data:
            for y in yield_all_leaf_nodes(item, field_names):
                yield y



def extract_yaml(fileobj, keywords, comment_tags, options):
    """Extract messages from XXX files.
    :param fileobj: the file-like object the messages should be extracted
                    from
    :param keywords: a list of keywords (i.e. function names) that should
                     be recognized as translation functions
    :param comment_tags: a list of translator tags to search for and
                         include in the results
    :param options: a dictionary of additional options (optional)
    :return: an iterator over ``(lineno, funcname, message, comments)``
             tuples
    :rtype: ``iterator``
    """
    field_names = [s.strip() for s in options.get("field_names", "").split(",")]
    import yaml
    conf = yaml.safe_load(fileobj)
    result = [r for r in yield_all_leaf_nodes(conf, field_names)]
    return result

@contextfunction
def datetime(context, val, fmt=False):
    import locale, datetime
    fmt = fmt if fmt else locale.nl_langinfo(locale.D_T_FMT)
    result = val.strftime(fmt)
    return Markup(result.decode('utf-8'))

class i18NPlugin(Plugin):

    @property
    def plugin_name(self):
        return 'i18N'

    def template_loaded(self, template):
        self.template = template
        self.resourcesById = {}
        template.env.globals['datetime'] = datetime
        template.env.add_extension('jinja2.ext.i18n')
        self.translations = {}
        for lc in self.settings.locales:
            trans = support.Translations.load(
                        dirname=self.site.sitepath.child('strings'),
                        locales=lc)
            self.translations[lc] = trans

    def begin_site(self):
        """
        Initialize plugin. Build the language tree for each node
        """
        def locale_url(self, lc):
            return self.full_url.replace('/' + self.meta.lc + '/', '/' + lc + '/')

        Resource.locale_url = locale_url

        # Build association between UUID and list of resources
        for resource in self.site.content.walk_resources():
            try:
                uuid = resource.meta.uuid
                language = resource.meta.lc
            except AttributeError:
                continue
            if uuid not in self.resourcesById:
                self.resourcesById[uuid] = []
            self.resourcesById[uuid].append(resource)
            resource.translations = self.resourcesById[uuid]

    def begin_text_resource(self, resource, text):
        try:
            lc = resource.meta.lc
            self.default_locale = locale.getlocale()
            locale.setlocale(locale.LC_ALL,
                                (lc, resource.meta.encoding))
                  
            self.template.env.install_gettext_translations(
                self.translations[lc],
                newstyle=True)
        except AttributeError: pass
        return text

    def end_text_resource(self, resource, text):
        try:
            lc = resource.meta.lc
            locale.setlocale(locale.LC_ALL, self.default_locale)
        except AttributeError: pass
        self.template.env.uninstall_gettext_translations()
        return text
