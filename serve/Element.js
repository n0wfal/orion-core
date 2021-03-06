/**
 * @class ST.Element
 * This class wraps a DOM element and provides helpful methods that simplify and normalize
 * browser differences.
 */
ST.Element = ST.define(function (Element) {
    var doc = document,
        docEl = doc.documentElement,
        body = doc.body,
        propertyCache = {},
        spaceRe = /[ ]+/g,
        camelRe = /(-[a-z])/gi,
        camelReplaceFn = function(m, a) {
            return a.charAt(1).toUpperCase();
        },
        inputTags = {
            INPUT: 1,
            TEXTAREA: 1
        },
        // Input types that cannot be typed into
        nonEditableInputTypes = {
            button: 1,
            checkbox: 1,
            hidden: 1,
            image: 1,
            radio: 1,
            reset: 1,
            submit: 1
        };

    /**
     * Normalizes CSS property keys from dash delimited to camel case JavaScript Syntax.
     * For example:
     *
     * - border-width -> borderWidth
     * - padding-top -> paddingTop
     *
     * @method normalize
     * @static
     * @private
     * @param {String} prop The property to normalize
     * @return {String} The normalized string
     */
    function normalize(prop) {
        return propertyCache[prop] || (propertyCache[prop] = prop.replace(camelRe, camelReplaceFn));
    }

    return {
        isElement: true,

        constructor: function(element) {
            this.dom = element;
        },

        contains: function (el) {
            var dom = this.dom,
                child = el.dom || el;

            if (dom.contains) {
                return dom.contains(child);
            }

            for (; child; child = child.parentNode) {
                if (child === dom) {
                    return true;
                }
            }

            return false;
        },

        /**
         * Try to focus the element.
         *
         * @return {ST.Element} this
         */
        focus: function() {
            var dom = this.dom;

            if (dom) {
                dom.focus();
            }

            return this;
        },

        getBox: function () {
            var round = Math.round,
                dom = this.dom,
                box, scroll, x, y, w, h;

            if (dom !== doc && dom !== body) {
                // IE (including IE10) throws an error when getBoundingClientRect
                // is called on an element not attached to dom
                try {
                    box = dom.getBoundingClientRect();
                } catch (ex) {
                    box = { left: 0, top: 0, width: 0, height: 0 };
                }

                x = round(box.left);
                y = round(box.top);
                w = box.width;
                h = box.height;

                scroll = new ST.Element(doc).getScroll();

                x += scroll.x;
                y += scroll.y;
            } else {
                x = y = w = h = 0;
            }

            return { x: x, y: y, w: w, h: h };
        },

        /**
         * Gets the cursor position in a text field
         * @param {Boolean} packed Return a single location or a range
         * @return {Number/Number[]}
         * @private
         */
        getCaret: function (packed) {
            var el = this.dom,
                doc = el.ownerDocument,
                range, range2, start, end;

            if (typeof el.selectionStart === "number") {
                start = el.selectionStart;
                end = el.selectionEnd;
            } else if (doc.selection) {
                range = doc.selection.createRange();
                range2 = el.createTextRange();
                range2.setEndPoint('EndToStart', range);

                start = range2.text.length;
                end = start + range.text.length;
            } else {
                return null;
            }

            if (packed && start === end) {
                return start;
            }
            return [ start, end ];
        },

        /**
         * Sets the cursor position in a text field
         * @param {Number/Number[]} caret The position to place the cursor in the string
         * @private
         */
        setCaret: function (caret) {
            var el = this.dom,
                startOffset, endOffset;

            if (typeof caret === 'number') {
                startOffset = caret;
            } else {
                startOffset = caret[0];
                endOffset = caret[1];
            }

            if (startOffset < 0) {
                startOffset += el.value.length;
            }
            if (endOffset == null) {
                endOffset = startOffset;
            }
            if (endOffset < 0) {
                endOffset += el.value.length;
            }

            if (typeof el.selectionStart === "number") {
                el.selectionStart = startOffset;
                el.selectionEnd = endOffset;
            } else {
                var range = el.createTextRange();
                var startCharMove = this.offsetToRangeCharacterMove(startOffset);

                range.collapse(true);

                if (startOffset == endOffset) {
                    range.move("character", startCharMove);
                } else {
                    range.moveEnd("character", this.offsetToRangeCharacterMove(endOffset));
                    range.moveStart("character", startCharMove);
                }

                range.select();
            }
        },

        // Moving across a line break only counts as moving one character in a TextRange, whereas a line break in
        // the textarea value is two characters. This function corrects for that by converting a text offset into a
        // range character offset by subtracting one character for every line break in the textarea prior to the
        // offset
        offsetToRangeCharacterMove: function(offset) {
            var el = this.dom;

            return offset - (el.value.slice(0, offset).split("\r\n").length - 1);
        },

        getXY: function () {
            var box = this.getBox();

            return [ box.x, box.y ];
        },

        getStyle: function (prop) {
            var dom = this.dom,
                view = dom.ownerDocument.defaultView,
                style;

            if (view && view.getComputedStyle) {
                style = view.getComputedStyle(dom, null);
            } else {
                style = dom.currentStyle;
            }

            return (style || dom.style)[normalize(prop)];
        },

        getScroll: function() {
            var me = this,
                scroller = me.getScroller(),
                dom = me.dom,
                pos;

            if (scroller) {
                pos = scroller.getPosition();
            } else {
                if (dom === doc || dom === docEl || dom == body) {
                    dom = me.self.getViewportScrollElement();
                }

                pos = {
                    x: dom ? dom.scrollLeft : 0,
                    y: dom ? dom.scrollTop : 0
                };
            }

            return pos;
        },

        scrollTo: function(x, y) {
            var me = this,
                scroller = me.getScroller(),
                dom = me.dom;

            if (scroller) {
                scroller.scrollTo(x, y);
            } else {
                if (dom === doc || dom === docEl || dom == body) {
                    dom = me.self.getViewportScrollElement();
                }

                if (dom) {
                    dom.scrollLeft = x;
                    dom.scrollTop = y;
                }
            }
        },

        getClassMap: function () {
            var me = this,
                className = me.dom.className,
                classMap = me._classMap;

            if (!classMap || me._className !== className) {
                me._className = className = (className || '');
                me._classMap = classMap = ST.Array.toMap(className.split(spaceRe));
                delete classMap[''];
            }

            return classMap;
        },

        /**
         * Returns the `Ext.Component` associated with this element.
         *
         * @return {Ext.Component}
         */
        getComponent: function() {
            var Ext = window.Ext,
                cmp = null,
                dom = this.dom,
                Comp, Mgr;

            if (Ext) {
                Comp = Ext.Component;
                if (Comp) {
                    if (Comp.fromElement && !Comp.fromElement.$emptyFn) {
                        // 5.1.1-5.1.x, 6.0.1+ (6.0.0 has an emptyFn placeholder)
                        cmp = Comp.fromElement(dom);
                    } else if (Comp.getComponentByElement) {
                        // 5.0.0, 5.0.1
                        try {
                            cmp = Comp.getComponentByElement(dom);
                        } catch (e) {}
                    } else {
                        Mgr = Ext.ComponentManager;

                        if (Mgr) {
                            if (Mgr.byElement) {
                                //5.1.0
                                cmp = Mgr.byElement(dom);
                            } else {
                                //Ext 4.x, Sencha Touch 2.x
                                cmp = this.$getComponentFromElement(dom);
                            }
                        }
                    }
                }
            }

            return cmp;
        },

        $getComponentFromElement: function (node, limit, selector) {
            var target = Ext.getDom(node),
                cache = Ext.ComponentManager.all,
                depth = 0,
                topmost, cmpId, cmp;

            if (cache.map) {
                cache = cache.map;
            }

            if (typeof limit !== 'number') {
                topmost = Ext.getDom(limit);
                limit = Number.MAX_VALUE;
            }

            if (cache) {
                while (target && target.nodeType === 1 && depth < limit && target !== topmost) {
                    cmpId = target.getAttribute('data-componentid') || target.id;

                    if (cmpId) {
                        cmp = cache[cmpId];

                        if (cmp && (!selector || Ext.ComponentQuery.is(cmp, selector))) {
                            return cmp;
                        }

                        // Increment depth on every *Component* found, not Element
                        depth++;
                    }

                    target = target.parentNode;
                }
            }

            return null;
        },

        getScroller: function() {
            var cmp = this.getComponent(),
                scroller = null,
                scrollMgr;

            if (cmp) {
                scrollMgr = cmp.scrollManager;
                if (scrollMgr) {
                    // 5.0
                    scroller = scrollMgr.scroller;
                } else if (cmp.getScrollable) {
                    // 5.1+
                    scroller = cmp.getScrollable();
                }
            }

            return scroller;
        },

        /**
         * Returns the elements `textContent`.
         */
        getText: function () {
            var dom = this.dom;

            if (inputTags[dom.tagName]) {
                return dom.value;
            }

            return dom[ST.isIE8 ? 'innerText' : 'textContent'];
        },

        /**
         * Returns `true` if this element has any of the classes in the given `cls` string
         * (of space-separated classes) or array of class names. Array elements are not
         * checked for space-separators.
         *
         * @param {String/String[]} cls The classes to test
         * @return {Boolean}
         * @method hasAnyCls
         */
        hasAnyCls: function (cls) {
            return this.hasCls(cls, true);
        },

        /**
         * Returns `true` if this element has the classes in the given `cls` string (of
         * space-separated classes) or array of class names. Array elements are not
         * checked for space-separators.
         *
         * @param {String/String[]} cls The classes to test
         * @param {Boolean} [any] Pass `true` to only require that one of the classes
         * must be present, `false` (the default) will require that all classes be present.
         * @return {Boolean}
         * @method hasCls
         */
        hasCls: function (cls, any) {
            var classMap = this.getClassMap(),
                i, n;

            if (typeof cls === 'string') {
                cls = cls.split(spaceRe);
            }

            for (i = n = cls && cls.length; i-- > 0; ) {
                if (classMap[cls[i]]) {
                    if (any) {
                        return true;  // one hit is good enough
                    }
                } else if (!any) {
                    return false;   // one miss is good enough
                }
            }

            // If we get here and !any then we only found matches. If any, we may
            // not have found any matches if cls was empty.
            return !any || !n;
        },

        isDetached: function () {
            var dom = this.dom; // logic borrow from Ext.isGarbage

            // determines if the dom element is in the document or in the detached body element
            // use by collectGarbage and Ext.get()
            return dom &&
                // window, document, documentElement, and body can never be garbage.
                dom.nodeType === 1 && dom.tagName !== 'BODY' && dom.tagName !== 'HTML' &&
                // if the element does not have a parent node, it is definitely not in the
                // DOM - we can exit immediately
                (!dom.parentNode ||
                    // If the element has an offset parent we can bail right away, it is
                    // definitely in the DOM.
                    (!dom.offsetParent &&
                        // if the element does not have an offsetParent it can mean the
                        // element is either not in the dom or it is hidden. The next
                        // step is to check to see if it can be found via getElementById
                        dom.ownerDocument.getElementById(dom.id) !== dom
                    )
                );
        },

        isUserEditable: function() {
            var me = this,
                dom = me.dom,
                contentEditable = dom.contentEditable;

            // contentEditable will default to inherit if not specified, only check if the
            // attribute has been set or explicitly set to true
            // http://html5doctor.com/the-contenteditable-attribute/
            if ((inputTags[dom.tagName] && !nonEditableInputTypes[dom.type] &&
                !dom.readOnly && !me.hasAttribute('disabled')) ||
                (contentEditable === '' || contentEditable === 'true')) {
                return true;
            }
            return false;
        },

        isVisible: function () {
            var me = this,
                el = me.dom.parentNode,
                isVisible = me.getStyle('visibility') !== 'hidden' &&
                            me.getStyle('display') !== 'none';

            for ( ; isVisible && el && el.nodeType === 1; el = el.parentNode) {
                // css visibility is inherited so only need to check 'display' on ancestors
                if (ST.fly(el, '$').getStyle('display') === 'none') {
                    // NOTE: we use a private fly since we are likely a fly ourselves
                    isVisible = false;
                }
            }

            return isVisible;
        },

        hasAttribute: function(attribute) {
            var dom = this.dom,
                ret;

            if (dom.hasAttribute) {
                ret = dom.hasAttribute(attribute);
            } else {
                // IE8m
                ret = dom.getAttribute(attribute) != null;
            }

            return ret;
        },

        on: function (eventName, fn, scope, capture) {
            return Element.on(this.dom, eventName, fn, scope, capture);
        },

        /**
         * @method query
         * Selects child nodes based on the passed CSS selector.
         * Delegates to document.querySelectorAll. More information can be found at
         * [http://www.w3.org/TR/css3-selectors/](http://www.w3.org/TR/css3-selectors/)
         *
         * All selectors, attribute filters and pseudos below can be combined infinitely
         * in any order. For example `div.foo:nth-child(odd)[@foo=bar].bar:first` would be
         * a perfectly valid selector.
         *
         * ## Element Selectors:
         *
         * * \* any element
         * * E an element with the tag E
         * * E F All descendant elements of E that have the tag F
         * * E > F or E/F all direct children elements of E that have the tag F
         * * E + F all elements with the tag F that are immediately preceded by an element with the tag E
         * * E ~ F all elements with the tag F that are preceded by a sibling element with the tag E
         *
         * ## Attribute Selectors:
         *
         * The use of @ and quotes are optional. For example, div[@foo='bar'] is also a valid attribute selector.
         *
         * * E[foo] has an attribute "foo"
         * * E[foo=bar] has an attribute "foo" that equals "bar"
         * * E[foo^=bar] has an attribute "foo" that starts with "bar"
         * * E[foo$=bar] has an attribute "foo" that ends with "bar"
         * * E[foo*=bar] has an attribute "foo" that contains the substring "bar"
         * * E[foo%=2] has an attribute "foo" that is evenly divisible by 2
         * * E[foo!=bar] has an attribute "foo" that does not equal "bar"
         *
         * ## Pseudo Classes:
         *
         * * E:first-child E is the first child of its parent
         * * E:last-child E is the last child of its parent
         * * E:nth-child(n) E is the nth child of its parent (1 based as per the spec)
         * * E:nth-child(odd) E is an odd child of its parent
         * * E:nth-child(even) E is an even child of its parent
         * * E:only-child E is the only child of its parent
         * * E:checked E is an element that is has a checked attribute that is true (e.g. a radio or checkbox)
         * * E:first the first E in the resultset
         * * E:last the last E in the resultset
         * * E:nth(n) the nth E in the resultset (1 based)
         * * E:odd shortcut for :nth-child(odd)
         * * E:even shortcut for :nth-child(even)
         * * E:not(S) an E element that does not match simple selector S
         * * E:has(S) an E element that has a descendant that matches simple selector S
         * * E:next(S) an E element whose next sibling matches simple selector S
         * * E:prev(S) an E element whose previous sibling matches simple selector S
         * * E:any(S1|S2|S2) an E element which matches any of the simple selectors S1, S2 or S3//\\
         *
         * ## CSS Value Selectors:
         *
         * * E{display=none} CSS value "display" that equals "none"
         * * E{display^=none} CSS value "display" that starts with "none"
         * * E{display$=none} CSS value "display" that ends with "none"
         * * E{display*=none} CSS value "display" that contains the substring "none"
         * * E{display%=2} CSS value "display" that is evenly divisible by 2
         * * E{display!=none} CSS value "display" that does not equal "none"
         *
         * @param {String} selector The CSS selector.
         * @param {Boolean} [asDom=false] `false` to return an array of ST.Element
         * @param single (private)
         * @return {HTMLElement[]/ST.Element[]} An Array of elements (
         * HTMLElement or ST.Element if `asDom` is `false`) that match the selector.  
         * If there are no matches, an empty Array is returned.
         */
        query: function(selector, asDom, single) {
            var dom = this.dom,
                results, len, node, nodes, i;

            if (!dom) {
                return null;
            }

            if (single) {
                // if single, only run querySelector
                node = dom.querySelector(selector);
                return asDom ? node : ST.get(node);
            } else {
                // if not single, run the full QSA
                results = [];
                nodes = dom.querySelectorAll(selector);

                for (i = 0, len = nodes.length; i < len; i++) {
                    node = nodes[i];
                    results.push(asDom ? node : ST.get(node));
                }

                return results;
            }
        },

        /**
         * @method down
         * Selects a single child at any depth below this element based on the passed CSS selector (the selector should not contain an id).
         * @param {String} selector The CSS selector
         * @param {Boolean} [asDom=false] `true` to return the DOM node instead of ST.Element
         * @return {HTMLElement/ST.Element} The child ST.Element (or DOM node if `asDom` is `true`)
         */
        down: function (selector, asDom) {
            return this.query(selector, asDom, true);
        },

        /**
         * @method child
         * Selects a single *direct* child based on the passed CSS selector (the selector should not contain an id).
         * @param {String} selector The CSS selector.
         * @param {Boolean} [asDom=false] `true` to return the DOM node instead of ST.Element.
         * @return {HTMLElement/ST.Element} The child ST.Element (or DOM node if `asDom` is `true`)
         */
        child: function (selector, asDom) {
            var me = this,
                results = me.query(selector, true),
                len = results.length,
                i, node;

            for (i=0; i<len; i++) {
                node = results[i];
                // if the parentNode of this node matches our starting context, 
                // this is a match and we can stop checking
                if (node.parentNode === me.dom) {
                    return asDom ? node : ST.get(node);
                }
            }

            return null;
        },

        /**
         * @method up
         * Walks up the dom looking for a parent node that matches the passed simple selector (e.g. 'div.some-class' or 'span:first-child').
         * This is a shortcut for findParentNode() that always returns an ST.Element.
         * @param {String} selector The simple selector to test.
         * @param {Number/String/HTMLElement/ST.Element} [limit]
         * The max depth to search as a number or an element that causes the upward
         * traversal to stop and is **not** considered for inclusion as the result.
         * (defaults to 50 || document.documentElement)
         * @param {Boolean} [asDom=false] True to return the DOM node instead of ST.Element
         * @return {ST.Element/HTMLElement} The matching DOM node (or DOM node if `asDom` is `true`)
         */
        up: function (selector, asDom, limit) {
            return this.findParentNode(selector, asDom, limit);
        },

        /**
         * @method is
         * Returns `true` if this element matches the passed simple selector
         * (e.g. 'div.some-class' or 'span:first-child').
         * @param {String/Function} selector The simple selector to test or a function which is passed
         * candidate nodes, and should return `true` for nodes which match.
         * @return {Boolean} `true` if this element matches the selector, else `false`.
         */
        is: function (selector) {
            var matchesSelector = this.matchesSelection(),
                dom = this.dom;

            if (matchesSelector) {
                return dom[matchesSelector](selector);
            } else {
                var elems = dom.parentNode.querySelectorAll(selector),
                    count = elems.length;

                for (var i = 0; i < count; i++) {
                    if (elems[i] === dom) {
                        return true;
                    }
                }
                return false;
            }
        },
        
        /**
         * @private
         */
        findParentNode: function (selector, asDom, limit) {
            var p = ST.fly(this.dom.parentNode);
            return p ? p.findParent(selector, asDom, limit) : null;
        },

        /**
         * @private
         */
        findParent: function(selector, asDom, limit) {
            var me = this,
                target = me.dom,
                topmost = document.documentElement,
                depth = 0;

            if (limit || limit === 0) {
                if (typeof limit !== 'number') {
                    topmost = ST.getDom(limit);
                    limit = Number.MAX_VALUE;
                }
            } else {
                // No limit passed, default to 50
                limit = 50;
            }

            while (target && target.nodeType === 1 && depth < limit && target !== topmost) {
                if (ST.fly(target).is(selector)) {
                    return !asDom ? ST.get(target) : target;
                }
                depth++;
                target = target.parentNode;
            }
            return null;
        },

        /**
         * @private
         */
        matchesSelection: function () {
            var el = document.documentElement,
                w3 = 'matches',
                wk = 'webkitMatchesSelector',
                ms = 'msMatchesSelector',
                mz = 'mozMatchesSelector';

            return el[w3] ? w3 : el[wk] ? wk : el[ms] ? ms : el[mz] ? mz : null;
        },

        statics: {
            getViewportScrollElement: function() {
                var standard = this.$standardScrollElement,
                    el = doc.scrollingElement,
                    iframe, frameDoc, el;

                if (el) {
                    return el;
                }

                if (standard === undefined) {
                    iframe = document.createElement('iframe');

                    iframe.style.height = '1px';
                    document.body.appendChild(iframe);
                    frameDoc = iframe.contentWindow.document;
                    frameDoc.write('<!DOCTYPE html><div style="height:9999em">x</div>');
                    frameDoc.close();
                    standard = frameDoc.documentElement.scrollHeight > frameDoc.body.scrollHeight;
                    iframe.parentNode.removeChild(iframe);

                    this.$standardScrollElement = standard;
                }
                return standard ? docEl : body;
            },

            getViewportSize: function() {
                return {
                    height: window.innerHeight || docEl.clientHeight,
                    width: window.innerWidth || docEl.clientWidth
                }
            },

            on: function (el, eventName, fn, scope, capture) {
                var ieEventModel = (el.attachEvent && (navigator.msMaxTouchPoints == null)), // IE8/9
                    wrap = function() {
                        return fn.apply(scope, arguments);
                    };

                fn = (typeof fn === 'string') ? scope[fn] : fn;

                if (ieEventModel) {
                    el.attachEvent('on' + eventName, wrap);
                } else {
                    el.addEventListener(eventName, wrap, !!capture);
                }

                return {
                    destroy: function() {
                        if (ieEventModel) {
                            el.detachEvent('on' + eventName, wrap);
                        } else {
                            el.removeEventListener(eventName, wrap, !!capture);
                        }
                        wrap = null;
                    }
                };
            }
        }
    };
},
function (Element) {
    var flies = {};

    /**
     * Given one of the various ways to identify a DOM node, this method returns the
     * DOM node or `null`.
     * @param {String/HTMLElement/ST.Element/Ext.Element} domNode
     * @return {HTMLElement}
     * @method getDom
     * @member ST
     */
    ST.getDom = function (domNode) {
        if (!domNode) {
            return null;
        }

        // This piece is aligned with Ext.getDom() except that we check for nodeType
        // to ensure we are not given truthy garbage.
        //
        if (typeof domNode === 'string') {
            domNode = document.getElementById(domNode);
        }
        else if (domNode.dom) {
            // May be an ST.Element or an Ext.Element, either way, just use the "dom"
            // value. This ensures an ST.Element is returned.
            domNode = domNode.dom;
        }
        else if (domNode != window && typeof domNode.nodeType !== 'number') {
            return null;
        }

        return domNode;
    };

    /**
     * Given one of the various ways to identify a DOM node, this method returns a
     * temporary, fly-weight `ST.Element` or `null`. Instances returned by this
     * method should be used briefly to call the methods of the `ST.Element` and then
     * ignored since the instance will be re-used by future calls to this method.
     * @param {String/HTMLElement/ST.Element/Ext.Element} domNode
     * @param {String} [flyName="fly"] An optional name for the fly. Passing a custom
     * name can be used to control the scope of re-use of the returned instance.
     * @return {ST.Element}
     * @method fly
     * @member ST
     */
    ST.fly = function (domNode, flyName) {
        if (!(domNode = ST.getDom(domNode))) {
            return null;
        }

        flyName = flyName || 'fly';

        var fly = flies[flyName] || (flies[flyName] = new Element());

        fly.dom = domNode;
        return fly;
    };

    /**
     * Given one of the various ways to identify a DOM node, this method returns a
     * temporary, fly-weight `ST.Element` or `null`. Each call to this method returns
     * a new `ST.Element` instance. Unlike `Ext.get()` this method does not maintain an
     * element cache nor does it assign an `id` to the element. In other words, this
     * method is equivalent to `new ST.Element()`.
     * @param {String/HTMLElement/ST.Element/Ext.Element} domNode
     * @return {ST.Element}
     * @method get
     * @member ST
     */
    ST.get = function (domNode) {
        if (!(domNode = ST.getDom(domNode))) {
            return null;
        }

        return new Element(domNode);
    };
});
