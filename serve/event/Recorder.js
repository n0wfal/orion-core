/**
 * @class ST.event.Recorder
 * @extend ST.event.Driver
 * This class is not created by user code. It is created by the Sencha Test Event Recorder
 * in Sencha Studio via the injected {@link ST#startRecording} method call.
 */
ST.event.Recorder = ST.define({
    extend: ST.event.Driver,

    statics: {
        strategies: [
            new ST.locator.Strategy()
        ]
    },

    /**
     * @event add
     * Fires when events are added to the recording.
     * @param {ST.event.Recorder} this
     * @param {ST.event.Event[]} events
     */

    /**
     * @cfg {Number} scrollThreshold
     * if a "scroll" event occurs within this many milliseconds after a wheel, touchmove,
     * or pointermove with pointerType == 'touch' within the same element, the wheel,
     * touchmove or pointermove event will be removed from the recording.  The scroll event
     * is all we need for playback - playing back both the scroll event and the event that
     * triggered the scroll could cause more scrolling than desired.
     */
    scrollThreshold: 300,

    /**
     * @cfg {Number} throttle
     * Number of milliseconds to use for throttling events (only events contained in
     * `throttledEvents` are eligible for throttling).
     * Set to `0` to disable throttling and add all events to the recording.
     * Only consecutive events of the same type are throttled. This approach ensures
     * consistency when interleaving mousemove/mouseover/mouseout events - for example a
     * mouseout would always be preceded by a mousemove, even if the throttling threshold
     * had not yet been reached.
     */
    throttle: 200,

    /**
     * @cfg {Object} throttledEvents
     * High-frequency events that should be throttled during recording (if `throttle > 0`)
     */
    throttledEvents: {
        mousemove: 1,
        touchmove: 1,
        pointermove: 1,
        MSPointerMove: 1,
        scroll: 1
    },

    /**
     * In browsers that implement pointerevents when a pointerdown is triggered by touching
     * the screen, pointerover and pointerenter events will be fired immmediately before
     * the pointerdown.  When a pointerup is triggered by a touch, pointerout and pointerleave
     * events are fired imediatetely after.
     * We block pointerover, pointerout, pointerenter, and pointerleave, from being recorded
     * when trigered by touch input, since it is not likely the user intended to record these.
     * Note: this only affects events with pointerType === 'touch' or pointerType === 'pen',
     * we do NOT want to block these events when triggered using a mouse.
     * See also:
     *     http://www.w3.org/TR/pointerevents/#the-pointerdown-event
     *     http://www.w3.org/TR/pointerevents/#the-pointerenter-event
     * @private
     */
    blockedPointerEvents: {
        pointerover: 1,
        pointerout: 1,
        pointerenter: 1,
        pointerleave: 1,
        MSPointerOver: 1,
        MSPointerOut: 1,
        MSPointerEnter: 1,
        MSPointerLeave: 1
    },

    /**
     * To ensure we do not miss any events that may have been canceled by user code we want
     * to capture the event at the highest level possible.  Most events can be captured at
     * the window object, but some events must be captured at the document level.
     * @private
     */
    documentEvents: {
        mouseenter: 1,
        mouseleave: 1
    },

    constructor: function (config) {
        var me = this,
            Event = ST.event.Event,
            supports = ST.supports,
            eventMaps = me.eventMaps = [
                Event.clickEvents,
                Event.focusEvents,
                {
                    // We intentionally do not record keypress so as to simplify the output.
                    // When a keydown event is played back, a keypress will be simulated
                    // immediately after.
                    keydown: 1,
                    keyup: 1
                }
            ];

        if (supports.PointerEvents) {
            eventMaps.push(Event.pointerEvents); // IE11/Edge
        } else if (supports.MSPointerEvents) {
            eventMaps.push(Event.msPointerEvents); // IE10
        } else {
            if (supports.TouchEvents) {
                eventMaps.push(Event.touchEvents);
            }
            eventMaps.push(Event.mouseEvents);
        }

        ST.apply(me, config);

        me.clear();
    },

    clear: function () {
        var me = this;
        me.recording = [];
        me.flushIndex = 0;
        me.lastTouchEndTime = me.lastTouchStartX = me.lastTouchStartY = null;
    },

    addListener: function (event) {
        var me = this,
            target = me.documentEvents[event] ? document : window;

        me.listeners.push(ST.Element.on(target, event, 'onEvent', me, true));
    },

    onEvent: function(ev) {
        var me = this,
            type = ev.type,
            isScroll = (type === 'scroll'),
            time, e, touches, touch;

        // Don't process dom scroll event if we already are receiving scroll events
        // from a Ext.scroll.Scroller associated with this element.
        if (!isScroll || !ST.fly(ev.target).getScroller()) {
            time = me.getTimestamp();
            e = me.wrapEvent(ev, time);

            if (!me.isEventBlocked(e, time) && !me.doThrottle(e, time)) {
                me.recording.push(e);

                if (isScroll) {
                    me.clearScrollSource(e);
                    me.flush();
                } else {
                    clearTimeout(me.flushTimeout);
                    me.flushTimeout = setTimeout(function() {
                        me.flush();
                    }, me.scrollThreshold);
                }

                if (type === 'touchstart') {
                    touches = ev.touches;

                    if (touches.length === 1) {
                        // capture the coordinates of the first touchstart event so we can use
                        // them to eliminate duplicate mouse events if needed, (see isEventBlocked).
                        touch = touches[0];
                        me.lastTouchStartX = touch.pageX;
                        me.lastTouchStartY = touch.pageY;
                    }
                } else if (type === 'touchend') {
                    // Capture a time stamp so we can use it to eliminate potential duplicate
                    // emulated mouse events on multi-input devices that have touch events,
                    // e.g. Chrome on Window8 with touch-screen (see isEventBlocked).
                    me.lastTouchEndTime = time;
                }
            }
        }
    },

    flush: function() {
        var me = this,
            recording = me.recording,
            length = recording.length;

        me.fireEvent('add', me, recording.slice(me.flushIndex, length));
        me.flushIndex = length;
        clearTimeout(me.flushTimeout);
        me.flushTimeout = null;
    },

    doThrottle: function(e, time) {
        var me = this,
            throttled = false,
            lastThrottledEvent = me.lastThrottledEvent,
            recording = me.recording,
            throttle = me.throttle,
            type = e.type,
            lastEvent, timeElapsed;

        if (throttle) {
            lastEvent = recording[recording.length - 1];

            if (lastEvent) {
                clearTimeout(me.throttleTimeout);

                if (lastEvent.type === type) {
                    if (me.throttledEvents[type]) {
                        timeElapsed = time - lastEvent.time;

                        if (timeElapsed < throttle) {
                            me.lastThrottledEvent = e;

                            me.throttleTimeout = setTimeout(function() {
                                recording.push(me.lastThrottledEvent);
                                me.lastThrottledEvent = null;
                                if (!me.flushTimeout) {
                                    me.flush();
                                }
                            }, throttle - timeElapsed);

                            throttled = true;
                        }
                    }
                } else if (lastThrottledEvent) {
                    recording.push(lastThrottledEvent);
                    me.lastThrottledEvent = null;
                }
            }
        }

        return throttled;
    },

    onScrollerScroll: function(scroller) {
        var me = this,
            // 5.0 getContainer(), 5.1+ getElement()
            target = (scroller.getContainer ? scroller.getContainer() : scroller.getElement()).dom,
            time = me.getTimestamp(),
            e = me.wrapEvent({
                type: 'scroll',
                target: target
            }, time);

        me.doThrottle(e, time);
        me.recording.push(e);
        me.clearScrollSource(e);
        me.flush();
    },

    wrapEvent: function(e, time) {
        return new ST.event.Event(e, this.locateElement(e.target, e), time);
    },

    /**
     * Removes from the recording the source event(s) that triggered a scroll event
     * @param {ST.event.Event} scrollEvent The scroll event
     * @private
     */
    clearScrollSource: function(scrollEvent) {
        var recording = this.recording,
            i = recording.length,
            scrollTime = scrollEvent.time,
            event;

        while (i--) {
            event = recording[i];
            type = event.type;

            if ((scrollTime - event.time) < this.scrollThreshold) {
                if (((type === 'wheel') ||
                    (ST.event.Event.movementEvents[type] && event.pointerType === 'touch')) &&
                    scrollEvent.target.contains(event.target))
                {
                    recording.splice(i, 1);
                }
            } else {
                break;
            }
        }
    },

    /**
     * Detects if the given event should be blocked from being recorded because it is a
     * emulated "compatibility" mouse event triggered by a touch on the screen, or an
     * emulated pointerover/out/enter/leave triggered by touch screen input.
     * @param {ST.event.Event} e
     * @param {Number} now Current time stamp
     * @return {Boolean}
     * @private
     */
    isEventBlocked: function(e, now) {
        var me = this,
            type = e.type;

        // Firefox emits keypress events even for keys that do not produce a character value.
        // These events always have charCode == 0.  Since no other browser does this
        // we filter these events out of the recording.
        return (type === 'keypress' && (e.charCode === 0)) ||

            // prevent emulated pointerover, pointerout, pointerenter, and pointerleave
            // events from being recorded when triggered by touching the screen.
            (me.blockedPointerEvents[type] && e.pointerType !== 'mouse') ||

            (ST.supports.TouchEvents && ST.event.Event.mouseEvents[type] &&
            // some browsers (e.g. webkit on Windows 8 with touch screen) emulate mouse
            // events after touch events have fired.  This only seems to happen when there
            // is no movement present, so, for example, a touchstart followed immediately
            // by a touchend would result in the following sequence of events:
            // "touchstart, touchend, mousemove, mousedown, mouseup"
            // yes, you read that right, the emulated mousemove fires before mousedown.
            // However, touch events with movement (touchstart, touchmove, then touchend)
            // do not trigger the emulated mouse events.
            // We cannot solve the problem by only listening for touch events and ignoring
            // mouse events, since we may be on a multi-input device that supports both
            // touch and mouse events and we want to record both kinds of events - touch
            // events when touching the screen and mouse event when using the mouse.
            // Instead we have to detect if the mouse event is an emulated mouse event by
            // checking if its coordinates are near the last touchstart's coordinates,
            // and if it's timestamp is within a certain threshold of the last touchend
            // event's timestamp.  This is because when dealing with multi-touch events,
            // the emulated mousedown event (when it does fire) will fire with approximately
            // the same coordinates as the first touchstart, but within a short time after
            // the last touchend.  We use 15px as the distance threshold, to be on the safe
            // side because the observed difference in coordinates can sometimes be up to 6px.
            Math.abs(e.pageX - me.lastTouchStartX) < 15 &&
            Math.abs(e.pageY - me.lastTouchStartY) < 15 &&

            // In the majority of cases, the emulated mousedown occurs within 5ms of
            // touchend, however, to be certain we eliminate the emulated mouse event from
            // the recording we use a threshold of 1000ms.  The side effect of this is that
            // if a user touches the screen and then quickly clicks screen in the same spot,
            // the mouse events from the click will not be recorded.
            (now - me.lastTouchEndTime) < 1000);
    },

    onStart: function () {
        var me = this,
            scrollerProto = me.getScrollerProto(),
            scrollerFireEvent, scrollerFireScroll, event;

        me.listeners = [];

        ST.each(me.eventMaps, function(events) {
            for (event in events) {
                me.addListener(event);
            }
        });

        // The standard event is "wheel" - fall back to "mousewheel" where not supported
        me.addListener(ST.supports.Wheel ? 'wheel' : 'mousewheel');

        if (scrollerProto) {
            // If using a version of Ext that has a Ext.scroll.Scroller class (5.0+)
            // intercept the Scroller's scroll event to capture cross-platform
            // scroll events.  We use a couple different techniques here depending on version
            // but we can't just listen to the use the global 'scroll' event because that
            // was not introduced until version 5.1.1

            if (scrollerProto.fireScroll) {
                // 5.1.0+ only fires the scroll event from a fireScroll method
                scrollerFireScroll = me.scrollerFireScroll = scrollerProto.fireScroll;
                scrollerProto.fireScroll = function(x, y) {
                    me.onScrollerScroll(this, x, y);
                    scrollerFireScroll.apply(this, arguments);
                }
            } else {
                // 5.0.0/5.0.1 fires the scroll event from several different spots.
                // fortunately none of these have a check for hasListeners, so we can
                // just intercept fireEvent
                scrollerFireEvent = me.scrollerFireEvent = scrollerProto.fireEvent;
                scrollerProto.fireEvent = function (eventName, scroller, x, y) {
                    if (eventName === 'scroll') {
                        me.onScrollerScroll(scroller, x, y);
                    }
                    scrollerFireEvent.apply(scroller, arguments);
                };
            }
        }

        // We always listen for dom scroll events.  This covers Ext < 5.0, or non-ext apps
        // where Ext.scroll.Scroller is not present as well as Ext 5+ apps where an element
        // is scrolled without an attached scroller (plain old overflow:auto)
        // In case we get duplicate scroll events, both from Ext.scroll.DomScroller and
        // from this scroll listener we will filter out the duplicate (see onEvent).
        me.addListener('scroll');
    },

    onStop: function () {
        var me = this,
            scrollerProto = me.getScrollerProto();

        ST.each(me.listeners, function(listener) {
            listener.destroy();
        });

        me.listeners = null;

        if (scrollerProto) {
            // undo the changes to Ext.scroll.Scroller.prototype done by onStart()
            if (scrollerProto.fireScroll) {
                scrollerProto.fireScroll = me.scrollerFireScroll;
                me.scrollerFireScroll = null;
            } else {
                scrollerProto.fireEvent = me.scrollerFireEvent;
                me.scrollerFireEvent = null;
            }
        }
    },

    getScrollerProto: function() {
        var Ext = window.Ext,
            scroll = Ext && Ext.scroll,
            Scroller = scroll && scroll.Scroller;

        return Scroller && Scroller.prototype;
    },


    locateElement: function(element, ev) {
        var targets = [],
            strategies = this.self.strategies,
            strategy, l;

        for (l = 0; l < strategies.length; l++) {
            strategy = strategies[l];
            strategy.locate(element, targets, ev);
        }

        return targets;
    }
});

/**
 * Registers a locator strategy for recording target locators. A locator strategy
 * implements a {@link ST.locator.Strategy#locate locate} method. If the `locator`
 * parameter is a function, it is treated as an implementation of such a method.
 *
 * For example:
 *
 *      ST.addLocatorStrategy(function (el, targets) {
 *          if (el.id) {
 *              targets.push('>> #' + el.id);
 *          }
 *      });
 *
 * The above locator strategy is not very useful, but illustrates the process
 * of adding new strategies.
 *
 * @method addLocatorStrategy
 * @member ST
 * @param {ST.locator.Strategy/Function} strategy
 */
ST.addLocatorStrategy = function (strategy) {
    if (typeof strategy === 'function') {
        var fn = strategy;

        strategy = new ST.locator.Strategy();
        strategy.locate = fn;
    }

    ST.event.Recorder.strategies.push(strategy);
};

/**
 * Replaces the locator strategies with those provided to this call. For details on
 * locator strategy see {@link #addLocatorStrategy}.
 *
 * The following call would produce the default strategies:
 *
 *      ST.setLocatorStrategies(
 *          new ST.locator.Strategy()
 *      );
 *
 * This method is used to control the presence and order of locator strategies. The order
 * is important to the `ST.event.Recorder` because the first locator strategy to produce
 * an element locator determines the default event {@link ST.event.Playable#target target}
 * and/or {@link ST.event.Playable#relatedTarget relatedTarget}.
 *
 * @method setLocatorStrategies
 * @member ST
 * @param {ST.locator.Strategy/Function} strategy
 */
ST.setLocatorStrategies = function () {
    ST.event.Recorder.strategies.length = 0;

    ST.each(arguments, ST.addLocatorStrategy);
};
