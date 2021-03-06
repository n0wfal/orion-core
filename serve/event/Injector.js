/**
 * This class is used internally to inject synthetic DOM events.
 * @class ST.event.Injector
 * @private
 */
ST.event.Injector = ST.define({
    /**
     * @cfg {Boolean} translate
     * `false` to disable event translation.  If `false` events that are not supported by
     * the browser's event APIs will simply be skipped.
     */
    translate: true,

    constructor: function(config) {
        ST.apply(this, config);
    },

    /**
     * Injects a synthetic event
     * @param {Object/String} event The event type or descriptor
     * @param {ST.Element/HTMLElement} target
     * @param {ST.Element/HTMLElement} relatedTarget
     */
    injectEvent: function(event, target, relatedTarget) {
        if (typeof event === 'string') {
            event = { type: event };
        }
        var me = this,
            Event = ST.event.Event,
            supports = ST.supports,
            supportsPointer = supports.PointerEvents,
            supportsMSPointer = supports.MSPointerEvents,
            supportsTouch = supports.TouchEvents,
            doDefaultAction = true,
            type = event.type,
            isMouseEvent = Event.mouseEvents[type],
            pointerType = event.pointerType,
            isWebKitDesktop = ST.isWebKit && ST.os.is.Desktop,
            translatedEvent, isMouse, keypress;

        target = target || event.target;
        relatedTarget = relatedTarget || event.relatedTarget;

        if (target && target.dom) {
            target = target.dom;
        }

        if (relatedTarget && relatedTarget.dom) {
            relatedTarget = relatedTarget.dom;
        }

        if (Event.keyEvents[type]) {
            doDefaultAction = me.fireKeyEvent(event, target) && doDefaultAction;
            if (type === 'keydown') {
                // Event recordings do not include keypress events, so as to simplify
                // the output for the user.  To match real-world browser behavior we
                // simulate a keypress after all keydown events during playback.
                keypress = ST.chain(event);
                keypress.type = 'keypress';
                doDefaultAction = me.fireKeyEvent(keypress, target) && doDefaultAction;
            }
        } else if (event.translate === false || me.translate === false) {
            if (isMouseEvent || Event.clickEvents[type]) {
                doDefaultAction = me.fireMouseEvent(event, target, relatedTarget) && doDefaultAction;
            } else if (Event.pointerEvents[type]) {
                // The recorder always translates MS-prefixed pointer events to regular pointer
                // events, so we must always translate back, event if "translate" is false
                if (supportsMSPointer && !supportsPointer) {
                    event = me.translateEvent(event, Event.pointerToMS);
                }
                doDefaultAction = me.firePointerEvent(event, target, relatedTarget) && doDefaultAction;
            } else if (Event.touchEvents[type]) {
                doDefaultAction = me.fireTouchEvent(event, target) && doDefaultAction;
            }
        } else if (isMouseEvent || Event.clickEvents[type]) {
            if (supportsPointer || supportsMSPointer) {
                translatedEvent = me.translateEvent(event, Event.mouseToPointer);

                if (translatedEvent && !supportsPointer) {
                    translatedEvent = me.translateEvent(translatedEvent, Event.pointerToMS);
                }

                if (translatedEvent) {
                    doDefaultAction = me.firePointerEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }
            }

            if (supportsTouch && !isWebKitDesktop) {
                translatedEvent = me.translateEvent(event, Event.mouseToTouch);

                if (translatedEvent) {
                    doDefaultAction = me.fireTouchEvent(translatedEvent, target) && doDefaultAction;
                }
            } else {
                doDefaultAction = me.fireMouseEvent(event, target, relatedTarget) && doDefaultAction;
            }
        } else if (Event.pointerEvents[type]) {
            // Note we only need to check for pointerEvents because recording never contains
            // MS-prefixed pointer events - those are translated into regular pointer events
            // by the recorder
            if (supportsPointer) {
                doDefaultAction = me.firePointerEvent(event, target, relatedTarget) && doDefaultAction;
            } else if (supportsMSPointer) {
                translatedEvent = me.translateEvent(event, Event.pointerToMS);

                if (translatedEvent) {
                    doDefaultAction = me.firePointerEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }
            }

            if (supportsTouch) {
                isMouse = !pointerType || (pointerType === 'mouse');

                if (isMouse && isWebKitDesktop) {
                    translatedEvent = me.translateEvent(event, Event.pointerToMouse);
                    if (translatedEvent) {
                        doDefaultAction = me.fireMouseEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                    }
                } else {
                    translatedEvent = me.translateEvent(event, Event.pointerToTouch);
                    if (translatedEvent) {
                        doDefaultAction = me.fireTouchEvent(translatedEvent, target) && doDefaultAction;
                    }
                }
            } else {
                translatedEvent = me.translateEvent(event, Event.pointerToMouse);

                if (translatedEvent) {
                    doDefaultAction = me.fireMouseEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }
            }
        } else if (Event.touchEvents[type]) {
            if (supportsPointer || supportsMSPointer) {
                translatedEvent = me.translateEvent(event, Event.touchToPointer, { pointerType: 'touch' });

                if (!supportsPointer) {
                    translatedEvent = me.translateEvent(translatedEvent, Event.pointerToMS);
                }

                if (translatedEvent) {
                    doDefaultAction = me.firePointerEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }

                translatedEvent = me.translateEvent(event, Event.touchToMouse);

                if (translatedEvent) {
                    doDefaultAction = me.fireMouseEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }
            } else if (supportsTouch) {
                doDefaultAction = me.fireTouchEvent(event, target) && doDefaultAction;
            } else {
                translatedEvent = me.translateEvent(event, Event.touchToMouse);

                if (translatedEvent) {
                    doDefaultAction = me.fireMouseEvent(translatedEvent, target, relatedTarget) && doDefaultAction;
                }
            }
        }

        if (doDefaultAction) {
            me.defaultAction(event, target);
        }
    },

    translateEvent: function(event, translationMap, props) {
        var type = translationMap[event.type],
            translatedEvent = null;

        if (type) {
            translatedEvent = ST.chain(event);
            translatedEvent.type = type;
            if (props) {
                ST.apply(translatedEvent, props);
            }
        }

        return translatedEvent;
    },

    fireMouseEvent: function (event, target, relatedTarget) {
        var me = this,
            Event = ST.event.Event,
            type = event.type,
            bubbles = true,
            cancelable = true,
            coordinates = me.getCoordinates(event, target),
            pageX = coordinates.pageX,
            pageY = coordinates.pageY,
            clientX = coordinates.clientX,
            clientY = coordinates.clientY,
            ctrlKey = !!event.ctrlKey,
            shiftKey = !!event.shiftKey,
            altKey = !!event.altKey,
            metaKey = !!event.metaKey,
            detail = event.detail || (Event.detailEvents[type] ? 1 : 0),
            button = event.button,
            buttons = event.buttons,
            doc = target.ownerDocument || document,
            view = doc.defaultView || doc.parentWindow,
            movementX = event.movementX,
            movementY = event.movementY,
            lastMouseMove = me.lastMouseMove,
            dispatchTarget = me.getDispatchTarget(target, clientX, clientY),
            ret = true,
            e, docEl, body;

        relatedTarget = relatedTarget || null;

        if (button == null && buttons != null) {
            button = Event.buttonsToButton[buttons];
        }

        if (buttons == null && button != null) {
            buttons = Event.buttonToButtons[button];
        }

        if (movementX == null) {
            movementX = lastMouseMove ? (clientX - lastMouseMove.clientX) : 0
        }

        if (movementY == null) {
            movementY = lastMouseMove ? (clientY - lastMouseMove.clientY) : 0
        }

        button = button || 0;
        buttons = buttons || (type === 'mousedown' ? 1 : 0);

        if (me.player) {
            me.player.onPointChanged(pageX, pageY);
        }

        if (ST.supports.EventConstructors) {
            e = new MouseEvent(type, {
                bubbles: bubbles,
                cancelable: cancelable,
                view: view,
                detail: detail,
                screenX: pageX,
                screenY: pageY,
                clientX: clientX,
                clientY: clientY,
                ctrlKey: ctrlKey,
                shiftKey: shiftKey,
                altKey: altKey,
                metaKey: metaKey,
                button: button,
                buttons: buttons,
                relatedTarget: relatedTarget,
                movementX: movementX,
                movementY: movementY
            });

            e.eventId = event.id;

            // Safari has a bug where the buttons property is not set even though we passed
            // it to the constructor.
            if (e.buttons == null) {
                e.buttons = buttons;
            }

            // Safari does not yet support movementX/Y via MouseEvent constructor
            if (e.movementX == null) {
                e.movementX = movementX;
            }
            if (e.movementY == null) {
                e.movementY = movementY;
            }

            ret = dispatchTarget.dispatchEvent(e);
        } else if (ST.isIE9m && doc.createEventObject) {
            // IE8 and IE9.
            // Although IE9 supports the newer event model (addEventListener and createEvent)
            // events created using createEvent/initMouseEvent in IE9 do not have the correct
            // pageX and pageY (always 0).  Because of issues such as this Ext JS has historically
            // used the older event model in IE9 for listening to events.  Listeners must
            // use the same event system as that which was used to fire the event, for
            // example, an event fired using fireEvent cannot be listened to using
            // addEventListener.  This means the event player must follow the framework
            // and use the old event model in IE9.
            // TODO: could we fire an additional event using the new event model for non-ext apps?
            e = doc.createEventObject();
            docEl = doc.documentElement;
            body = doc.body;
            pageX = pageX + (docEl && docEl.clientLeft || 0) + (body && body.clientLeft || 0);
            pageY = pageY + (docEl && docEl.clientTop || 0) + (body && body.clientLeft || 0);
            ST.apply(e, {
                bubbles: bubbles,
                cancelable: cancelable,
                screenX: pageX,
                screenY: pageY,
                clientX: clientX,
                clientY: clientY,
                // in the old IE event model "button" is a bit mask like the new standard
                // "buttons" property
                button: buttons,
                shiftKey: shiftKey,
                ctrlKey: ctrlKey,
                altKey: altKey,
                eventId: event.id
                // TODO: toElement and fromElement?
            });

            dispatchTarget.fireEvent('on' + type, e);
            ret = e.returnValue !== false;
        } else if (doc.createEvent) {
            e = doc.createEvent("MouseEvents");

            e.initMouseEvent(
                type,
                bubbles,
                cancelable,
                view,
                detail,
                pageX,
                pageY,
                clientX,
                clientY,
                ctrlKey,
                altKey,
                shiftKey,
                metaKey,
                button,
                relatedTarget
            );

            e.eventId = event.id;

            ret = dispatchTarget.dispatchEvent(e);
        } else {
            console.warn('Cannot play "' + type + '".  Browser does not support this type of event.');
        }

        if (type === 'mousemove') {
            me.lastMouseMove = e;
        }

        return ret;
    },

    firePointerEvent: function (event, target, relatedTarget) {
        if (!ST.PointerEvents && !ST.supports.MSPointerEvents) {
            console.warn('Cannot play "' + event.type + '".  Browser does not support this type of event.');
        }

        var me = this,
            Event = ST.event.Event,
            type = event.type,
            bubbles = true,
            cancelable = true,
            coordinates = me.getCoordinates(event, target),
            pageX = coordinates.pageX,
            pageY = coordinates.pageY,
            clientX = coordinates.clientX,
            clientY = coordinates.clientY,
            ctrlKey = !!event.ctrlKey,
            shiftKey = !!event.shiftKey,
            altKey = !!event.altKey,
            metaKey = !!event.metaKey,
            detail = event.detail || (Event.detailEvents[type] ? 1 : 0),
            button = event.button,
            buttons = event.buttons,
            doc = target.ownerDocument || document,
            view = doc.defaultView || doc.parentWindow,
            movementX = event.movementX,
            movementY = event.movementY,
            lastMouseMove = me.lastMouseMove,
            pointerId = event.pointerId || 1,
            width = event.width || 1,
            height = event.height || 1,
            pressure = event.pressure,
            tiltX = event.tiltX || 0,
            tiltY = event.tiltY || 0,
            pointerType = event.pointerType || 'mouse',
            isPrimary = event.isPrimary,
            dispatchTarget = me.getDispatchTarget(target, clientX, clientY),
            ret = true,
            e;

        relatedTarget = relatedTarget || null;

        if (button == null && buttons != null) {
            button = Event.buttonsToButton[buttons];
        }

        if (buttons == null && button != null) {
            buttons = Event.buttonToButtons[button];
        }

        if (pressure == null) {
            pressure = buttons ? 0.5 : 0;
        }

        if (movementX == null) {
            movementX = lastMouseMove ? (clientX - lastMouseMove.clientX) : 0
        }

        if (movementY == null) {
            movementY = lastMouseMove ? (clientY - lastMouseMove.clientY) : 0
        }

        if (isPrimary == null) {
            isPrimary = true;
        }

        button = button || 0;
        buttons = buttons || (type === 'pointerdown' ? 1 : 0);

        if (!ST.supports.PointerEvents) {
            // IE10 - translate pointerType to number
            pointerType = Event.msPointerTypes[pointerType];
        }

        if (me.player) {
            me.player.onPointChanged(pageX, pageY);
        }

        if (ST.supports.EventConstructors) {
            e = new PointerEvent(type, {
                bubbles: bubbles,
                cancelable: cancelable,
                view: view,
                detail: detail,
                screenX: pageX,
                screenY: pageY,
                clientX: clientX,
                clientY: clientY,
                ctrlKey: ctrlKey,
                shiftKey: shiftKey,
                altKey: altKey,
                metaKey: metaKey,
                button: button,
                buttons: buttons,
                relatedTarget: relatedTarget,
                movementX: movementX,
                movementY: movementY,
                pointerId: pointerId,
                width: width,
                height: height,
                pressure: pressure,
                tiltX: tiltX,
                tiltY: tiltY,
                pointerType: pointerType,
                isPrimary: isPrimary
            });

            e.eventId = event.id;

            ret = dispatchTarget.dispatchEvent(e);
        } else if (doc.createEvent) {
            // If the browser supports pointer events but does not support the PointerEvents
            // constructor we have to fake it by constructing a mouse event a setting
            // the extra pointer event properties on the event object after initialization.
            e = doc.createEvent("MouseEvents");

            e.initMouseEvent(
                type,
                bubbles,
                cancelable,
                view,
                detail,
                pageX,
                pageY,
                clientX,
                clientY,
                ctrlKey,
                altKey,
                shiftKey,
                metaKey,
                button,
                relatedTarget
            );

            e.pointerId = pointerId;
            e.width = width;
            e.height = height;
            e.pressure = pressure;
            e.tiltX = tiltX;
            e.tiltY = tiltY;
            e.pointerType = pointerType;
            e.isPrimary = isPrimary;
            e.eventId = event.id;

            ret = dispatchTarget.dispatchEvent(e);
        }

        return ret;
    },

    fireTouchEvent: function(event, target) {
        if (!ST.supports.TouchEvents) {
            console.warn('Cannot play "' + event.type + '".  Browser does not support this type of event.');
        }

        // TODO: ORION-42 - support multi-touch recording

        var me = this,
            type = event.type,
            coordinates = me.getCoordinates(event, target),
            pageX = coordinates.pageX,
            pageY = coordinates.pageY,
            clientX = coordinates.clientX,
            clientY = coordinates.clientY,
            ctrlKey = !!event.ctrlKey,
            shiftKey = !!event.shiftKey,
            altKey = !!event.altKey,
            metaKey = !!event.metaKey,
            dispatchTarget = me.getDispatchTarget(target, clientX, clientY),
            touches = me.createTouchList([{
                pageX: pageX,
                pageY: pageY,
                clientX: clientX,
                clientY: clientY,
                identifier: event.pointerId || 1,
                target: dispatchTarget
            }]),
            targetTouches = touches,
            changedTouches = touches,
        // It doesn't appear to be possible to set touches, changedTouches targetTouches
        // on a "real" TouchEvent, initTouchEvent seems to ignore those parameters:
        // Directly assigning to e.touches after creating a TouchEvent doesn't work
        // either so the best we can do is just make a CustomEvent and fake it.
            e = new CustomEvent(type, {
                bubbles: true,
                cancelable: true,
                detail: 0
            });

        if (me.player) {
            me.player.onPointChanged(pageX, pageY);
        }

        ST.apply(e, {
            ctrlKey: ctrlKey,
            altKey: altKey,
            shiftKey: shiftKey,
            metaKey: metaKey,
            touches: touches,
            targetTouches: targetTouches,
            changedTouches: changedTouches,
            eventId: event.id
        });

        return dispatchTarget.dispatchEvent(e);
    },

    createTouchList: function(touchList, target) {
        var doc = document,
            ln = touchList.length,
            touches = [],
            touchCfg, i;

        for (i = 0; i < ln; i++) {
            touchCfg = touchList[i];
            touches.push(doc.createTouch(
                doc.defaultView || doc.parentWindow,
                touchCfg.target || target,
                // use 1 as the default ID, so that tests that are only concerned with a single
                // touch event don't need to worry about providing an ID
                touchCfg.identifier || 1,
                touchCfg.pageX,
                touchCfg.pageY,
                touchCfg.screenX || touchCfg.pageX, // use pageX/Y as the default for screenXY
                touchCfg.screenY || touchCfg.pageY
            ));
        }

        return doc.createTouchList.apply(doc, touches);
    },

    fireKeyEvent: function(event, target)  {
        var type = event.type,
            bubbles = true,
            cancelable = true,
            key = event.key || '',
            code = event.code || '',
            charCode = event.charCode || 0,
            keyCode = event.keyCode || 0,
            ctrlKey = !!event.ctrlKey,
            shiftKey = !!event.shiftKey,
            altKey = !!event.altKey,
            metaKey = !!event.metaKey,
            caret = event.caret,
            doc = target.ownerDocument || document,
            view = doc.defaultView || doc.parentWindow,
            isKeypress = (type === 'keypress'),
            KeyMap = ST.KeyMap,
            activeElement = document.activeElement,
            ret = true,
            e, error;

        if (!key) {
            if (keyCode) {
                key = KeyMap.lookupKey(keyCode);
            } else if (!isKeypress) {
                error = 'Cannot play ' + type + ' event without either a "key" or "keyCode" property.'
            }

            if (!key && !charCode && isKeypress) {
                error = 'Cannot play keypress event without either a "key" or "charCode" property.'
            }

            if (error) {
                this.error(error);
                return;
            }
        }

        if (key in KeyMap.reverseShiftKeys) {
            shiftKey = true;
        }

        if (isKeypress) {
            if (!charCode) {
                if (key.length === 1) {
                    charCode = key.charCodeAt(0);
                } else {
                    charCode = KeyMap.lookupKeyCode(key);
                }
            }

            if (!keyCode) {
                keyCode = charCode;
            }
        } else if (!keyCode) {
            keyCode = KeyMap.lookupKeyCode(key);
        }

        if (target !== activeElement) {
            target.focus();
        }

        if (caret != null) {
            ST.fly(target).setCaret(caret);
        }

        if (ST.supports.KeyboardEventConstructor) {
            e = new KeyboardEvent(type, {
                bubbles: bubbles,
                cancelable: cancelable,
                view: view,
                detail: 0,
                key: key,
                code: code,
                //location: ?
                ctrlKey: ctrlKey,
                shiftKey: shiftKey,
                altKey: altKey,
                metaKey: metaKey,
                //repeat: ?
                //isComposing: ?
                charCode: charCode,
                keyCode: keyCode
                //which: ?
            });

            ret = target.dispatchEvent(e);
        } else if (ST.isIE9m && doc.createEventObject) {
            e = doc.createEventObject();
            ST.apply(e, {
                bubbles: bubbles,
                cancelable: bubbles,
                key: key,
                code: code,
                ctrlKey: ctrlKey,
                shiftKey: shiftKey,
                altKey: altKey,
                metaKey: metaKey,
                charCode: charCode,
                keyCode: keyCode
            });
            target.fireEvent('on' + type, e);
            ret = e.returnValue !== false;
        } else {
            e = doc.createEvent("Events");
            e.initEvent(type, bubbles, cancelable);
            ST.apply(e, {
                key: key,
                code: code,
                ctrlKey: ctrlKey,
                shiftKey: shiftKey,
                altKey: altKey,
                metaKey: metaKey,
                charCode: charCode,
                keyCode: keyCode
            });
            ret = target.dispatchEvent(e);
        }

        return ret;
    },

    fireInputEvent: function(target) {
        var e;
        if (!ST.isIE9m) {
            e = document.createEvent("Events");
            e.initEvent('input', true, false);
            return target.dispatchEvent(e);
        }
    },

    /**
     * To more accurately simulate real browser behavior, use the element at clientXY
     * as the dispatch target and rely on bubbling for the event to reach the target.
     * @param {HTMLElement} target
     * @param {Number} clientX
     * @param {Number} clientY
     */
    getDispatchTarget: function(target, clientX, clientY) {
        var dispatchTarget = document.elementFromPoint(clientX, clientY);

        if (!dispatchTarget || !ST.fly(target).contains(dispatchTarget)) {
            // If element at clientXY is not a descendant of the target (or the target itself)
            // then ignore it and just dispatch to the target.
            dispatchTarget = target;
        }

        return dispatchTarget;
    },

    /**
     * Given an event descriptor with target-relative x and y coordinates, calculates
     * "page" and "client" coordinates required for event dispatching.
     * If the event descriptor is missing either x or y coordinate, a default coordinate
     * at the center of the target element will be calculated.
     * @param {Object} event The event descriptor
     * @param {HTMLElement} target The event target
     * @return {Object} The coordinates
     * @return {Number} return.pageX
     * @return {Number} return.pageY
     * @return {Number} return.clientX
     * @return {Number} return.clientY
     */
    getCoordinates: function(event, target) {
        var origin = ST.fly(target).getXY(),
            pageScroll = ST.fly(document).getScroll(),
            x = event.x,
            y = event.y,
            pageX, pageY;

        if (x == null) {
            x = target.offsetWidth / 2;
        }

        if (y == null) {
            y = target.offsetHeight / 2;
        }

        pageX = origin[0] + x;
        pageY = origin[1] + y;

        return {
            pageX: pageX,
            pageY: pageY,
            clientX: pageX - pageScroll.x,
            clientY: pageY - pageScroll.y
        };
    },

    /**
     * When firing synthetic events browsers to not always fire the default action of those
     * events (for example a synthetic mousedown does not trigger focus).
     * This method is invoked after every event to mimic the default action for applicable events.
     * @param {Object} event The event descriptor
     * @param {HTMLElement} target
     * @private
     */
    defaultAction: function(event, target) {
        var me = this,
            type = event.type,
            activeElement = document.activeElement,
            key, keyCode, contentEditable,
            text, caret,
            backspacedText, deletedText, typedText;

        if (type === 'mousedown' || type === 'pointerdown') {
            // TODO: skip this if the recording contains a focus event?
            target.focus();
            if (activeElement && (activeElement !== target)) {
                /**
                 * target was not a focusable element, throw focus back to the body
                 *
                 * Cannot execute blur on activeElement as it won't have relatedTarget
                 * which Ext JS checks for
                 */
                document.body.focus();
            }
        } else if (type === 'click') {
            if (target.tagName === 'A' && location.href !== target.href) {
                // IE8 and old firefox do not navigate on synthetic click
                //location.href = target.href;
            }
        } else if (type === 'keydown' && ST.fly(target).isUserEditable()) {
            caret = ST.fly(target).getCaret();
            contentEditable = target.contentEditable;

            if (contentEditable === '' || contentEditable === 'true') {
                text = target.innerHTML;
            } else {
                text = target.value;
            }

            // Simulate typing. If key changes value fire an input event
            key = event.key;
            keyCode = event.keyCode;

            if (!key && keyCode) {
                key = ST.KeyMap.lookupKey(keyCode);
            }

            // Backspace and Delete
            if (key === 'Backspace') {
                typedText = text.substr(0, caret[0]-1) + text.substr(caret[0], text.length);
                me.updateFieldValue(target, typedText);
                ST.fly(target).setCaret([caret[0]-1, caret[0]-1]);
            } else if (key === 'Delete') {
                typedText = text.substr(0, caret[0]) + text.substr(caret[0]+1, text.length);
                me.updateFieldValue(target, typedText);
                ST.fly(target).setCaret(caret);
            } else if (key && key.length === 1) {
                if (caret[0] == 0 && caret[1] == 0) {
                    typedText = key + text;
                } else {
                    typedText = text.substr(0, caret[0]) + key + text.substr(caret[1], text.length);
                }
                me.updateFieldValue(target, typedText);
                ST.fly(target).setCaret([caret[0]+1, caret[1]+1]);
            }
            me.fireInputEvent(target);
        }
    },

    updateFieldValue: function(target, value) {
        var contentEditable;
        if (contentEditable === '' || contentEditable === 'true') {
            target.innerHTML = value;
        } else {
            target.value = value;
        }
    },

    error: function(message) {
        var player = this.player;

        if (player) {
            player.fireEvent('error', player, message);
        } else {
            throw message;
        }
    }
});
