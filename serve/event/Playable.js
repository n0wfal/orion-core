/**
 * @class ST.event.Playable
 * This class is instantiated for each event record passed to the `{@link ST#play}`
 * method. The items in the array passed to `{@link ST#play}` are passed to the
 * `constructor` as the config object.
 */
ST.event.Playable = ST.define({
    isPlayable: true,

    /**
     * Constructor for an instance.
     * @param {Function/Number/Object} config A function is used to set the `fn` config
     * while a number sets the `delay`. Otherwise, the properties of the `config` object
     * are copied onto this instance.
     */
    constructor: function (config) {
        var me = this,
            t = typeof config;

        if (t === 'function') {
            me.fn = config;
            me.delay = 0;
        }
        else if (t === 'number') {
            me.delay = config;
        }
        else {
            ST.apply(me, config);

            if (me.delay === undefined && typeof me.fn === 'function') {
                me.delay = 0;
            }
        }
    },

    /**
     * For injectable events this property holds the event type. For example, "mousedown".
     * This should not be specified for non-injectable events.
     * @cfg {String} type
     */

    /**
     * @cfg {String/Function} target
     * A function that returns the target DOM node or {@link ST.Locator locator string}.
     */

    /**
     * The located element for the `target` of this event.
     * @property {ST.Element} targetEl
     * @readonly
     * @protected
     */

    /**
     * @cfg {String} relatedTarget
     * A function that returns the relatedTarget DOM node or
     * {@link ST.Locator locator string}.
     */

    /**
     * The located element for the `relatedTarget` of this event.
     * @property {ST.Element} relatedEl
     * @readonly
     * @protected
     */

    /**
     * The number of milliseconds of delay to inject after playing the previous event
     * before playing this event.
     * @cfg {Number} delay
     */

    /**
     * The function to call when playing this event. If this config is set, the `type`
     * property is ignored and nothing is injected.
     *
     * If this function returns a `Promise` that promise is resolved before the next
     * event is played. Otherwise, this function should complete before returning. If
     * this is not desired, the function must declare a single argument (typically named
     * "done" and call this function when processing is finished).
     *
     *      [{
     *          fn: function () {
     *              // either finish up now or return a Promise
     *          }
     *      }, {
     *          fn: function (done) {
     *              somethingAsync(function () {
     *                  // do stuff
     *
     *                  done(); // mark this event as complete
     *              });
     *          }
     *      }]
     *
     * @cfg {Function} fn
     */

    /**
     * @cfg {Number} x
     */

    /**
     * @cfg {Number} y
     */

    /**
     * @cfg {Number} button
     */

    /**
     * @cfg {Boolean} [animation=true]
     * Determines if animations must complete before this event is ready to be played.
     * Specify `null` to disable animation checks.
     */

    /**
     * @cfg {Boolean} [visible=true]
     * Determines if the `target` and `relatedTarget` must be visible before this event is
     * ready to be played. Specify `false` to wait for elements to be non-visible. Specify
     * `null` to disable visibility checks.
     */

    /**
     * @cfg {Boolean} [available=true]
     * Determines if the `target` and `relatedTarget` must be present in the dom (descendants
     * of document.body) before this event is ready to be played. Specify `false` to wait
     * for elements to be non-available. Specify `null` to disable availability checks.
     */

    /**
     * @cfg {Function} ready
     * An optional function that returns true when this event can be played. This config
     * will replace the `ready` method.
     */

    /**
     * @cfg {Number} timeout
     * The maximum time (in milliseconds) to wait for this event to be `ready`. If this
     * time is exceeded, playback will be aborted.
     */

    /**
     * @property {"init"/"queued"/"pending"/"playing"/"done"} state
     * @private
     */
    state: 'init',

    /**
     * Returns true when this event is ready to be played. This method checks for the
     * existence and visibility (based on the `visible` config) of the `target` and
     * `relatedTarget` elements. In addition, this method also waits for animations to
     * finish (based on the `animation` config).
     * @return {Boolean}
     */
    ready: function () {
        return this.animationsDone() && this.targetReady() && this.targetReady(true);
    },

    isReady: function () {
        if (ST.options.handleExceptions) {
            try {
                return this.ready();
            } catch (e) {
                this._player.doError(e);
                return false;
            }
        }

        return this.ready();
    },

    /**
     * Returns `true` when there are no animations in progress. This method respects the
     * `animation` config to disable this check.
     * @return {Boolean}
     */
    animationsDone: function () {
        var me = this,
            ext = window.Ext,
            anim = me.animation,
            fx, mgr;

        if (me.animation) {
            anim = (mgr = (fx = ext && ext.fx) && fx.Manager) && mgr.items;

            if (anim && anim.getCount()) {
                // TODO: sencha touch / modern toolkit flavor
                return me.setWaiting('animations', 'complete');
            }
        }

        return me.setWaiting(false);
    },

    /**
     * Returns `true` when the specified target is ready. The `ST.Element` instance is
     * cached on this object based on the specified `name` (e.g., "targetEl"). This method
     * respects the `visible` config as part of this check.
     *
     * @param {Boolean/String} [name="target"] The name of the target property. This is
     * the name of the property that holds the {@link ST.Locator locator string}. If
     * `true` or `false` are specified, these indicate the `relatedTarget` or `target`,
     * respectively.
     * @return {Boolean}
     */
    targetReady: function (name) {
        name = (name === true) ? 'relatedTarget' : (name || 'target');

        var me = this,
            elName = me._elNames,
            target = me[name],
            visibility = me.visible,
            availability = me.available,
            root = me.root,
            direction = me.direction,
            absent = availability === false,
            dom, el;

        if (target) {
            elName = elName[name] || (elName[name] = name + 'El');

            if (!(el = me[elName])) {
                if (target.isPlayable) {
                    // When a sequence of events targets the same thing, we can queue it
                    // like so:
                    //
                    //      ST.play([
                    //          { target: '@foo', ... },
                    //          { target: -1, ... },
                    //          { target: -2, ... }
                    //      ]);
                    //
                    // Which gets enqueued like this:
                    //
                    //      Q[0] = new ST.event.Playable({ target: '@foo', ... });
                    //      Q[1] = new ST.event.Playable({ target: Q[0], ... });
                    //      Q[2] = new ST.event.Playable({ target: Q[0], ... });
                    //
                    me[elName] = el = target[elName];
                }
            }

            if (el) {
                if (absent) {
                    if (el.isDetached()) {
                        return me.setWaiting(name, 'absent');
                    }
                    return me.setWaiting(false);
                }

                if (typeof target === 'string') {
                    dom = ST.find(target, false, root, direction);

                    if (dom && el.dom !== dom) {
                        // We store the wrapped el as soon as we find it, but if we are
                        // waiting for visibility it may be that the locator will not
                        // match the same DOM node from the previous tick. Instead of
                        // creating a new ST.Element we simply reset the dom property.
                        // Because we have a target string (vs a target playable), the
                        // ST.Element we stored is our own.
                        el.dom = dom;
                    }
                }
            } else {
                if (target.isPlayable) {
                    el = target[elName];
                    dom = el && el.dom;
                } else {
                    dom = ST.find(target, false, root, direction);
                }

                if (dom) {
                    me[elName] = el = new ST.Element(dom);

                    if (absent) {
                        return me.setWaiting(name, 'absent');
                    }
                }
                else if (absent) {
                    return me.setWaiting(false);
                }
                else if (availability !== null) {
                    // availability is seldom ever true... it is false if we want to
                    // wait for the DOM node to be unavailable (which was handled above)
                    // so that leaves availability === null which indicates we should
                    // not wait.
                    return me.setWaiting(name, 'available');
                }
            }

            if (el && visibility !== null) {
                if (visibility === false) {
                    if (el.isVisible()) {
                        return me.setWaiting(name, 'not visible');
                    }
                } else if (!el.isVisible()) {
                    return me.setWaiting(name, 'visible');
                }
            }
        }

        return me.setWaiting(false);
    },

    /**
     * This string contains the name of the item preventing readiness of this event. For
     * example, "target" or "relatedTarget". This is used to formulate an appropriate
     * error message should the `timeout` be exceeded. See `setWaiting` for setting
     * this value.
     * @property {String} waitingFor
     * @readonly
     * @protected
     */

    /**
     * This string describes the aspect of the item preventing readiness of this event.
     * For example, "available" or "visible". This is used to formulate an appropriate
     * error message should the `timeout` be exceeded. See `setWaiting` for setting
     * this value.
     * @property {String} waitingState
     * @readonly
     * @protected
     */

    /**
     * Updates the `waitingFor` and `waitingState` properties given their provided values
     * and returns `true` if this call clears the `waitingFor` property.
     *
     * This method is not normally called by user code but should be called if a custom
     * `ready` method is provided to ensure timeouts have helpful state information.
     *
     * @param {Boolean/String} waitingFor The {@link #waitingFor} value or `false` to clear
     * the waiting state.
     * @param {String} waitingState The {@link #waitingState} value.
     * @return {Boolean} `true` if `waitingFor` is `false` and `false` otherwise.
     * @protected
     */
    setWaiting: function (waitingFor, waitingState) {
        if (waitingFor === false) {
            waitingFor = waitingState = null;
        }

        this.waitingFor = waitingFor;
        this.waitingState = waitingState;

        return !waitingFor;
    },

    /**
     * The timestamp recorded when the event is first checked for readiness and found
     * not `ready`.
     * @property {Number} waitStartTime
     * @private
     * @readonly
     */
    waitStartTime: 0,

    _elNames: {
        relatedTarget: 'relatedEl'
    }
});
