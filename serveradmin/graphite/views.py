from urllib.request import (
    HTTPBasicAuthHandler,
    HTTPPasswordMgrWithDefaultRealm,
    build_opener
)

from django.http import Http404, HttpResponseBadRequest, HttpResponse
from django.template.response import TemplateResponse
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from django.conf import settings

from adminapi.dataset.base import DatasetError, MultiAttr
from serveradmin.graphite.models import Collection
from serveradmin.dataset import query


@login_required     # NOQA: C901
@ensure_csrf_cookie
def graph_table(request):
    """Graph table page"""
    hostnames = [h for h in request.GET.getlist('hostname') if h]
    if len(hostnames) == 0:
        return HttpResponseBadRequest('No hostname provided')

    # For convenience we will cache the servers in a dictionary.
    servers = {}
    for hostname in hostnames:
        try:
            servers[hostname] = query(hostname=hostname).get()
        except DatasetError:
            raise Http404

    # Find the collections which are related with all of the hostnames.
    # If there are two collections with same match, use only the one which
    # is not an overview.
    collections = []
    doubles = set()
    for collection in Collection.objects.order_by('overview', 'sort_order'):
        if (collection.attribute_id, collection.attribute_value) in doubles:
            continue
        for hostname in hostnames:
            if collection.attribute_id not in servers[hostname]:
                break   # The server hasn't got this attribute at all.
            value = servers[hostname][collection.attribute_id]
            if isinstance(value, MultiAttr):
                if collection.attribute_value not in [str(v) for v in value]:
                    break   # The server hasn't got this attribute value.
            else:
                if collection.attribute_value != str(value):
                    break   # The server attribute is not equal.
        else:
            doubles.add((collection.attribute_id, collection.attribute_value))
            collections.append(collection)

    # Prepare the graph descriptions
    descriptions = []
    for collection in collections:
        for template in collection.template_set.all():
            descriptions += (
                [(template.name, template.description)] * len(hostnames)
            )

    # Prepare the graph tables for all hosts
    graph_tables = []
    for hostname in hostnames:
        graph_table = []
        if request.GET.get('action') == 'Submit':
            custom_params = request.GET.urlencode()
            for collection in collections:
                column = collection.graph_column(
                    servers[hostname], custom_params
                )
                graph_table += [(k, [('Custom', v)]) for k, v in column]
        else:
            for collection in collections:
                graph_table += collection.graph_table(servers[hostname])
        graph_tables.append(graph_table)

    if len(hostname) > 1:
        # Add hostname to the titles
        for order, hostname in enumerate(hostnames):
            graph_tables[order] = [(k + ' on ' + hostname, v)
                                   for k, v in graph_tables[order]]

        # Combine them
        graph_table = []
        for combined_tables in zip(*graph_tables):
            graph_table += list(combined_tables)

    return TemplateResponse(request, 'graphite/graph_table.html', {
        'hostnames': hostnames,
        'descriptions': descriptions,
        'graph_table': graph_table,
        'is_ajax': request.is_ajax(),
        'base_template': 'empty.html' if request.is_ajax() else 'base.html',
        'link': request.get_full_path(),
        'from': request.GET.get('from', '-24h'),
        'until': request.GET.get('until', 'now'),
    })


@login_required
@ensure_csrf_cookie
def graph(request):
    """Graph page"""
    password_mgr = HTTPPasswordMgrWithDefaultRealm()
    password_mgr.add_password(
        None,
        settings.GRAPHITE_URL,
        settings.GRAPHITE_USER,
        settings.GRAPHITE_PASSWORD,
    )
    auth_handler = HTTPBasicAuthHandler(password_mgr)
    url = '{0}/render?{1}'.format(
        settings.GRAPHITE_URL, request.GET.urlencode()
    )
    with build_opener(auth_handler).open(url) as response:
        r = HttpResponse(response.read())
        r['Content-Type'] = 'image/png'
        return r
