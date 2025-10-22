"""Serveradmin - adminapi - Command Line Interface

Copyright (c) 2019 InnoGames GmbH
"""
import json
import sys
from argparse import ArgumentParser, ArgumentTypeError

from adminapi.dataset import MultiAttr, Query
from adminapi.parse import parse_query


def parse_args(args):
    multi_note = ' (can be specified multiple times)'
    parser = ArgumentParser('adminapi')
    parser.add_argument('query', nargs='+')
    parser.add_argument(
        '-1',
        '--one',
        action='store_true',
        help='Make sure exactly one server matches with the query',
    )
    parser.add_argument(
        '-a',
        '--attr',
        action='append',
        help='Attributes to fetch (default: "hostname")' + multi_note,
    )
    parser.add_argument(
        '-o',
        '--order',
        action='append',
        help='Attributes to order by the result' + multi_note,
    )
    parser.add_argument(
        '-r',
        '--reset',
        action='append',
        help='Attributes to reset' + multi_note,
    )
    parser.add_argument(
        '-u',
        '--update',
        type=attr_value,
        action='append',
        help='Attributes with values to update' + multi_note,
    )
    parser.add_argument(
        '-j',
        '--json',
        action='store_true',
        help='Output results in JSON format',
    )

    return parser.parse_args(args)


def main():
    args = parse_args(sys.argv[1:])

    attribute_ids_to_print = args.attr if args.attr else ['hostname']
    attribute_ids_to_fetch = list(attribute_ids_to_print)
    if args.reset:
        attribute_ids_to_fetch.extend(args.reset)
    if args.update:
        attribute_ids_to_fetch.extend(u[0] for u in args.update)

    # TODO: Avoid .join()
    filters = parse_query(' '.join(args.query))
    query = Query(filters, attribute_ids_to_fetch, args.order)

    if args.one and len(query) > 1:
        raise Exception(
            'Expecting exactly one server, found {} servers'
            .format(len(query))
        )

    if args.json:
        results = []
        for server in query:
            if args.reset:
                apply_resets(server, args.reset)
            if args.update:
                apply_updates(server, args.update)
            results.append(format_server_json(server, attribute_ids_to_print))
        if args.reset or args.update:
            query.commit()
        print(json.dumps(results, indent=2))
    else:
        for server in query:
            if args.reset:
                apply_resets(server, args.reset)
            if args.update:
                apply_updates(server, args.update)
            print_server(server, attribute_ids_to_print)
        if args.reset or args.update:
            query.commit()


def attr_value(arg):
    arg_split = tuple(arg.split('='))
    if len(arg_split) != 2:
        raise ArgumentTypeError('You need to pass an attribute=value')
    return arg_split


def apply_resets(server, attribute_ids):
    for attribute_id in attribute_ids:
        if isinstance(server[attribute_id], MultiAttr):
            server[attribute_id].clear()
        elif isinstance(server[attribute_id], bool):
            raise Exception('Attribute of type boolean cannot be reset')
        else:
            server.set(attribute_id, None)


def apply_updates(server, attribute_values):
    for attribute_id, value in attribute_values:
        server.set(attribute_id, value)


def format_server_json(server, attribute_ids):
    """Format server data as a dictionary for JSON output."""
    output = {}
    for attribute_id in attribute_ids:
        if attribute_id not in server:
            output[attribute_id] = None
        else:
            value = server[attribute_id]
            # Handle MultiAttr by converting to list
            if isinstance(value, MultiAttr):
                output[attribute_id] = list(value)
            else:
                output[attribute_id] = value
    return output


def print_server(server, attribute_ids):
    values = []
    for attribute_id in attribute_ids:
        if attribute_id not in server:
            values.append('{N/A}')
            continue

        value = server[attribute_id]
        if any(value is v for v in (None, True, False)):
            value = '{{{}}}'.format(str(value).lower())

        values.append(value)

    print(*values, sep='\t')
