/**
 * @class ST.locator.Strategy
 * This class is the default locator strategy. This can also be used as a base class for
 * other locator strategies. To register custom locator strategies, see
 * {@link ST#addLocatorStrategy} or {@link ST#setLocatorStrategies}.
 */
ST.locator.Strategy = ST.define({
    ignoreElIdRe: /^ext-(?:gen|element)(?:\d+)$/,
    validIdRe: /^[a-z_][a-z0-9\-_]*$/i,
    includeFullLocator: ST.apply(ST.apply({},
        ST.event.Event.keyEvents),
        ST.event.Event.focusEvents),

    constructor: function (config) {
        var me = this;

        ST.apply(me, config);

        me.locate = me._initter;  // hook the first call to locate()
    },

    /**
     * Initializes this instance. This method is called immediately prior to the first
     * call to `locate`. This is done in a deferred manner to ensure that any necessary
     * code has been loaded (such as Ext JS).
     *
     * @since 1.0.1
     * @protected
     */
    init: function () {
        var me = this,
            x = ST.Ext,
            cssIgnore = me.cssIgnore,
            cssIgnorePat;

        // Copy off the prototype
        me.cssIgnore = cssIgnore = ST.apply({}, cssIgnore);

        x = x && x.baseCSSPrefix;
        cssIgnorePat = me.getCssIgnorePatterns(x);

        if (cssIgnorePat.length) {
            me.cssIgnoreRe = new RegExp(cssIgnorePat.join('|'));
        }

        if (x) {
            ST.apply(cssIgnore, ST.Array.toMap([
                x + 'body',

                x + 'box-item',
                x + 'box-target',

                x + 'btn-inner',
                x + 'btn-wrap',

                x + 'component',
                x + 'fa',
                x + 'fit-item',
                x + 'form-field',
                x + 'grid-cell-inner',
                x + 'noicon'
            ]));
        }
    },

    _initter: function () {
        var me = this;

        delete me.locate;

        me.init();

        return me.locate.apply(me, arguments);
    },

    /**
     * This method should append target locators to the `targets` array based on the
     * provided `el`. Each identified target should be appended to the `targets` array
     * (e.g., using `push()`).
     *
     * Because a locator can describe the passed `el` or a parent node, results added to
     * the `targets` array should be an array consisting of the element and its locator.
     * For example:
     *
     *      if (el.id) {
     *          targets.push([ el, '@' + el.id ]);
     *      }
     *
     * @param {HTMLElement} el The element for which to generate target locator(s).
     * @param {Array[]} targets The array to which to append targets and their locator(s)
     * as an array of `[ el, locator ]`.
     * @return {Boolean} Returns `true` if any `targets` were generated.
     * @method locate
     */
    locate: function (el, targets, ev) {
        var me = this,
            ExtJS = ST.Ext,
            good = false,
            c, cmp, fly;

        if (ExtJS && ExtJS.ComponentQuery) {
            fly = ST.fly(el);
            cmp = fly && fly.getComponent();

            for (c = cmp; c; c = c.getRefOwner()) {
                if (!me.ignoreCmp(c)) {
                    if (me.getCQ(c, el, targets, ev)) {
                        good = true;
                    }
                    break;
                }
            }
        }

        if (me.getAtPath(el, targets)) {
            good = true;
        }

        return !!good;
    },

    getAtPath: function (el, targets) {
        var me = this,
            good = false,
            path = [],
            stopper = (el.ownerDocument || el).body,
            count, sibling, t, tag;

        for (t = el; t; t = t.parentNode) {
            if (t == stopper) {
                path.unshift('@');
                good = true;
                break;
            }
            if (t.id && t.id.indexOf('/') < 0 && !me.ignoreElIdRe.test(t.id)) {
                path.unshift('@' + t.id);
                good = true;
                break;
            }

            for (count = 1, sibling = t; sibling = sibling.previousSibling; ) {
                if (sibling.tagName == t.tagName) {
                    ++count;
                }
            }

            tag = t.tagName && t.tagName.toLowerCase();
            if (tag) {
                if (count < 2) {
                    path.unshift(tag);
                } else {
                    path.unshift(tag + '[' + count + ']');
                }
            }
            else if (t.window == t) { // must use == for IE8 (from Ext.dom.Element)
                break;
            }
        }

        if (targets && good) {
            targets.push([t, path[0]]);

            if (path.length > 1) {
                targets.push([el, path.join('/')]);
            }
        }

        return good;
    },

    /**
     * Generates a set of ComponentQuery candidates for the given Component. The generated
     * CQ selectors are "shallow" in that they do not describe the containment hierarchy
     * of the component.
     *
     * @param {Ext.Component} cmp
     * @param {HTMLElement} el The actual element to target. If this parameter is not
     * `null` this method may include an additional DOM query on the generated selectors
     * separated by "=>" (a "Composite Query").
     * @param {Array[]} targets The array to which to append targets and their locator(s)
     * as an array of `[ el, locator ]`.
     * @return {Boolean} Returns `true` if any `targets` were generated.
     * @since 1.0.1
     */
    getCQ: function (cmp, el, targets, ev) {
        var me = this,
            configList = me.configList,
            len = configList.length,
            good = false,
            n = targets && targets.length,
            i, item, k, sel, xtype;

        for (i = 0; i < len; ++i) {
            if (me.getCQForProperty(cmp, configList[i], targets)) {
                good = true;
            }
        }

        if (!good) {
            xtype = me.getXType(cmp);

            if (xtype) {
                if (targets) {
                    targets.push([ cmp.el, xtype ]);
                }

                good = true;
            }
        }

        if (targets && el && n < (k = targets.length)) {
            sel = me.getItemSelector(cmp, el, ev);

            if (sel) {
                item = sel[0];
                sel = ' => ' + sel[1];

                for (; n < k; ++n) {
                    targets[n][0] = item;
                    targets[n][1] += sel;
                }
            }
        }

        return good;
    },

    /**
     * Generates a ComponentQuery selector for the given Component using the specified
     * config property. The selector is "shallow" in that they do not describe the
     * containment hierarchy of the component.
     *
     * The supported properties are listed in the `configList` array.
     *
     * @param {Ext.Component} cmp
     * @param {String} prop The property to use in the generated selector.
     * @param {Array[]} targets The array to which to append targets and their locator(s)
     * as an array of `[ el, locator ]`.
     * @return {Boolean} Returns `true` if any `targets` were generated.
     * @since 1.0.1
     */
    getCQForProperty: function (cmp, prop, targets) {
        var extractor = this.extractors[prop],
            good = false;

        if (extractor) {
            good = extractor.call(this, cmp, targets);
        }

        return good;
    },

    getItemSelector: function (cmp, el, ev) {
        var view = ST.fly(el).getComponent(),
            item = view.findItemByChild && view.findItemByChild(el),
            cell, col, colId, recId, ret;

        if (item) {
            recId = item.getAttribute('data-recordindex');
            if (recId) {
                ret = [ item, '[data-recordindex=' + JSON.stringify(recId) + ']' ];

                for (cell = el; cell && cell !== item; cell = cell.parentNode) {
                    colId = cell.getAttribute('data-columnid');
                    col = colId && ST.Ext.getCmp(colId);

                    if (col) {
                        if (!col.autoGenId) {
                            ret[0] = cell;
                            ret[1] += ' [data-columnid=' + JSON.stringify(colId) + ']';
                        }
                        break;
                    }
                }
            }
        } else if (ev && this.includeFullLocator[ev.type]) {
            var matches = cmp.el.dom.querySelectorAll(el.tagName);
            if (matches && matches.length === 1) {
                ret = [ el, el.tagName.toLowerCase() ];
            }
        }

        return ret;
    },

    extractors: {
        iconCls: function (cmp, targets) {
            var iconCls = this.splitCls(cmp.iconCls);

            if (iconCls && iconCls.length === 1) {
                if (targets) {
                    targets.push([
                        cmp.el.dom,
                        this.getXType(cmp) + '[iconCls="' + iconCls[0] + '"]'
                    ]);
                }

                return 1;
            }

            return 0;
        },

        id: function (cmp, targets) {
            var me = this,
                id = me.getCmpId(cmp),
                parent;

            if (cmp.autoGenId || !me.validIdRe.test(id)) {
                return 0;
            }

            // We can still have an autoGenId on a parent that is then used to produce
            // this id (panel-1010_header). So start with the parent and see if its id
            // is a prefix of cmp's id and if it is an autoGenId.
            for (parent = cmp; parent = parent.getRefOwner(); ) {
                if (!ST.String.startsWith(id, me.getCmpId(parent))) {
                    break;
                }

                if (parent.autoGenId) {
                    return 0;
                }
            }

            if (targets) {
                targets.push([
                    cmp.el.dom,
                    '#' + id
                ]);
            }

            return 1;
        }
    },

    /**
     * @property {Object} classIgnore
     * Property names are the Ext JS classes to ignore.
     */
    classIgnore: {
        //
    },

    /**
     * @property {Object} cmpIgnore
     * Property names are the component xtypes to ignore. Values are either the xtype
     * of the parent if the component should only be ignored when inside this type of
     * parent, or `true` to always ignore.
     */
    cmpIgnore: {
        gridview: 'grid',
        tableview: 'grid',
        treeview: 'tree'
    },

    /**
     * @property {String[]} configList
     * The list of config properties used to identify components in order of priority.
     * @since 1.0.1
     */
    configList: [
        'id',
        'stateId',
        'reference',
        'itemId',
        'name',
        'iconCls',
        'text',
        'fieldLabel'
    ],

    /**
     * @property {Object} cssIgnore
     * Property names are the CSS class names to ignore.
     */
    cssIgnore: {
        fa: 1,  // FontAwesome

        // Some old framework bugs rendered null/undefined into class attribute
        'null': 1,
        'undefined': 1
    },

    /**
     * Returns the id of the given Component.
     * @param {Ext.Component} cmp
     * @return {String}
     */
    getCmpId: function (cmp) {
        return cmp.getId ? cmp.getId() : cmp.id;
    },

    /**
     * Returns an array of `RegExp` patterns that describe CSS classes to be ignored.
     * @param {String} baseCSSPrefix The CSS prefix for Ext JS (typically "x-").
     * @return {String[]}
     * @since 1.0.1
     * @protected
     */
    getCssIgnorePatterns: function (baseCSSPrefix) {
        var x = baseCSSPrefix;

        if (!x) {
            return [];
        }

        x = '^' + x;

        return [
            x + 'noborder'
        ];
    },

    /**
     * Returns the `xtype` of the given Component. If the component has multiple xtypes,
     * the primary is returned.
     *
     * @param {Ext.Component} cmp
     * @return {String}
     * @since 1.0.1
     */
    getXType: function (cmp) {
        var xtype = cmp.getXType && cmp.getXType();

        if (!xtype) {
            xtype = cmp.xtype || (cmp.xtypes && cmp.xtypes[0]);
        }

        return xtype;
    },

    /**
     * Returns `true` if the given CSS class should be ignored.
     * @param {String} cls
     * @return {Boolean}
     * @protected
     */
    ignoreCls: function (cls) {
        var cssIgnoreRe = this.cssIgnoreRe;

        return this.cssIgnore[cls] || (cssIgnoreRe && cssIgnoreRe.test(cls));
    },

    ignoreCmp: function (cmp) {
        var me = this,
            xtype = me.getXType(cmp),
            ignore = me.cmpIgnore[xtype],
            parent, parentXType;

        if (ignore) {
            if (typeof ignore !== 'string') {
                return true;
            }

            parent = cmp.getRefOwner();
            if (parent) {
                if (typeof parent.isXType === 'function') {
                    if (parent.isXType(ignore)) {
                        return true;
                    }
                } else {
                    parentXType = me.getXType(parent);

                    if (parentXType === ignore) {
                        return true;
                    }
                }
            }
        }

        if (me.classIgnore[cmp.$className]) {
            return true;
        }

        return false;
    },

    /**
     * Returns the array of CSS classes given the `className` (space-separated classes).
     * The ignored classes have been removed from the array.
     *
     * @param {String} cls
     * @return {String[]}
     * @since 1.0.1
     * @protected
     */
    splitCls: function (cls) {
        var array = ST.String.split(ST.String.trim(cls)),
            len = array.length,
            c, i, ret;

        for (i = 0; i < len; ++i) {
            c = array[i];

            if (c && !this.ignoreCls(c)) {
                (ret || (ret = [])).push(c);
            }
        }

        return ret;
    }
}, function (Strategy) {
    function make (prop, includeXType, skipGetter) {
        var attr = '[' + prop + '=',
            getter = 'get' + prop.charAt(0).toUpperCase() + prop.substring(1);

        Strategy.prototype.extractors[prop] = function (cmp, targets) {
            var value;

            if (skipGetter || prop in cmp) {
                value = cmp[prop];
            }
            else if (cmp[getter]) {
                value = cmp[getter]();
            }

            if (value || value === 0) {
                if (targets) {
                    // some configs (like text) could have quotes
                    targets.push([
                        cmp.el.dom,
                        (includeXType ? this.getXType(cmp) : '') +
                            attr + JSON.stringify(value) + ']'
                    ]);
                }

                return true;
            }
        };
    }

    make('reference', true);
    make('itemId', true, true);
    make('name', true, true);
    make('stateId');
    make('text', true);
    make('fieldLabel', true);
});
