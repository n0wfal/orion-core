/**
 * @class ST.Locator
 * @singleton
 *
 * Sencha Test provides multiple ways to locate an element from a text string. The best
 * and most reliable way to locate elements will be application-specific, so Sencha Test
 * generalizes the tools needed in what are called "locators".
 *
 * A locator solves the same probelm as a CSS selector but is a super-set of CSS selector
 * syntax. The locator syntax is more expressive than selectors to provide more options
 * for testing real-world applications.
 *
 * When testing applications, ideally the application developers provide a reliable way
 * for testers to locate application components and elements.
 *
 * Locators appear in the {@link ST.event.Playable#target target} property of records
 * passed to {@link ST#play}. Locators can be passed to {@link ST#find} to find an
 * {@link ST.Element element}. Locators are also passed to {@link ST#element} to create
 * {@link ST.future.Element future elements} and {@link ST#component} to create
 * {@link ST.future.Component future components}.
 *
 * ## Locating Elements
 *
 * ### At-Path
 * Locators that start with the "@" character are called "at-paths". The first token of
 * an at-path is an element ID. Following the first token is a slash-delimited sequence
 * of tag names and offsets, similar to XPath. For example:
 *
 *      @some-div/span[2]
 *
 * This identifies the 2nd "span" element that is an immediate child of the element with
 * the id "some-div". The equivalent XPath expression would be:
 *
 *      //[@id="some-div"]/span[2]
 *
 * The primary advantages of at-paths over XPath are compactness and speed. This is because
 * an at-path uses `getElementById` followed by a simple path based on tag names. Because
 * at-paths are inherently based on ID's, they will be most useful in applications that
 * assign meaningful ID's to their components.
 *
 * ### XPath
 * XPath is probably the most powerful supported locator syntax. Sencha Test uses the
 * [document.evaluate](http://www.w3.org/TR/DOM-Level-3-XPath/xpath.html#XPathEvaluator-evaluate)
 * method of the browser, but also a [polyfill](https://github.com/google/wicked-good-xpath)
 * when this method is not present.
 *
 * In addition to attribute matching, XPath can also navigate upwards, unlike CSS
 * selectors. For example:
 *
 *      //[id="some-div"]/..
 *
 * The above XPath selects the parent node of the node having ID of "some-div".
 *
 * **IMPORTANT** Sencha Test requires that all XPath locators start with a slash character.
 * Typically XPath locators will begin with "//" (as shown above) so that matches do not
 * start at the document root.
 *
 * Some useful resources on XPath:
 *
 *   * [DOM XPath Specification](http://www.w3.org/TR/DOM-Level-3-XPath/xpath.html)
 *   * [XPath and CSS Selectors](http://ejohn.org/blog/xpath-css-selectors/)
 *
 * ### DOM Query
 * The DOM Query, or CSS Selector, is perhaps the most familiar locator syntax supported
 * by Sencha Test. To differentiate DOM Query locators from the Component and Composite
 * Queries (discussed below), a DOM Query starts with ">>" or "=>".
 *
 * The above paths would be approximated by the following DOM Query:
 *
 *      >> #some-div > span:nth-child(2)
 *
 * This is only approximately the same because `nth-child()` does not require the first
 * child to also be a `span`.
 *
 * ## Locating Components
 * When testing applications built using Sencha frameworks (Ext JS and Sencha Touch), the
 * majority of logic operates at a layer above elements: Components. It is therefore more
 * desirable to locate and operate on components than raw DOM elements.
 *
 * ### Component Query
 * "[Component Query](http://docs.sencha.com/extjs/6.0/6.0.1-classic/#!/api/Ext.ComponentQuery)"
 * is a feature provided by Sencha frameworks that can locate components of the application.
 * Component Query syntax is essentially the same as DOM Query.
 *
 * Consider:
 *
 *      #some-component
 *
 * The above will locate a Component with an `id` or `itemId` property of "some-component".
 *
 * ### Composite Query
 * Finally, you can combine Component Query and DOM Query in a "Composite Query" by using
 * the "=>" to separate the two pieces.
 *
 * For example:
 *
 *      #some-component => div.foo
 *
 * This locates the child "div" with class "foo" inside the component with `id` (or `itemId`)
 * of "some-component".
 */
ST.Locator = (function (Locator) {
    return ST.apply(Locator, {
        tagPathRegEx: /(\w+)(?:\[(\d+)\])?/,
        atPathRe: /^@/,
        xpathRe: /^\//,

        root: window,

        /**
         * Given the `target` locator string, return the matching element or `null` if one
         * is not found. See {@link ST.Locator} for a description of valid locator
         * strings.
         *
         * See also the short-hand equivalent {@link ST#find}.
         *
         * @param {String/Function} target The target locator string or a function that
         * returns the DOM node.
         * @param {Boolean} [wrap] Pass `true` to return a wrapped {@link ST.Element}
         * instead of the raw DOM node.
         * @param {HTMLElement/ST.Element/Ext.Component} [root]
         * @param {"down"/"up"/"child"/"sibling?"} [direction="down"]
         * currently only used for composite queries
         */
        find: function (target, wrap, root, direction) {
            var el;

            if (typeof target === 'function') {
                el = target();
            }
            else if (Locator.atPathRe.test(target)) {
                el = Locator.atPath(target);
            }
            else if (Locator.xpathRe.test(target)) {
                el = Locator.xpath(target);
            }
            else {
                el = Locator.composite(target, root, direction);
            }

            if (el && wrap) {
                el = new ST.Element(el);
            }

            return el;
        },

        atPath: function (path) {
            var parts = path.split('/'),
                regex = Locator.tagPathRegEx,
                i, n, m, count, tag, child,
                el = Locator.root.document;

            el = (parts[0] == '@') ? el.body
                : el.getElementById(parts[0].substring(1)); // remove '@'

            for (i = 1, n = parts.length; el && i < n; ++i) {
                m = regex.exec(parts[i]);
                count = m[2] ? parseInt(m[2], 10) : 1;
                tag = m[1].toUpperCase();

                for (child = el.firstChild; child; child = child.nextSibling) {
                    if (child.tagName == tag) {
                        if (count == 1) {
                            break;
                        }
                        --count;
                    }
                }

                el = child;
            }

            return el;
        },

        composite: function (target, queryRoot, direction) {
            var me = this,
                context = me._parseRoot(queryRoot),
                compContext = context.comp,
                elContext = context.el,
                root = context.root,
                parsedTarget = me._parseSelector(target, context.type),
                domQuery = parsedTarget.domQuery,
                compQuery = parsedTarget.compQuery,
                isComposite = parsedTarget.isComposite,
                direction = direction || 'down',
                comp;

            // if this is a composite query of the "up" or "child" variety
            if (isComposite && compContext && direction !== 'down') {
                return me._doCompositeQuery(compQuery, domQuery, compContext, direction);
            } else {
                // if we failed to resolve the requested root, we can skip the rest
                if (context.failedRoot) {
                    return null;
                }
                // if a component query was detected, run first to determine root
                if (compQuery) {
                    root = compContext || null;

                    comp = me._doComponentQuery(compQuery, root, direction);  

                    root = comp && (comp.el || comp.element);
                    root = root && root.dom;
                } else if (!domQuery) {
                    root = null;
                }

                if (domQuery && root) {
                    return me._doDomQuery(domQuery, root, direction);
                }
            }

            return root;
        },

        xpath: function (target) {
            var doc = Locator.root.document,
                res = doc.evaluate(target, doc, null, 5, null), // ORDERED_NODE_ITERATOR_TYPE
                el = res ? res.iterateNext() : null;

            if (el && ST.options.failOnMultipleMatches && res.iterateNext()) {
                throw new Error('XPath locator matches multiple items: "' + target + '"');
            }

            return el;
        },

        /**
         * @private
         * Executes composite query for hierarchy requests
         * @param {String} compQuery The Component query
         * @param {String} domQuery The DOM query
         * @param {Ext.Component} root The root component
         * @param {String} direction The direction of the hierarchical query
         * @param {String} start The id of the original starting context
         * @return {HTMLElement}
         */
        _doCompositeQuery: function (compQuery, domQuery, root, direction, start) {
            var me = this,
                start = start || root,
                originalRoot, el, matches, match, comp,
                i, node, verified, rootEl, parent;

            if (direction === 'up') {
                // first, run component query side of composite
                comp = root.up(compQuery);

                if (comp) {
                    // we have a match, so run dom query portion
                    el = comp.el || comp.element;
                    match = ST.fly(el).down(domQuery, true);
                    verified = false;

                    if (match) {
                        // Here's where it gets interesting; we found a match, but it could be *anywhere* in the hierarchy
                        // of the matched component; so, we need to work our way from the bottom (original node) to the top (matched component)
                        // If we find the matched node along the way, this is a valid ancestor element
                        // If we don't find the matched node, we need to continue up() the component tree, as a higher level might have
                        // what we're after
                        originalRoot = start;
                        // the rootEl is where the query started
                        rootEl = originalRoot.el || originalRoot.element;

                        // ensure that the match isn't our starting location!
                        if (rootEl.dom !== match) {
                            node = rootEl.dom;
                        }                        

                        // verify that this match is *above* the original root in the dom hierarchy
                        while (node) {
                            if (node === match) {
                                // matching node has been located
                                node = null;
                                verified = true;
                            } else if (node !== el.dom) {
                                // node not found yet, keep interating up the hierarchy
                                node = node.parentNode;
                            } else {
                                // we're reached the top-most node where a match is allowed without finding anything; abort
                                node = null;
                            }
                        }
                    }
                    // if we couldn't verify the match, we need to continue the search upward, recursively
                    if (!verified) {
                        match = me._doCompositeQuery(compQuery, domQuery, comp, direction, start);
                    }
                }

            } else if (direction === 'child' && root.query) {
                // for first, last, and child, we can query for matches on the component level
                rootEl = root.el || root.element;
                matches = root.query(compQuery);                
  
                // now we'll loop over the matches, and run the appropriate dom query method on the component's root element
                for (i=0; i<matches.length; i++) {
                    comp = matches[i];
                    el = comp.el || comp.element;
                    match = ST.get(el).down(domQuery, true);
                    // if we have a match, verify that the element is actually a child of the original root
                    if (match && (match.parentNode === rootEl.parentNode) && (rootEl !== match)) {
                        break;
                    } else {
                        match = null;
                    }
                }
            }

            return match || null;
        },

        _doDomQuery: function (selector, root, direction) {
            var target, parent, matches, i;

            root = ST.get(root);
            // run the appropriate method against the passed context element           
            return root[direction](selector, true);
        },

        _doComponentQuery: function (selector, root, direction) {
            var comp;

            // if we have a root, it's a contextual query so we can use direction
            if (root) {
                switch (direction) {
                    case 'up':
                        comp = root.up(selector);
                        break;
                    case 'down':
                        comp = root.down && root.down(selector);
                        break;
                    case 'child':
                        comp = root.child && root.child(selector);
                        break;
                }
            }
            // otherwise, fall back to component query
            else {
                comp = Ext.ComponentQuery.query(selector);

                if (comp && comp.length) {
                    if (comp.length > 1 && ST.options.failOnMultipleMatches) {
                        throw new Error('Component Query locator matches multiple items: "'
                                + selector + '"');
                    }

                    comp = comp[0];
                } else {
                    comp = null;
                }
            }

            return comp || null;
        },

        _parseRoot: function (root) {
            var defaultRoot = Locator.root.document,
                type = typeof root,
                result = {
                    comp: null,
                    el: null,
                    type: 'element',
                    failedRoot: false,
                    root: defaultRoot
                };

            if (!root || root===defaultRoot) {
                result.type = null;
            } else {
                if (root && type === 'object') {
                    // is an Ext JS / Sencha Touch component?
                    if (root.isComponent) {
                        result.comp = root;
                        result.el = root.el || root.element;
                    } 
                    // this is either an Ext JS element or an ST.Element
                    else if (root.dom) {
                        result.el = root;
                    }
                    // this could be an html element
                    else if (root.nodeType && root.nodeType === 1) {
                        result.el = ST.get(root);
                    }
                    // this may be a future
                    else if (root.$ST) {
                        result.comp = root.cmp || null;
                        result.el = root.el || null;
                    }
                } 
                // if it's a string, we'll try to produce an ST.Element from it
                else if (type === 'string') {
                    result.el = ST.get(root);
                }

                // determine the correct type
                if (result.comp) {
                    result.type = 'component';
                } else {
                    result.type = result.el ? 'element' : null;
                }
                // if element was located, use it for the root
                if (result.el) {
                    result.root = result.el.dom || result.el;
                } else {
                    result.root = null;
                    result.failedRoot = true;
                }
            }

            return result;
        },

        _parseSelector: function (selector, contextType) {
            var Ext = ST.Ext,
                hasCQ = Ext && Ext.ComponentQuery,
                selector = selector || (contextType ? '*' : ''),
                compPos = selector.indexOf('=>'), 
                domPos = selector.indexOf('>>'),
                parts, result;

            result = {
                domQuery: null,
                compQuery: null,
                isComposite: false,
                selector: selector
            }

            // context is a component
            if (hasCQ) {
                if (contextType !== 'element') {
                    // no fat arrow (>> .my-class)
                    if (domPos === 0) {
                        result.domQuery = ST.String.trim(selector.replace('>>', ''));
                    } 
                    // fat arrow at beginning (=> .my-class)
                    else if (compPos === 0) {
                        result.domQuery = ST.String.trim(selector.replace('=>', ''));
                    } 
                    // fat arrow between selectors (container => .my-class)
                    else if (compPos > 0) {
                        parts = selector.split('=>');
                        result.domQuery = ST.String.trim(parts[1]);
                        result.compQuery = ST.String.trim(parts[0]);
                        result.isComposite = true;
                    } 
                    // pure component query (container)
                    else {
                        result.compQuery = ST.String.trim(selector)
                    }
                } else if (domPos === -1 || domPos === 0) {
                    if (compPos !== -1) {
                        throw new Error('The specified composite query ("' + selector + '") cannot be used in the current context');
                    }

                    result.domQuery = ST.String.trim(selector.replace('>>', ''));
                }             
            }
            // if component query isn't an option, everything has to funnel through dom query
            else {
                result.domQuery = ST.String.trim(selector.replace('>>', ''));
            }            

            return result;
        }
    });
})({});

wgxpath.install();  // polyfill win.document.evaluate for old browsers

/**
 * Given the `target` locator string, return the matching element or `null` if one is not
 * found. See {@link ST.Locator} for a description of valid locator strings.
 *
 * Alias for {@link ST.Locator#find}.
 *
 * @param {String} target The target locator string.
 * @param {Boolean} [wrap=false] Pass `true` to return a wrapped {@link ST.Element}
 * instead of the raw DOM node.
 * @param {HTMLElement/ST.Element/Ext.Component} [root]
 * @param {"down"/"up"/"child"} [direction="down"]
 * @method find
 * @member ST
 */
ST.find = ST.Locator.find;
