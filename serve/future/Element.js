/**
 * @class ST.future.Element
 * A future Element is a class that can be used to interact with an element that will
 * exist at some point. Typically that element does not exist when the future is created.
 *
 * The methods of a future (including its constructor) defer actions in an event queue
 * (based on {@link ST.event.Player}). A simple example would be:
 *
 *      ST.element('@some-div').
 *          click(10, 10);
 *
 * The API of futures is based on chained method calls, sometimes called a "fluent"
 * API. In the above example, the `{@link ST#element}` method accepts the locator and
 * returns a future. The `{@link #click click}` method of the future queues a click
 * event at offset (10, 10).
 *
 * ## Actions
 * Many methods of futures perform actions (such as `click`) on their target. These
 * methods schedule their actions so that they follow previously invoked future methods
 * to ensure that these actions flow in the same order as the test code that requested
 * them.
 *
 * Actions methods use verbs for names.
 *
 * ## States
 * The other main group of methods on futures are state methods. These methods do not
 * affect their target but rather schedule a delay in the test sequence that begins at
 * the proper time (following all previously schedules operations) and finishing when
 * the target arrives in the desired state.
 *
 * For example:
 *
 *      ST.element('@some-div').
 *          click(10, 10).
 *          textLike(/hello/i);
 *
 * The above test will locate our div, click on it and then wait for its `textContent`
 * to match the specified regular expression. The test will complete successfully if
 * the text matches within the default timeout (5 seconds) and will fail otherwise.
 *
 * State methods use nouns or descriptions for names.
 *
 * ## Inspections
 * Because operations on futures all complete asynchronously, it is important not to
 * mix these operations with immediate method calls. Instead, we schedule inspections
 * using the future's `{@link #and}` method.
 *
 *      ST.element('@some-div').
 *          click(10, 10).
 *          and(
 *              // Invoked after the click has played. The ST.Element wrapper for
 *              // the target div is given as a parameter.
 *              function (divEl) {
 *                  expect(divEl.hasCls('foo')).toBe(false);
 *              }
 *          );
 *
 * The functions passed to `and()` are called "inspections" but there are no particular
 * restrictions on what these methods actually do when they are called.
 *
 * ## Waiting
 * There are two basic ways to control the timing of the test sequence. The first is the
 * `and()` method's optional second argument:
 *
 *      ST.element('@some-div').
 *          click(10, 10).
 *          and(function (divEl, done) {
 *              something().then(done);
 *          });
 *
 * When an inspection function is declared to have a second argument, it is called with
 * a completion function typically named "done". If declared as an argument, this function
 * must be called or the test will fail. The inspection function, however, can decide when
 * the function should be called. Once `done` is called, the test sequence can continue.
 *
 * When there is no mechanism that can reasonably be used to determine when a condition
 * is satisfied, there is the `{@link #wait}` method.
 *
 *      ST.element('@some-div').
 *          click(10, 10).
 *          wait(function (divEl) {
 *              return divEl.hasCls('foo');
 *          });
 *
 * In this case, the function passed to `wait()` is called periodically and when it
 * eventually returns `true` the test can proceed. Obviously, the `and()` method and its
 * `done` function are preferrable because they won't need to poll for completion. Which
 * approach is more readily implemented in a given situation will typically determine the
 * best choice, and not this slight performance consideration.
 *
 * ## Components
 *
 * When interacting with Ext JS components, see `{@link ST#component}` or one of the
 * more specific methods such as `{@link ST#panel}`, `{@link ST#grid}`, etc..
 *
 * ### Note
 *
 * This class is not created directly by user code. Instead, it is created automatically
 * by various helper methods, like {@link ST#element} and {@link ST#wait}.
 */
ST.future.Element = ST.define({
    valueProperty: 'el',

    statics: {
        addState: function (state, config) {
            if (typeof config === 'function') {
                config = {
                    is: config
                };
            }

            // For example:
            //
            //      collapsed: {
            //          is: function () {
            //              return this.cmp.collapsed;
            //          },
            //          wait: function (fn) {
            //              var cmp = this.cmp;
            //
            //              cmp.on({
            //                  collapsed: fn,
            //                  single: true
            //              });
            //
            //              return function () {
            //                  cmp.un({
            //                      collapsed: fn,
            //                      single: true
            //                  });
            //              };
            //          }
            //      },
            //
            //      expanded: {
            //          is: function () {
            //              return !this.cmp.collapsed;
            //          },
            //          wait: 'expand'   // generates code like above but expand event
            //      },
            //
            //      visible: function () {
            //          return this.el.isVisible();
            //      }
            //
            // Usage:
            //
            //      ST.panel('@thePanel').collapsed();
            //
            var wait = config.wait,
                is = config.is,
                eventName, fn, i;

            if (wait) {
                if (typeof wait !== 'function') {
                    eventName = (typeof wait === 'string') ? [wait] : wait;

                    wait = function (done) {
                        var me = this,
                            cmp = me.cmp,
                            listener = {}, 
                            args = ST.Array.slice(arguments, 1),
                            fn, timer;

                        fn = function () {
                            if (is.apply(me, args)) {
                                if (timer) {
                                    ST.deferCancel(timer);
                                }

                                cmp.un(listener);
                                done();
                                done = ST.emptyFn;
                            } else if (!timer) {
                                timer = ST.defer(function () {
                                    timer = null;

                                    if (is.apply(me, args)) {
                                        cmp.un(listener);
                                        done();
                                        done = ST.emptyFn;
                                    }
                                }, 0);
                            }
                        }

                        for (i=0; i<eventName.length; i++) {
                            listener[eventName[i]] = fn;
                        }
                        
                        cmp.on(listener);

                        return function () {
                            cmp.un(listener);
                        };
                    };
                }

                fn = function () {
                    var me = this,
                        args = ST.Array.slice(arguments),
                        timeout;

                    if (args.length > is.length) {
                        timeout = args.pop();
                    }

                    ST.play([{
                        target: me.locator,
                        timeout: timeout,
                        visible: null,
                        available: config.available,

                        // With a wait() we can just schedule in a call to advance
                        // instead of polling the is() method.
                        fn: function (done) {
                            var event = this,
                                timer, unwait;

                            if (is.apply(me, args)) {
                                done();
                            } else {
                                event.setWaiting(state, 'true');

                                args.unshift(function () {
                                    if (timer) {
                                        timer = timer();  // call cancelFn
                                        event.setWaiting(false);
                                        done();
                                    }
                                });

                                unwait = wait.apply(me, args);

                                timer = ST.timeout(function () {
                                    timer = 0;
                                    unwait();
                                    event._player.doTimeout(event);
                                }, timeout);
                            }
                        }
                    }]);

                    return me;
                };
            } else {
                fn = function () {
                    var me = this,
                        args = ST.Array.slice(arguments),
                        timeout;

                    if (args.length > is.length) {
                        timeout = args.pop();
                    }

                    ST.play([{
                        target: me.locator,
                        timeout: timeout,
                        visible: null,
                        available: config.available,

                        // Without wait() we must just poll... which is what ready
                        // does already.
                        ready: function () {
                            if (this.animationsDone() && this.targetReady()) {
                                if (!is.apply(me, args)) {
                                    return this.setWaiting(state, 'true');
                                }
                                return this.setWaiting(false);
                            }
                            return false;
                        }
                    }]);

                    return me;
                };
            }

            this.prototype[state] = fn;
        },

        addStates: function (states) {
            for (var name in states) {
                this.addState(name, states[name]);
            }
        }
    },

    constructor: function (locator, timeout) {
        var me = this,
            available, root, direction;

        if (locator) {
            if (locator.constructor === Object) {
                timeout = locator.timeout;
                available = locator.available;
                root = locator.root;
                direction = locator.direction;
                locator = locator.locator;
            }

            if (locator.isComponent || locator.isWidget) {
                locator = locator.el || locator.element; // el=Ext, element=Touch
            }
        }

        me.timeout = timeout;

        if (locator) {
            if (locator.dom && !locator.$ST) {
                locator = new ST.Element(locator.dom);
            }

            me.locator = ST.play([{
                target: locator,
                visible: null,  // don't worry about visibility...
                animation: false, // ...or animations at this stage
                available: available,
                root: root,
                direction: direction,
                timeout: timeout,

                fn: function () {
                    me.el = this.targetEl;  // an ST.Element (this is the Playable)

                    if (me._attach) {
                        me._attach();
                    }
                }
            }])[0];
        }
    },

    /**
     * Schedules arbitrary actions for later execution. Often these actions are added
     * to the queue following {@link #click} or other interactions in order to test an
     * expectation.
     *
     * For example:
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          and(function (el) {
     *              // Runs after the click event. We receive the ST.Element
     *              // wrapper for the "some-div" element.
     *
     *              expect(el.hasCls('foo')).toBe(true);
     *          });
     *
     * Functions that need to perform asynchronous actions can declare a 2nd argument
     * (typically called "done").
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          and(
     *              function (el, done) {
     *                  expect(el.hasCls('foo')).toBe(true);
     *
     *                  Ext.Ajax.request({
     *                      ...
     *                      callback: function () {
     *                          done();
     *                      }
     *                  });
     *              }
     *          );
     *
     * Multiple actions can be listed in a single call. Asynchronous actions can override
     * the {@link ST.options#timeout timeout} by specifying a number as the
     * previous argument.
     *
     * For example:
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          and(
     *              1000,   // timeout for following async steps in this and()
     *
     *              function (el, done) {
     *                  expect(el.hasCls('foo')).toBe(true);
     *
     *                  Ext.Ajax.request({
     *                      ...
     *                      callback: function () {
     *                          done();
     *                      }
     *                  });
     *              },
     *              function (el) {
     *                  expect(el.hasCls('foo')).toBe(false);
     *              }
     *          );
     *
     * @param {Number/Function...} fnOrTimeout One or more functions to invoke or timeout
     * values. Functions that declare a 2nd argument must call the provided function to
     * indicate that they are complete. Timeout values affect subsequent asynchronous
     * functions and override the {@link ST.options#timeout timeout}. These
     * timeouts only apply to functions passed in the current call.
     *
     * @return {ST.future.Element} this
     * @chainable
     */
    and: function () {
        var me = this,
            events = [],
            timeout; // undefined so we get "player.timeout || ST.options.timeout"

        ST.each(arguments, function (fn) {
            var wrapFn;

            if (typeof fn === 'number') {
                timeout = fn;
            }
            else {
                if (fn.length > 1) {
                    wrapFn = function (done) {
                        return fn(me._value(), done);
                    };
                } else {
                    wrapFn = function () {
                        return fn(me._value());
                    };
                }

                events.push({
                    fn: wrapFn,
                    timeout: timeout
                });
            }
        });

        ST.play(events);
        return me;
    },

    _splits: {},
    _decodeArgs: function (args, params, rec) {
        var me = this,
            splits = me._splits,
            array = splits[params],
            n = args.length,
            a = args[0],
            i;

        if (n === 1 && a && a.constructor === Object) {
            ST.apply(rec, a);
        } else {
            if (!array) {
                splits[params] = array = params.split(',');
            }

            n = Math.min(n, array.length);

            for (i = 0; i < n; ++i) {
                rec[array[i]] = args[i];
            }
        }

        return rec;
    },

    /**
     * Schedules a click action at the specified relative coordinates.
     *
     *      ST.element('@some-div').
     *          click(10, 10);
     *
     * Or for a Component:
     *
     *      ST.component('#some-cmp').
     *          click(10, 10);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object for a `type="click"` event. In this case, all other arguments are
     * ignored.
     * @param {Number/Object} x The number of pixels from the left edge of the element.
     * @param {Number} y The number of pixels from the top edge of the element.
     * @param {Number} [button=0] The mouse button code for the click.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    click: function () {
        var me = this,
            event = me._decodeArgs(arguments, 'x,y,button,timeout', {
                type: 'tap',
                target: me.locator
            });

        ST.play([event]);

        return me;
    },

    emptyRe: /^\s*$/,

    /**
     * Waits for this element's `innerHTML` to match the specified value.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          content('Hello <b>world</b>');
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `html` property). In this case, all
     * other arguments are ignored.
     * @param {String/Object} html The html to match.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     * @since 1.0.1
     */
    content: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'html,timeout', {
                waitingFor: 'content',
                waitingState: 'match ',

                ready: function () {
                    if (html === me.el.dom.innerHTML) {
                        return this.setWaiting(false);
                    }
                    return false;
                }
            }),
            html = rec.html;

        rec.waitingState += html;
        delete rec.html;

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `innerHTML` to be empty.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          contentEmpty();
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    contentEmpty: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                waitingFor: 'content',
                waitingState: 'empty',

                ready: function () {
                    if (me.emptyRe.test(me.el.dom.innerHTML)) {
                        return this.setWaiting(false);
                    }
                    return false;
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `innerHTML` to match the specified RegExp `pattern`.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          contentLike(/hello/i);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `pattern` property). In this case, all
     * other arguments are ignored.
     * @param {RegExp/String/Object} pattern The pattern to match. If this is a String, it
     * is first promoted to a `RegExp` by called `new RegExp(pattern)`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    contentLike: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'pattern,timeout', {
                waitingFor: 'content',
                waitingState: 'like ',

                ready: function () {
                    if (re.test(me.el.dom.innerHTML)) {
                        return this.setWaiting(false);
                    }
                    return false;
                }
            }),
            pattern = rec.pattern,
            re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

        rec.waitingState += pattern;
        delete rec.pattern;

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `innerHTML` to be non-empty.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          contentNotEmpty();
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    contentNotEmpty: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                waitingFor: 'content',
                waitingState: 'not empty',

                ready: function () {
                    if (me.emptyRe.test(me.el.dom.innerHTML)) {
                        return false;
                    }
                    return this.setWaiting(false);
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `innerHTML` to not match the specified RegExp `pattern`.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          contentNotLike(/world/i);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `pattern` property). In this case, all
     * other arguments are ignored.
     * @param {RegExp/String/Object} pattern The pattern to match. If this is a String, it
     * is first promoted to a `RegExp` by called `new RegExp(pattern)`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    contentNotLike: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'pattern,timeout', {
                waitingFor: 'content',
                waitingState: 'not like ',

                ready: function () {
                    if (!re.test(me.el.dom.innerHTML)) {
                        return this.setWaiting(false);
                    }
                    return false;
                }
            }),
            pattern = rec.pattern,
            re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

        rec.waitingState += pattern;
        delete rec.pattern;

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `textContent` to match the specified string.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          text('Hello world');
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `text` property). In this case, all
     * other arguments are ignored.
     * @param {String/Object} text The text to match.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     * @since 1.0.1
     */
    text: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'text,timeout', {
                waitingFor: 'text',
                waitingState: 'match ',

                ready: function () {
                    var t = me.el.getText();

                    if (text === t) {
                        return this.setWaiting(false);
                    }

                    return false;
                }
            }),
            text = rec.text;

        rec.waitingState += text;
        delete rec.text;

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `textContent` to be empty.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          textEmpty();
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    textEmpty: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                waitingFor: 'text',
                waitingState: 'empty',

                ready: function () {
                    var text = me.el.getText();

                    if (me.emptyRe.test(text)) {
                        return this.setWaiting(false);
                    }

                    return false;
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `textContent` to match the specified RegExp `pattern`.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          textLike(/hello/i);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `pattern` property). In this case, all
     * other arguments are ignored.
     * @param {RegExp/String/Object} pattern The pattern to match. If this is a String, it
     * is first promoted to a `RegExp` by called `new RegExp(pattern)`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    textLike: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'pattern,timeout', {
                waitingFor: 'text',
                waitingState: 'like ',

                ready: function () {
                    var text = me.el.getText();

                    if (re.test(text)) {
                        return this.setWaiting(false);
                    }

                    return false;
                }
            }),
            pattern = rec.pattern,
            re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

        rec.waitingState += pattern;
        delete rec.pattern;

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `textContent` to be non-empty.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          textNotEmpty(200);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    textNotEmpty: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                waitingFor: 'text',
                waitingState: 'not empty',

                ready: function () {
                    var text = me.el.getText();

                    if (me.emptyRe.test(text)) {
                        return false;
                    }

                    return this.setWaiting(false);
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * Waits for this element's `textContent` to not match the specified RegExp `pattern`.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *          textNotLike(/hello/i, 200);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `pattern` property). In this case, all
     * other arguments are ignored.
     * @param {RegExp/String/Object} pattern The pattern to match. If this is a String, it
     * is first promoted to a `RegExp` by called `new RegExp(pattern)`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    textNotLike: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'pattern,timeout', {
                waitingFor: 'text',
                waitingState: 'not like ',

                ready: function () {
                    var text = me.el.getText();

                    if (!re.test(text)) {
                        return this.setWaiting(false);
                    }

                    return false;
                }
            }),
            pattern = rec.pattern,
            re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

        rec.waitingState += pattern;
        delete rec.pattern;

        ST.play([rec]);

        return me;
    },

    /**
     * Schedules a "type" action at the specified relative coordinates.  This method
     * assumes you have already achieved correct focus of the target.
     *
     *      ST.element('@some-div/input').
     *          focus().
     *          type('Hello world');
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object for a `type="type"` event. In this case, all other arguments are
     * ignored.
     * @param {String/Object} text The text to type.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the
     * typing to finish.
     * @return {ST.future.Element} this
     * @chainable
     */
    type: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'text,timeout', {
                type: 'type',

                target: function () {
                    var el = me._getFocusEl();
                    return el && el.dom;
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * Schedules the component to receive the focus.
     *
     *      ST.element('@some-div/input').
     *          focus();
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    focus: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    var el = me._getFocusEl();

                    if (el) {
                        el.focus();
                    }
                }
            });

        ST.play([rec]);

        return me.focused(100); // short timeout - focus should be immediate
    },

    /**
     * Schedules a wait a specified amount of time (in milliseconds) or until a provided
     * function returns a truthy value.
     *
     * For example:
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *
     *          wait(100).  // wait 100ms
     *
     *          and(function (el) {
     *              // Runs after the click event. We receive the ST.Element
     *              // wrapper for the "some-div" element.
     *
     *              expect(el.hasCls('foo')).toBe(true);
     *          });
     *
     * Sometimes the condition on which a wait is based cannot be handles via callbacks
     * or events and must be polled. That is, one must check and re-check at some short
     * interval to determine if the condition is satisfied.
     *
     * For example:
     *
     *      var t = 0;
     *
     *      setTimeout(function () {
     *          t = 1;
     *      }, 1000);
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *
     *          wait(function (el) {
     *              // this test method ignores the el (ST.Element) argument
     *              // for demonstration purposes.
     *              return t;
     *          }).
     *
     *          and(function (el) {
     *              // Runs after the click event and when t is truthy. We receive the
     *              // ST.Element wrapper for the "some-div" element.
     *
     *              expect(el.hasCls('foo')).toBe(true);
     *          });
     *
     * These can be combined as needed.
     *
     *      ST.element('@some-div').
     *          click(10, 10).
     *
     *          wait(200, // wait 200ms
     *
     *              function (el) {
     *                  return t;  // poll this one until it is truthy
     *              },
     *
     *              300,  // wait 300ms
     *
     *              'Something interest', // message for the next fn's timeout reason
     *
     *              function (el) {
     *                  return el.somethingInteresting();
     *              }
     *          ).
     *
     *          and(function (el) {
     *              expect(el.hasCls('foo')).toBe(true);
     *          });
     *
     * @param {Number/String/Function...} delayOrPollFn One or more millisecond delays,
     * functions to poll for truthy return value or timeout messages for said functions.
     * @return {ST.future.Element} this
     * @chainable
     */
    wait: function () {
        var me = this,
            events = [],
            message;

        ST.each(arguments, function (delay) {
            var t = typeof delay,
                m = message;

            if (t === 'number') {
                events.push({ delay: delay });
            } else if (t === 'string') {
                message = delay;
            } else if (t === 'function') {
                events.push({
                    waitingFor: message,
                    waitingState: 'truthy',
                    ready: function () {
                        if (delay.call(me, me._value(), me, this)) {
                            return this.setWaiting(false); // not "me"
                        }
                        return this.setWaiting(m || delay.toString(),
                                               m ? 'ready' : 'truthy');
                    }
                });

                message = null;
            } else {
                throw new Error('wait() accepts millisecond delays or functions');
            }
        });

        ST.play(events);
        return this;
    },

    /** 
     * @method down
     * Returns a descendant `{@link ST.future.Element future element}` that corresponds
     * to the specified selector. 
     *
     *      ST.element('@someElement').
     *          down('span').
     *          and(function (element) {
     *              // span is now available
     *          });
     *
     * If the specified selector for the descendant element cannot be resolved, the request will timeout.
     * @param {String} locator The DOM Query selector to use to search for the descendant
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    down: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'down', selector, timeout);
    },

    /** 
     * @method up
     * Returns an ancestor `{@link ST.future.Element future element}` that corresponds
     * to the specified selector. 
     *
     *      ST.element('@someElement').
     *          up('div').
     *          and(function (element) {
     *              // div is now available
     *          });
     *
     * If the specified selector for the ancestor element cannot be resolved, the request will timeout.
     * @param {String} selector The DOM Query selector to use to search for the ancestor
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    up: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'up', selector, timeout);
    },

    /** 
     * @method child
     * Returns a direct child `{@link ST.future.Element future element}` that corresponds
     * to the specified selector. 
     *
     *      ST.element('@someElement').
     *          child('p').
     *          and(function (element) {
     *              // p is now available
     *          });
     *
     * If the specified selector for the child element cannot be resolved, the request will timeout.
     * @param {String} selector The DOM Query selector to use to search for the child component
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    child: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'child', selector, timeout);
    },

    //-----------------------------------------------------------------
    // Private

    _createRelatedFuture: function (maker, direction, locator, timeout) {
        var me = this,
            future;

        // create the future
        future = maker({
            locator: locator,
            root: me,
            direction: direction,
            timeout: timeout
        });

        // add a flag so we know the requested relationship of these components
        future.related = this;

        return future;
    },

    _value: function () {
        var me = this,
            valueProperty = me.valueProperty;

        return (valueProperty && me[valueProperty]) || me;
    },

    _getFocusEl: function() {
        return this.el;
    }
});

ST.future.Element.addStates({
    /**
     * Waits for this element to have a specified CSS class.
     *
     *      ST.element('@someEl').
     *          hasCls('foo').
     *          and(function (el) {
     *              // el is now does has a "foo" class
     *          });
     *
     * @param {String} cls The class name to test.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    hasCls: function (cls) {
        return this.el.hasCls(cls);
    },

    /**
     * Waits for this element to become hidden.
     *
     *      ST.element('@someEl').
     *          hidden().
     *          and(function (el) {
     *              // el is now hidden
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    hidden: function () {
        return !this.el.isVisible();
    },

    /**
     * Waits for this element to not have a specified CSS class.
     *
     *      ST.element('@someEl').
     *          missingCls('foo').
     *          and(function (el) {
     *              // el is now does not have a "foo" class
     *          });
     *
     * @param {String} cls The class name to test.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    missingCls: function (cls) {
        return !this.el.hasCls(cls);
    },

    /**
     * Waits for this element to be removed from the document.
     *
     *      ST.element('@someEl').
     *          removed().
     *          and(function (el) {
     *              // el is now removed from the document
     *          });
     *
     * @method removed
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    removed: {
        is: function () {
            return !ST.fly(document.body).contains(this.el);
        },
        available: false
    },

    /**
     * Waits for this element to become visible.
     *
     * Event injection methods automatically wait for target visibility, however, if
     * using `and` sequences explicitly waiting for visibility may be necessary.
     *
     *      ST.element('@someEl').
     *          visible().
     *          and(function (el) {
     *              // el is now visible
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    visible: function () {
        return this.el.isVisible();
    },

    /**
     * Waits for this element to become focused.
     *
     *      ST.element('@someEl').
     *          focused().
     *          and(function (el) {
     *              // el is now hidden
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    focused: function() {
        return document.activeElement === this._getFocusEl().dom;
    },

    /**
     * Waits for this element to become blurred.
     *
     *      ST.element('@someEl').
     *          focused().
     *          and(function (el) {
     *              // el is now hidden
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element} this
     * @chainable
     */
    blurred: function() {
        return document.activeElement !== this._getFocusEl().dom;
    },


    /**
     * Takes a snapshot of the viewport and compares it to the associated baseline image.
     *
     *      ST.element('@someEl').
     *          click(10, 10).
     *          screenshot();
     *
     * @param {String} name
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @method screenshot
     * @return {ST.future.Element} this
     * @chainable
     */
    screenshot: function(name, timeout) {
        ST.screenshot(name, null, timeout);
        return this;
    }

    /*
    * snapshot: function () {}
    * */
});

/**
 * Returns a {@link ST.future.Element future element} used to queue operations for
 * when that element becomes available (not necessiarly `visible`).
 *
 * Once a future is returned from this method, it is typically used to describe some
 * sequence of actions, wait for state transitions and perform inspections.
 *
 *      ST.element('@someEl').
 *          click(10, 10).
 *          textLike(/hello/i).
 *          and(function (el) { ... });
 *
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the element.
 * @return {ST.future.Element}
 * @method element
 * @chainable
 * @member ST
 */
ST.element = function (locator, timeout) {
    return new ST.future.Element(locator, timeout);
};

/**
 * Schedules a wait for an element to be absent or missing from the DOM. This is typically
 * used after some future action that should cause a removal.
 *
 *      ST.button('@okButton').click();
 *      ST.absent('@confirmationWindow'); // the window owning the OK button
 *
 * This method is similar to `{@link ST.future.Element#removed}` but the difference
 * is that this method does not first wait for the specified element to be found. This
 * difference makes this method suitable for checking for things that should not be
 * present in the first place.
 *
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the element
 * to be removed.
 * @method absent
 * @return {ST.future.Element}
 * @chainable
 * @member ST
 */
ST.absent = function (locator, timeout) {
    return new ST.future.Element({
        locator: locator,
        timeout: timeout,
        available: false
    });
};

/**
 * Returns a limited-use {@link ST.future.Element future} that can be used only to
 * {@link ST.future.Element#wait wait} and perform some
 * {@link ST.future.Element#and manual steps}.
 * @return {ST.future.Element}
 * @method wait
 * @member ST
 */
ST.wait = function () {
    var future = new ST.future.Element();

    return future.wait.apply(future, arguments);
};

ST.future.classes = [];

ST.future.define = function (componentName, body) {
    if (!body.extend) {
        body.extend = ST.future.Element;
    }

    var states = body.states;

    delete body.states;

    var cls = ST.define(body),
        parts = componentName.split('.'),
        methodScope = ST,
        classScope = ST.future,
        factoryName,
        name;

    if (states) {
        cls.addStates(states);  // an inherited static method
    }

    while (parts.length > 1) {
        name = parts.shift();

        if (!classScope[name]) {
            classScope[name] = {};
        }
        if (!methodScope[name]) {
            methodScope[name] = {};
        }
    }

    name = parts[0];

    // track the classes being defined
    ST.future.classes.push(cls);

    if (body.factoryable === false) {
        delete cls.prototype.factoryable;
    } else {
        factoryName = ST.decapitalize(name);
        ST.context.Base.prototype[factoryName] = function (locator, timeout) {
            // TODO return new cls(this, locator, timeout); 
            return new cls(locator, timeout);
        };
        
        methodScope[factoryName] = function (locator, timeout) {
            // TODO return new cls(ST.defaultContext, locator, timeout);
            return new cls(locator, timeout);
        };
    }

    return classScope[ST.capitalize(name)] = cls;
};
