$(document).ready(function() {
    /**
     * Calculate Levenshtein distance between two strings
     *
     * @param a
     * @param b
     * @returns {number}
     */
    let levenshtein = function(a, b) {
        let matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

        for (let i = 0; i <= a.length; i += 1) {
            matrix[i][0] = i;
        }
        for (let j = 0; j <= b.length; j += 1) {
            matrix[0][j] = j;
        }

        for (let j = 1; j <= b.length; j += 1) {
            for (let i = 1; i <= a.length; i += 1) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1, // deletion
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j - 1] + indicator, // substitution
                );
            }
        }
        return matrix[a.length][b.length];
    };

    /**
     * Get filtered list of attribute ids
     *
     * Takes a search value and some more configuration and returns filtered
     * list of attribute ids for the auto completion.
     *
     * @param search_for search string such as e.g. puppe
     * @param exclude list of attributes already used
     * @param exclude_multi exclude multi attributes
     * @param exclude_single exclude single attributes
     * @param exclude_reverse exclude reverse attributes
     * @returns alphabetically sorted list of attribute ids, with exact matches first
     */
    let get_attribute_ids = function(
        search_for, exclude, exclude_multi = false,
        exclude_single = false, exclude_reverse = false
    ) {
        let attrs = servershell.attributes;

        // TODO: Iterate only once over attributes and evaluate all filter

        if (search_for) {
            if (search_for.length <= 1) {
                attrs = attrs.filter(a => a.attribute_id.startsWith(search_for));
            } else {
                const search_len = search_for.length;
                attrs = attrs.filter(a => {
                    if (a.attribute_id.startsWith(search_for)) {
                        return true;
                    }

                    // Check for fuzzy match on prefixes of length len-1, len, len+1
                    const len_attr = a.attribute_id.length;
                    for (let len of [search_len - 1, search_len, search_len + 1]) {
                        if (len <= 0 || len > len_attr) continue;
                        let prefix = a.attribute_id.substring(0, len);
                        if (levenshtein(prefix, search_for) === 1) {
                            return true;
                        }
                    }
                    return false;
                });
            }
        }

        if (exclude_reverse) {
            attrs = attrs.filter(a => a.type !== 'reverse');
        }

        if (exclude) {
            attrs = attrs.filter(a => !exclude.includes(a.attribute_id));
        }

        if (exclude_multi) {
            attrs = attrs.filter(a => a.multi === false);
        }

        if (exclude_single) {
            attrs = attrs.filter(a => a.multi === true);
        }

        let result_ids = attrs.map(a => a.attribute_id);

        if (search_for) {
            result_ids.sort((a, b) => {
                const a_is_exact = a.startsWith(search_for);
                const b_is_exact = b.startsWith(search_for);

                if (a_is_exact && !b_is_exact) return -1;
                if (!a_is_exact && b_is_exact) return 1;

                return a.localeCompare(b);
            });
            return result_ids;
        }

        return result_ids.sort();
    };

    let command_input = $('#command');

    command_input.autocomplete({
        minLength: 1,
        source: function(request, response) {
            let choices = [];
            let arguments = request.term.split(' ');

            // Auto complete for all available commands
            if (arguments.length <= 1) {
                let command = arguments.length === 1 ? arguments.pop() : '';
                const do_fuzzy = command.length > 1;

                let exact_commands = [],
                    fuzzy_commands = [];
                let exact_attributes = [],
                    fuzzy_attributes = [];

                // Find matching commands
                Object.keys(servershell.commands).forEach(function(name) {
                    if (name.startsWith(command)) {
                        exact_commands.push(name);
                    } else if (do_fuzzy) {
                        const search_len = command.length;
                        const len_name = name.length;
                        for (let len of [search_len - 1, search_len, search_len + 1]) {
                            if (len <= 0 || len > len_name) continue;
                            let prefix = name.substring(0, len);
                            if (levenshtein(prefix, command) === 1) {
                                fuzzy_commands.push(name);
                                break;
                            }
                        }
                    }
                });

                // Find matching attributes
                servershell.attributes.map(item => item.attribute_id).forEach(function(attribute) {
                    if (attribute.startsWith(command)) {
                        exact_attributes.push(attribute);
                    } else if (do_fuzzy) {
                        const search_len = command.length;
                        const len_attr = attribute.length;
                        for (let len of [search_len - 1, search_len, search_len + 1]) {
                            if (len <= 0 || len > len_attr) continue;
                            let prefix = attribute.substring(0, len);
                            if (levenshtein(prefix, command) === 1) {
                                fuzzy_attributes.push(attribute);
                                break;
                            }
                        }
                    }
                });

                // Build choices, exact matches first, then fuzzy.
                exact_commands.sort().forEach(function(name) {
                    let desc = $(`#cmd-${name} td:nth-of-type(3)`).text();
                    desc = desc === undefined ? '' : desc;
                    choices.push({
                        'label': `${name}: ${desc}`,
                        'value': `${name} `
                    });
                });
                exact_attributes.sort().forEach(function(attribute) {
                    choices.push({
                        'label': `${attribute}: Display attribute`,
                        'value': `${attribute} `
                    });
                });
                fuzzy_commands.sort().forEach(function(name) {
                    let desc = $(`#cmd-${name} td:nth-of-type(3)`).text();
                    desc = desc === undefined ? '' : desc;
                    choices.push({
                        'label': `${name}: ${desc}`,
                        'value': `${name} `
                    });
                });
                fuzzy_attributes.sort().forEach(function(attribute) {
                    choices.push({
                        'label': `${attribute}: Display attribute`,
                        'value': `${attribute} `
                    });
                });
            } else {
                // Auto complete for certain commands and its values
                let command = arguments.shift().trim();
                let values = arguments.join();

                if (command === 'goto') {
                    let pages = [...Array(servershell.pages()).keys()];
                    pages.forEach(function(p) {
                        let page = p + 1;
                        if (page !== servershell.page()) {
                            choices.push({
                                'label': page,
                                'value': `${command} ${page}`,
                            });
                        }
                    })
                }
                if (command === 'perpage') {
                    let page_size = values.trim();
                    if (page_size === '' || isNaN(page_size))
                        page_size = null;

                    let pages = [5, 10, 15, 20, 25, 50, 100];
                    pages.forEach(function(per_page) {
                        per_page = per_page.toString();
                        if (page_size === null || per_page.startsWith(page_size)) {
                            choices.push({
                                'label': per_page,
                                'value': `${command} ${per_page}`,
                            });
                        }
                    });
                }
                if (command === 'attr' || command === 'export' || command === 'diff' || command === 'sum') {
                    values = values.split(',').map(v => v.trim());
                    let search_string = values.pop();
                    let attribute_ids = get_attribute_ids(search_string, values);

                    attribute_ids.slice(0, 25).forEach(function(attribute_id) {
                        let values_string = values.length > 0 ? values.join(',') + ',' : '';
                        choices.push({
                            'label': `Attr: ${attribute_id}`,
                            'value': `${command} ${values_string}${attribute_id}`,
                        })
                    });
                }
                if (
                    command === 'bookmark' ||
                    command === 'loadbookmark' ||
                    command === 'delbookmark'
                ) {
                    Object.keys(localStorage).forEach(function(key) {
                        if (!key.startsWith('bookmark.')) {
                            return;
                        }

                        const name = key.substr(9);
                        choices.push({
                            'label': `Bookmark: ${name}`,
                            'value': `${command} ${name}`,
                        });
                    });
                }
                if (
                    command === 'orderby' ||
                    command === 'delattr' ||
                    command === 'history'
                ) {
                    let attribute_ids = get_attribute_ids(
                        values, [], false, false, command === 'delattr'
                    );
                    attribute_ids.slice(0, 25).forEach(function(attribute_id) {
                        choices.push({
                            'label': `Attr: ${attribute_id}`,
                            'value': `${command} ${attribute_id}`,
                        });
                    });
                }
                if (
                    command === 'setattr' ||
                    command === 'multiadd' ||
                    command === 'multidel'
                ) {
                    let search_string = values.split(' ').shift();
                    if (!search_string.includes('=')) {
                        let attribute_ids = get_attribute_ids(
                            search_string, [],
                            command === 'setattr',
                            command === 'multiadd' || command === 'multidel',
                            true,
                        );
                        attribute_ids.slice(0, 25).forEach(function(attribute_id) {
                            choices.push({
                                'label': `Attr: ${attribute_id}`,
                                'value': `${command} ${attribute_id}=`,
                            });
                        });
                    }
                }
                if (command === 'new') {
                    let search_string = values.split(' ').shift();
                    let exact_matches = [],
                        fuzzy_matches = [];
                    const do_fuzzy = search_string && search_string.length > 1;

                    servershell.servertypes.forEach(function(servertype) {
                        if (search_string && servertype.startsWith(search_string)) {
                            exact_matches.push(servertype);
                        } else if (do_fuzzy) {
                            const search_len = search_string.length;
                            const len_servertype = servertype.length;
                            for (let len of [search_len - 1, search_len, search_len + 1]) {
                                if (len <= 0 || len > len_servertype) continue;
                                let prefix = servertype.substring(0, len);
                                if (levenshtein(prefix, search_string) === 1) {
                                    fuzzy_matches.push(servertype);
                                    break;
                                }
                            }
                        }
                    });

                    exact_matches.sort().concat(fuzzy_matches.sort()).forEach(function(servertype) {
                        choices.push({
                            'label': `Servertype: ${servertype}`,
                            'value': `${command} ${servertype}`,
                        });
                    });
                }
            }

            // Don't auto complete if the user has already entered everything
            if (choices.length === 1 && choices[0]['value'] === request.term) {
                response([]);
                return;
            }

            response(choices);
        }
    });

    command_input.autocomplete($('#autocomplete')[0].checked ? 'enable' : 'disable');
    command_input.autocomplete('option', 'autoFocus', $('#autoselect')[0].checked);
    command_input.autocomplete('option', 'delay', $('#autocomplete_delay_commands')[0].value);
});
