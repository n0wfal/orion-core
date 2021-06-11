/**
 * @class ST.event.Player
 * @extend ST.event.Driver
 *
 * This class is rarely used directly, but is the underlying mechanism used the inject
 * events using the {@link ST#play} and {@link ST.future.Element futures} API's.
 */
ST.event.Player = ST.define({
    extend: ST.event.Driver,

    /**
     * @cfg {Array} events The event queue to playback. This must be provided before
     * the {@link #method-start} method is called.
     */

    /**
     * @cfg {Boolean} pauseForAnimations True to pause event playback during animations, false
     * to ignore animations. Default is true.
     */
    pauseForAnimations: true,

    /**
     * @cfg {Boolean} translate
     * `false` to disable event translation.  If `false` events that are not supported by
     * the browser's event APIs will simply be skipped.
     */
    translate: true,

    /**
     * @cfg {Boolean} visualFeedback
     * `false` to disable visual feedback during event playback (mouse cursor, and "gesture"
     * indicator)
     */
    visualFeedback: true,

    /**
     * @cfg {Number} timeout
     * The event player will wait for certain conditions to be met before playing each
     * event in the queue.  These conditions include:
     *
     * - target element present and visible in DOM
     * - Ext JS framework animations complete
     *
     * If the time waited for these conditions to be met exceeds this timeout value,
     * playback will be aborted.
     *
     * If specified, this will be the default {@link ST.event.Playable#timeout timeout}
     * for all events. Otherwise, the {@link ST.options#timeout timeout} will be
     * used.
     */

    /**
     * @cfg {Number} waitInterval
     * Amount of time (in milliseconds) to wait before trying again if event cannot be
     * played due to target element not being available, animations in progress, etc.
     */
    waitInterval: ST.isIE9m ? 50 : 10,

    gestureStartEvents: {
        mousedown: 1,
        pointerdown: 1,
        touchstart: 1
    },

    gestureEndEvents: {
        mouseup: 1,
        pointerup: 1,
        touchend: 1,
        pointercancel: 1,
        touchcancel: 1
    },

    paused: 0,

    /**
     * This property holds the event last pulled from the queue but yet to be played.
     */
    pendingEvent: null,

    pendingFn: false,

    /**
     * @event timeout
     * Fires when the player times out while waiting for conditions to be met in order
     * for playback to proceed, for example, target element unavailable or animations
     * never finished.
     * @param {ST.event.Player} this
     * @param {String} message A message containing the reason for timeout
     */

    constructor: function (config) {
        var me = this,
            pointerElement = me.pointerElement = document.createElement('div'),
            className = 'orion-mouse-pointer';

        if (ST.isMac || ST.isiOS) {
            className += ' orion-mouse-pointer-mac';
        }

        me.events = [];
        ST.apply(me, config);

        pointerElement.className = className;
        me._nextId = 1;

        me.injector = new ST.event.Injector({
            player: me,
            translate: me.translate
        });
        
        me.gestureIndicators = [];
        me.touchCount = 0;
        me.lastGestureEndTime = 0;
        me.setupGesturePublisher();
    },

    /**
     * Adds new {@link ST.event.Playable events} to the play queue.
     *
     * This method is not normally called by user code. Use {@link ST#play} insteaad.
     * @param [index]
     * @param {ST.event.Playable[]} events The events to add or config objects for
     * them.
     * @return {ST.event.Playable[]} The `events` array with each element now promoted
     * from config object to `ST.event.Playable` instance.
     * @private
     */
    add: function (index, events) {
        var me = this,
            _events = me.events,
            length = _events.length,
            timeout = ST.options.timeout,
            count, inserting, e, i, queue, t;

        if (typeof index !== 'number') {
            events = index;
            index = null;
        }

        count = events.length;

        // The default behavior is to insert at the beginning of the queue if there is
        // a "playable" fn further up the call stack.  This is primarily to accomodate
        // nested future calls, for example:
        //
        // ST.element('foo').and(function() {
        //     ST.element('bar').and(function() {
        //         foo.innerHTML = 'bar is available';
        //     });
        // }).click();
        //
        // In the above example the events should be played in the order they appear visually.
        // The "click" event should happen after foo's innerHTML is changed.
        if (index == null) {
            // This value is set to 0 by and() before it calls the user's fn.
            index = me.pendingFn;

            // And to "false" when we are not inside an and() callback.
            if (index === false) {
                index = length;
            } else {
                // Each call to a futures method enqueues events here. If these are
                // made sequentially in an and() callback, we need to preserve their
                // order by tracking where we left off from the last call.
                me.pendingFn += count;
            }
        }

        inserting = index < length;

        // splice() is bugged on IE8 so we avoid it and just slice the events prior to
        // "index" into a new array.
        queue = inserting ? (index ? _events.slice(0, index) : []) : _events;

        for (i = 0; i < count; ++i) {
            e = events[i];

            if (e || e === 0) {  // if (not truthy or 0 skip it)
                if (!e.isPlayable) {
                    events[i] = e = new ST.event.Playable(e);
                }

                // Check for { target: -1, ... } and promote it to use the playable
                // backwards that number from this entry.
                //
                if (typeof(t = e.target) === 'number') {
                    e.target = queue[queue.length + t];
                } else if (t && t.dom) {
                    // Also support { target: someEl, ... } and set the targetEl now
                    e.targetEl = t.$ST ? t : new ST.Element(t.dom);
                }

                if (typeof(t = e.relatedTarget) === 'number') {
                    e.relatedTarget = queue[queue.length + t];
                } else if (t && t.dom) {
                    e.relatedTargetEl = t.$ST ? t : new ST.Element(t.dom);
                }

                // Only use the default eventDelay for actual "events".  Other things
                // in the queue (like functions added by futures) should run as soon
                // as possible
                if (e.delay === undefined && e.type && e.type !== 'wait') {
                    e.delay = me.eventDelay;
                }
                if (e.animation === undefined) {
                    e.animation = me.pauseForAnimations;
                }

                if (!timeout) {
                    // If ST.options.timeout is 0, ignore all timeouts
                    e.timeout = 0;
                } else if (e.timeout === undefined) {
                    if ((e.timeout = me.timeout) === undefined) {
                        e.timeout = timeout;
                    }
                }

                e._player = me;
                e.id = me._nextId++;
                e.state = 'queued';

                queue.push(e);
            }
        }

        if (inserting) {
            // finally we push the events at and beyond "index" onto the new array and
            // update me.events.
            for (; index < length; ++index) {
                queue.push(_events[index]);
            }
            me.events = queue;
        }

        if (me.active && !me.pendingEvent) {
            // If there is a pendingEvent then playNext will eventually be called. We
            // need to call it otherwise, but we must not call it if there is an event
            // pending as events could be played out of order (each trying to play at
            // the same time).
            me.playNext();
        }
    },

    cleanup: function () {
        var me = this,
            eventTimer = me.eventTimer;

        me.pendingEvent = null;
        me.pendingFn = false;

        if (eventTimer) {
            me.eventTimer = 0;
            ST.deferCancel(eventTimer);
        }

        me.events.length = 0;

        if (me.visualFeedback) {
            ST.each(me.gestureIndicators, function (indicator) {
                me.hideGestureIndicator(indicator);
            });
        }
    },

    onStart: function () {
        this.playNext();
    },

    onStop: function () {
        var me = this;

        me.cleanup();

        if (me.visualFeedback) {
            ST.defer(function () {
                me.hidePointer();
            }, 1000);
        }
    },

    pause: function () {
        var me = this,
            eventTimer = me.eventTimer,
            event = me.pendingEvent;

        ++me.paused;

        if (eventTimer) {
            me.eventTimer = 0;
            ST.deferCancel(eventTimer);
        }

        if (event && !me.pendingFn) {
            // Put back the pending event unless we are called from its "fn".
            me.events.unshift(event);
            event.state = 'queued';
            // TODO me.pendingEvent = 0;
        }
    },

    resume: function () {
        var me = this;

        if (me.paused) {
            if (! --me.paused) {
                me.playNext();
            }
        }
    },

    playNext: function () {
        var me = this,
            events = me.events,
            event;

        if (!me.pendingEvent && !me.paused) {
            event = events.shift();

            if (!event) {
                me.onEnd();
            } else {
                me.pendingEvent = event;
                event.state = 'pending';
                me.playEventSoon(event, event.delay || 0);
            }
        }
    },

    playFn: function (event) {
        var me = this,
            // user function can either invoke our "done" function when complete
            // or return a promise.  We will not continue to play events until
            // either the done function is invoked or the promise is resolved.
            watchDog = new ST.WatchDog(function(err) {
                if (!failed) {
                    if (err) {
                        me.doTimeout(event);
                    } else {
                        me.pendingEvent = null;
                        event.state = 'done';
                        me.playNext();
                    }
                }
            }, event.timeout),
            done = watchDog.done,
            failed, promise;

        me.pendingFn = 0;

        if (ST.options.handleExceptions) {
            try {
                promise = event.fn.call(event, done);
            } catch (e) {
                failed = e;
                me.doError(e);
                return;
            }
        } else {
            promise = event.fn.call(event, done);
        }

        me.pendingFn = false;

        // Be sure to set this flag AFTER calling the fn.  This ensures that if the fn
        // itself adds more things to the queue they do not get auto-played, but instead
        // wait until this fn's done() is called.
        me.pendingEvent = null;

        // TODO 
        if (promise && typeof promise.then === 'function') {
            // Return value is "then-able" so it qualifies as a Promise.
            promise.then(done);
        }
        else if (!event.fn.length) {
            // Check the arity (length) of the Function. If it is 0, the function
            // does not declare any arguments so assume it has completed.
            done();
        }
    },

    playEvent: function (event) {
        var me = this,
            now = +new Date(),
            waitStartTime = event.waitStartTime,
            type = event.type,
            visualFeedback = me.visualFeedback,
            timeout = event.timeout,
            target, relatedTarget;

        if (!event.isReady()) {
            if (waitStartTime && timeout && ((now - waitStartTime) >= timeout)) {
                me.doTimeout(event);
            } else {
                // Waiting for some condition to be met before we can proceed
                // such as target element to become available or animations to complete
                // Try again after a brief delay.

                if (!waitStartTime) {
                    // a timestamp as of the time we began waiting (for timeout purposes)
                    event.waitStartTime = +new Date();
                }

                me.playEventSoon(event);
            }
        } else {
            target = event.targetEl;
            relatedTarget = event.relatedEl;

            event.state = 'playing';

            //console.log('Playing', event.id);
            if (event.fn) {
                me.playFn(event);
            } else {
                me.pendingEvent = null;
                type = event.type;

                if (type === 'tap') {
                    me.expandTap(event);
                } else if (type === 'type') {
                    me.expandType(event);
                } else if (event.type && event.type !== 'wait') {
                    me.injector.injectEvent(event, target, relatedTarget);

                    if (me.gestureStartEvents[type]) {
                        me.touchCount++;
                        if (visualFeedback) {
                            me.showGestureIndicator();
                        }
                    } else if (me.gestureEndEvents[type]) {
                        me.touchCount--;
                        if (visualFeedback) {
                            me.hideGestureIndicator();
                        }
                        me.lastGestureEndTime = +new Date();
                    } else if (visualFeedback && type === 'click') {
                        if (((+new Date()) - me.lastGestureEndTime) > 300) {
                            // just in case we are playing a 'click' with no preceding mousedown
                            me.showGestureIndicator();
                            me.hideGestureIndicator(); // will hide once show animation completes
                        }
                    } else if (type === 'keydown') {
                        me.hidePointer();
                    }
                }

                event.state = 'done';

                me.playNext();
            }
        }
    },

    playEventSoon: function (event, delay) {
        var me = this;

        me.eventTimer = ST.defer(function () {
            me.eventTimer = 0;
            me.playEvent(event);
        }, (delay == null) ? me.waitInterval : delay);
    },

    fail: function(message) {
        var me = this;

        if (me.pendingEvent || me.events.length) {
            // When an error occurs we empty all remaining events from the queue.  This
            // does not "stop" the player - if additional events are added they will be
            // automatically played.
            me.cleanup();

            me.fireEvent('error', {
                player: me,
                message: message
            });

            me.onEnd();
        }
    },

    doError: function (err) {
        var message = err.message || err;
        this.fail('Failed with error "' + message + '"');
    },

    doTimeout: function (event) {
        if (event.state !== 'pending' && event.state !== 'playing') {
            return;
        }
        event.state = 'done';

        var s = event.waitingFor || 'event',
            locator = event[s],
            toBe = event.waitingState || 'ready',
            type = event.type,
            src = event,
            dom, sel;

        if (s === 'target' || s === 'relatedTarget') {
            while (src) {
                if (!(locator = src[s])) { // first check "target"
                    // we might have a targetEl, so use its id or tagName
                    locator = src[s + 'El'];
                    dom = locator && locator.dom;
                    break;
                }

                if (locator.isPlayable) {
                    src = locator;  // traverse to the target playable for location
                } else {
                    if (locator.dom) {
                        dom = locator.dom;
                    } else if (typeof locator.nodeType === 'number') {
                        dom = locator;
                    } else {
                        sel = locator.toString(); // handle strings & functions
                    }
                    break;
                }
            }

            if (dom) {
                // we have a targetEl, so use its id or tagName
                sel = dom.id;
                sel = sel ? '#' + sel : dom.tagName;
            }
            if (sel) {
                s += ' (' + sel + ')';
            }
        }

        if (type && typeof type === 'string') {
            toBe += ' for ' + type;
        }

        this.fail('Timeout waiting for ' + s + ' to be ' + toBe);
    },

    expandTap: function (event) {
        var x = event.x,
            y = event.y,
            options = {
                metaKey: event.metaKey,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                button: event.button,
                detail: event.detail
            },
            queue = ST.gestureQueue,
            tapEvents = [];

        // Injecting a "tap" on a OK/Cancel button can result in the button being
        // destroyed (see https://sencha.jira.com/browse/ORION-408). We use relative
        // indexing on the "target" to pull the target through from the initial event
        // so that we don't have to search for it (and fail) on subsequent events.
        tapEvents = [
            { type: 'pointerdown', target: event.target, delay: event.delay, x: x, y: y },
            { type: 'pointerup',   target: -1, delay: 0, x: x, y: y },
            { type: 'click',       target: -2, delay: 0, x: x, y: y },
            // if a gesture queue is set up, we need to add a wait in case the events are asynchronous
            // the wait() will poll for a limited time until expected event is announced
            { type: 'wait',        target: -2, delay: 0, x: x, y: y, ready: this.isTapGestureReady }
        ];

        // Add any modifer keys
        for (i = 0; i < tapEvents.length; i++) {
            ST.applyIf(tapEvents[i], options);
        }

        if (queue) {
            queue.activate();
        }

        this.add(0, tapEvents);
    },

    isTapGestureReady: function () {
        var queue = ST.gestureQueue;

        if (!queue) {
            return true;
        }

        return queue.complete(this.target.id, 'tap');
    },

    onEnd: function () {
        var me = this,
            queue = ST.gestureQueue;

        if (queue) {
            queue.deactivate();
        }

        me.fireEvent('end', me);
    },

    expandType: function (event) {
        var me = this,
            text = event.text,
            key = event.key,
            target = event.targetEl,
            typingDelay = me.typingDelay,
            caret = event.caret,
            cmp, el, fld, events, i, len;

        if (typeof event.target === 'string') {
            cmp = target.getComponent();
            if (cmp && cmp.el.dom === target.dom) {
                // if using classic toolkit, we can use getFocusEl()
                if (ST.isClassic) {
                    el = cmp.getFocusEl();
                }
                // if not classic and the type is a textfield, we can retrieve the input from the component 
                else if (cmp.isXType('textfield')) {
                    fld = cmp.getComponent();
                    el = fld.input || fld.inputElement; // 6.2+ changed input to inputElement
                } 
                // otherwise, just fallback to the el; this will accomodate Sencha Touch, and is the default for 
                // what getFocusEl() returns in the modern toolkit
                else {
                    el = cmp.el || cmp.element;
                }

                if (el) {
                    target = new ST.Element(el.dom);
                }
            }
        }

        if (text) {
            events = [];
            len = text.length;

            for (i = 0; i < len; ++i) {
                key = text.charAt(i);
                events.push(
                    {
                    	type: 'keydown',
                    	target: target,
                    	key: key,
                    	delay: typingDelay
                    },{
                        type: 'keyup',
                        target: target,
                        key: key,
                        delay: 0
                    }
                );
            }
        } else if (key) {
            // special keys
            events = [
                {
                	type: 'keydown',
                	target: target,
                	key: key
            	},{
                    type: 'keyup',
                    target: target,
                    key: key,
                    delay: 0
                }
            ];
        } else {
            // Skip adding an event since there wasn't one, and move on to the next
            me.playNext();
            return;
        }

        events[0].delay = event.delay || me.eventDelay;
        if (caret != null) {
            events[0].caret = caret;
        }
        me.add(0, events);
    },

    onPointChanged: function(x, y) {
        var me = this,
            indicators = me.gestureIndicators,
            indicator;

        if (me.visualFeedback) {
            me.movePointer(x, y);

            if (me.touchCount) {
                // Currently there is no support for multi-touch playback, so we'll just move
                // the most recent indicator around with the mouse pointer.
                // TODO: handle multi-touch
                indicator = indicators[indicators.length - 1];
                me.moveGestureIndicator(indicator, x, y);
            }
        }

        me.x = x;
        me.y = y;
    },

    movePointer: function(x, y) {
        var pointerElement = this.pointerElement;

        if (!pointerElement.parentNode) {
            document.body.appendChild(pointerElement);
        }

        pointerElement.style.display = '';
        pointerElement.style.top = y + 'px';
        pointerElement.style.left = x + 'px';
    },

    hidePointer: function() {
        this.pointerElement.style.display = 'none';
    },

    showGestureIndicator: function() {
        var me = this,
            wrap, inner, indicator;

        if (me.visualFeedback) {
            wrap = document.createElement('div');
            inner = document.createElement('div');

            wrap.appendChild(inner);
            wrap.className = 'orion-gesture-indicator-wrap';
            inner.className = 'orion-gesture-indicator';
            wrap.style.top = me.y + 'px';
            wrap.style.left = me.x + 'px';

            document.body.appendChild(wrap);

            indicator = {
                isAnimatingSize: true,
                wrap: wrap,
                inner: inner
            };

            // css transitions on newly created elements do not work unless we first trigger
            // a repaint.
            inner.offsetWidth;

            inner.className += ' orion-gesture-indicator-on';

            function end() {
                indicator.isAnimatingSize = false;
                inner.removeEventListener('transitionend', end);
            }

            inner.addEventListener('transitionend', end);

            me.gestureIndicators.push(indicator);
        }
    },

    hideGestureIndicator: function(indicator) {
        var me = this,
            indicators = me.gestureIndicators,
            wrap, inner;

        if (!indicator && indicators.length) {
            indicator = indicators[0];
        }

        if (indicator) {
            wrap = indicator.wrap;
            inner = wrap.firstChild;

            ST.Array.remove(indicators, indicator);

            if (indicator.isAnimatingSize) {
                // If the size animation is still underway, wait until it completes
                // to perform the fade animation
                function doneAnimatingSize() {
                    ST.defer(function() {
                        // css transitions do not seem to work properly when run in
                        // immediate succession, hence the need for the slight delay here.
                        me.hideGestureIndicator(indicator);
                    }, 10);
                    inner.removeEventListener('transitionend', doneAnimatingSize);
                }

                inner.addEventListener('transitionend', doneAnimatingSize);
            } else {
                inner.addEventListener('transitionend', function () {
                    // finished fade-out transition - remove from dom
                    if (wrap.parentNode) {
                        document.body.removeChild(wrap);
                    }
                });

                inner.className += ' orion-gesture-indicator-off';
            }

            ST.defer(function() {
                // worst case scenario - transitionend did not fire - cleanup dom
                if (wrap.parentNode) {
                    document.body.removeChild(wrap);
                }
            }, 900);
        }
    },

    moveGestureIndicator: function(indicator, x, y) {
        if (indicator) {
            var wrap = indicator.wrap;

            wrap.style.top = y + 'px';
            wrap.style.left = x + 'px';
        }
    },

    /**
     * @private
     * Applies override to gesture publisher if applicable
     */
    setupGesturePublisher: function () {
        var hasDispatcher = false,
            isAsync = true,
            publisher, gestureInstance;

        if (Ext && Ext.event) {
            hasDispatcher = !!Ext.event.Dispatcher;
            gestureInstance = Ext.event.publisher && Ext.event.publisher.Gesture && Ext.event.publisher.Gesture.instance;

            if (gestureInstance) {
                // 5.1.0+ have a gesture instance, but in 6.2.0, async is no longer a config and events are synchronous
                isAsync = gestureInstance && gestureInstance.getAsync ? gestureInstance.getAsync() : false;
            }

            // 5.0.0+
            if (hasDispatcher) {
                publisher = Ext.event.Dispatcher.getInstance().getPublisher('gesture');
            }
            // 5.1.0-6.0.x; in 6.2.0, events are synchronous
            if (gestureInstance && isAsync) {
                publisher = gestureInstance;
            }
        }

        if (publisher) {
            Ext.override(Ext.event.publisher.Gesture, {
                publish: function (eventName, target, e) {
                    var me = this,
                        queue = me.gestureQueue;

                    if (e.event && e.event.eventId && queue) {
                        queue.add(eventName, e.event.eventId);
                    }

                    me.callParent(arguments);
                }
            });

            // if we have a publisher, set up a gesture queue that we can interrogate later
            publisher.gestureQueue = ST.gestureQueue = new ST.event.GestureQueue(publisher);
        }    
    }
});
