(function() {
    var idSeed = 0,
        timerFns = {}, // [id] = { scope: {}, fn: function() {} }
        timerWorker,
        bind = function (fn, scope) {
            return function () {
                return fn.apply(scope, arguments);
            };
        },
        clear = function (nativeFn, type, id) {
            if (id) {
                if (timerWorker) {
                    timerWorker.postMessage({
                        type: type,
                        id: id
                    });
                    delete timerFns[id];
                } else {
                    nativeFn(id);
                }
            }
        },
        set = function (nativeFn, type, fn, scope, delay) {
            var id;

            if (typeof scope === 'number') {
                delay = scope;
                scope = null;
            }

            if (timerWorker) {
                id = ++idSeed;
                if (id === Number.MAX_VALUE) {
                    id = idSeed = 1;
                }

                timerFns[id] = {
                    fn: fn,
                    scope: scope
                };

                timerWorker.postMessage({
                    type: type,
                    delay: delay,
                    id: id
                });
            } else {
                if (scope) {
                    fn = fn.bind ? fn.bind(scope) : bind(fn, scope);
                }

                id = nativeFn(fn, delay);
            }

            return id;
        };

    if (window.Worker) {
        timerWorker = new Worker('/~orion/files/event/timer-worker.js');

        timerWorker.onmessage = function(e) {
            var message = e.data,
                id = message.id,
                entry = timerFns[id];

            if (entry) {
                // timer may have already been cancelled while we were waiting to receive
                // a message from the worker thread
                if (entry.scope) {
                    entry.fn.call(entry.scope);
                } else {
                    entry.fn();
                }

                if (message.type === 'setTimeout') {
                    delete timerFns[id];
                }
            }
        };
    }

    /**
     * Similar to `setTimeout` and `Ext.defer` this method schedules a call to the given
     * method after the given `delay` and returns an id that can be used to cancel the
     * request.
     *
     * To cancel a timeout, call {@link ST#deferCancel}. Do not pass these id's to the
     * DOM.
     *
     * ### Note
     *
     * In some modern browsers (currently FF and Chrome timeouts are clamped to >= 1000ms for
     * inactive tabs.
     * https://developer.mozilla.org/en-US/docs/Web/API/WindowTimers/setTimeout#Timeouts_in_inactive_tabs_clamped_to_>1000ms
     *
     * This can result in much larger delays than expected when playing back recorded events
     * since the Event Player is not guaranteed to be run in an active tab/window.
     *
     * This class leverages Web Workers to emulate the browser's setTimeout and setInterval
     * functionality without the undesirable clamping in incative tabs.
     *
     * Falls back to window.setTimeout/setInterval where Web Workers are not available.
     * @param {Function} fn The function to call after `delay` milliseconds.
     * @param {Object} [scope] The `this` pointer to use for calling `fn`.
     * @param {Number} delay The number of milliseconds to delay before calling `fn`.
     * @method defer
     * @member ST
     */
    ST.defer = function (fn, scope, delay) {
        return set(setTimeout, 'setTimeout', fn, scope, delay);
    };

    /**
     * Cancels an operation requested using {@link ST#defer}.
     * @param id
     * @method deferCancel
     * @member ST
     */
    ST.deferCancel = function (id) {
        clear(clearTimeout, 'clearTimeout', id);
    };

    ST.interval = function (fn, scope, delay) {
        return set(setInterval, 'setInterval', fn, scope, delay);
    };

    ST.intervalCancel = function (id) {
        clear(clearInterval, 'clearInterval', id);
    };
})();
