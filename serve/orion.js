(function() {
    ST.parseQuery = function (query) {
        var paramRe = /([^&=]+)=?([^&]*)/g,
            plusRe = /\+/g,  // Regex for replacing addition symbol with a space
            ret = {},
            match, key, val, was;

        while (match = paramRe.exec(query)) {
            key = decodeURIComponent(match[1].replace(plusRe, ' '));
            val = decodeURIComponent(match[2].replace(plusRe, ' '));
            was = ret[key];

            if (typeof was === 'string') {
                val = [was, val];
            }
            else if (was) {
                was.push(val);
                continue;
            }

            ret[key] = val;  // a String (for one value) or String[] for multiple
        }

        return ret;
    };

    var messages = [],
        EMPTY = [], // reusable, readonly empty array
        seq = 0,
        callbacks = {},
        registerUrl = '/~orion/register?_dc=',
        messagesUrl = '/~orion/messages?_dc=',
        updatesUrl = '/~orion/updates?_dc=',
        handshakeComplete = false,
        isTestRunStarted = false,
        _updatesPending = false,
        controllers = [],
        maxRetries = 3,
        retryCount = 0,
        retryPending = false,
        terminated = false,
        hasError = false,
        urlParams = (ST.urlParams = ST.parseQuery(top.location.search.substring(1))),
        startingUrl = location.href,
        sessionStorage = window.sessionStorage,
        nonSpaceRe = /\S/,
        toString = Object.prototype.toString,
        globalPatterns = [ /^__cov_/ ],  // Istanbul stuff needs a pattern
        idRe = /^[a-z$_][a-z0-9$_\.]*$/i,
        typeofTypes = {
            number: 1,
            string: 1,
            'boolean': 1,
            'undefined': 1
        },
        toStringTypes = {
            '[object Array]'  : 'array',
            '[object Date]'   : 'date',
            '[object Boolean]': 'boolean',
            '[object Number]' : 'number',
            '[object RegExp]' : 'regexp',
            '[object String]' : 'string'
        },
        failOnError; // for catching general errors in ST.Spec runs

    ST.agentId = urlParams.orionAgentId;
    ST.sessionId = new Date().getTime().toString();

    if (sessionStorage) {
        ST.sessionId = sessionStorage.getItem('orion.sessionId') || ST.sessionId;
        ST.proxyId = sessionStorage.getItem('orion.proxyId') || ST.proxyId;
        sessionStorage.setItem('orion.sessionId', ST.sessionId);
        sessionStorage.setItem('orion.proxyId', ST.proxyId);
    }

    function ajax(options) {
        var url = options.url,
            data = options.data || null,
            success = options.success,
            failure = options.failure,
            scope = options.scope || this,
            params = options.params,
            queryParams = [],
            method, queryParamStr, xhr, sep;

        if (typeof data === "function") {
            data = data();
        }

        if (data && typeof data !== 'string') {
            data = JSON.stringify(data);
        }

        method = options.method || (data? 'POST' : 'GET');

        if (params) {
            for (var name in params) {
                if (params[name] != null) {
                    queryParams.push(name + "=" + encodeURIComponent(params[name]));
                }
            }

            queryParamStr = queryParams.join('&');

            if (queryParamStr !== '') {
                sep = url.indexOf('?') > -1 ? '&' : '?';
                url = url + sep + queryParamStr;
            }
        }

        if (typeof XMLHttpRequest !== 'undefined') {
            xhr = new XMLHttpRequest();
        } else {
            xhr = new ActiveXObject('Microsoft.XMLHTTP');
        }

        xhr.open(method, url);

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    if (success) {
                        success.call(scope, options, xhr);
                    }
                } else {
                    if (failure) {
                        failure.call(scope, options, xhr);
                    }
                }
            }
        };

        xhr.send(data);

        return xhr;
    }

    function callback(seq, result) {
        var fn = callbacks[seq];
        delete callbacks[seq];
        fn(result);
    }

    function reload(forced) {
        var urlAgentId = urlParams.orionAgentId,
            dc = Date.now().toString();

        // use != here to compare number / string
        if (ST.agentId != urlAgentId) {
            location.href = location.href.replace('orionAgentId=' + urlAgentId, 'orionAgentId=' + ST.agentId);
        } else if (forced) {
            if (location.href.indexOf('_dc') !== -1) {
                // update the cache buster
                location.href = location.href.replace('_dc=' + dc.length, 'dc=' + dc);
            } else {
                // add the cache buster
                location.href = location.href + '&_dc=' + dc;
            }
        } else {
            // Safari ignores forcedReload for some reason.
            location.reload(true);
        }

        terminated = true;
    }

    function redirect(url) {
        if (sessionStorage) {
            sessionStorage.clear();
        }

        // if we are redirecting to the parking page, or to another subject url
        ST.warnOnLeave(false);
        location.href = url;
        terminated = true;
    }

    var Controller = {
        startTestRun: function (message) {
            ST.runId = message.runId;

            ST.setupOptions(message.testOptions);

            if (isTestRunStarted || message.reload) {
                var pickle = {
                    runId: message.runId,
                    testOptions: message.testOptions
                };

                if (message.testIds) {
                    pickle.testIds = message.testIds;
                }

                sessionStorage.setItem('orion.autoStartTestRun', JSON.stringify(pickle));

                setTimeout(function() {
                    // The reason for the slight delay here is so that if a successive
                    // message arrives instructing the agent to redirect to the parking
                    // page, that one will take precedence.
                    // This can happen when the user is stopped at a breakpoint, and
                    // then initiates another test run.  The startTestRun message will be
                    // sent to the agent, but not processed because the user is still
                    // in break mode.   Then if the user attempts to initiate a test run
                    // again, Studio will detect that the agent never responded to the
                    // first message, and so it will launch a new agent and send another
                    // message to this agent instructing it to park.  If the user then
                    // returns to this agent and exits break mode, the messages will be
                    // processed, but we want the "redirect" message to take precedence - the
                    // agent should not start running tests.
                    ST.reloadPending = true;
                    if (isTestRunStarted) {
                        location.href = startingUrl;
                    }
                    reload();
                }, 100);

                return false; // Don't execute startTestRun on any other controllers
            }

            ST.testIds = message.testIds;
            
            // FIXME - decide where/when the driver should be initialized 
            var options = ST.options;
            if (options.driverConfig) {
                ST.ready.block();
                // TODO - Context
                ST.driver = ST.webdriverio
                    .remote(options.driverConfig)
                    .init()
                    .url(options.subjectUrl)
                    .then(function (driver) {
                        ST.ready.unblock();
                    });
            }

            isTestRunStarted = true;
        },

        handshake: function(message) {
            ST.agentId = message.agentId;
            ST.proxyId = message.proxyId;
            handshakeComplete = true;
            if (sessionStorage) {
                sessionStorage.setItem('orion.proxyId', ST.proxyId)
            }
            flushUpdates();
            poll();
        },

        error: function(message) {
            hasError = true;
            alert(message.message);
        },

        reload: function(message) {
            reload(message.forced);
        },

        redirect: function(message) {
            var url = message.url,
                port = message.port,
                page = message.page;

            if (!url) {
                url = location.protocol + "//" + location.hostname;

                if (port) {
                    url += ':' + port;
                }

                if (page) {
                    url += '/' + page;
                }
            }

            redirect(url);
        },

        response: function(message) {
            var seq = message.responseSeq;
            if (callbacks[seq]) {
                try {
                    callbacks[seq](message.value, message.error);
                } finally {
                    callbacks[seq] = null;
                }
            }
        },

        stopRecording: function() {
            if (ST.recorder) {
                ST.warnOnLeave(false);

                ST.recorder.stop();
                ST.recorder = null;
            }
        },

        terminated: function() {
            terminated = true;
        }
    };

    function processMessages (messages) {
        var len = messages.length,
            controllerCount = controllers.length,
            i, j, message, type, handled, controller, result, isErr;

        for (i = 0; i < len; i++) {
            message = messages[i];
            type = message.type;
            handled = false;

            for (j = 0; j < controllerCount; j++) {
                controller = controllers[j];
                if (controller[type]) {
                    handled = true;
                    try {
                        result = controller[type](message);
                        if (result === false) {
                            break;
                        }
                    } catch (err) {
                        console.error(err.stack || err);
                        result = err;
                        isErr = true;
                    }
                    if (message.responseRequired) {
                        ST.sendMessage({
                            type: 'response',
                            responseSeq: message.seq,
                            value: isErr ? null : result,
                            error: isErr ? result : null
                        });
                    }
                }
            }

            if (!handled) {
                console.error('Cannot process message "' + type + '". No handler found.');
            }
        }
    }

    function success(options, xhr) {
        var text = xhr.responseText,
            messages = text && JSON.parse(text);

        retryCount = 0;

        // check if the agent has been terminated via reload or redirect before processing
        // messages - this prevents us from going into an infinite loop if the server
        // responds with another redirect message prior to the browser actually executing
        // the first redirect, which would result in another poll being opened which would
        // lead to another redirect message from the server... and round and round we go.
        if (!terminated) {
            if (messages && messages.length) {
                processMessages(messages);
            }

            poll();
        }
    }

    function failure(options, xhr) {
        if (++retryCount < maxRetries) {
            retryPending = true;

            setTimeout(function () {
                retryPending = false;
                poll();
            }, 500 * retryCount);
        } else {
            // the proxy server we were communicating with is no longer responding.
            console.log('Agent lost connection with Sencha Studio');
        }
    }

    function flushUpdates () {
        var buff = messages;

        if (buff.length && !_updatesPending && handshakeComplete && !hasError && !retryPending && !terminated) {
            _updatesPending = true;
            messages = [];

            ajax({
                url: updatesUrl + ST.now(),
                data: buff,
                params: {
                    agentId: ST.agentId,
                    sessionId: ST.sessionId,
                    proxyId: ST.proxyId,
                    runId: ST.runId
                },
                success: function(options, xhr){
                    _updatesPending = false;
                    var text = xhr.responseText,
                        messages = text && JSON.parse(text);
                    if (messages && messages.length) {
                        processMessages(messages);
                    }
                    flushUpdates();
                },
                failure: function(){
                    // TODO: need some retry logic here to delay the retry or give up
                    messages.unshift.apply(messages, buff);
                    _updatesPending = false;
                    retryPending = true;
                    setTimeout(function() {
                        retryPending = false;
                        flushUpdates();
                    }, 500)
                }
            });
        }
    }

    function poll () {
        if (!hasError && !terminated) {
            ajax({
                url: messagesUrl + ST.now(),
                params: {
                    agentId: ST.agentId,
                    sessionId: ST.sessionId,
                    proxyId: ST.proxyId,
                    runId: ST.runId
                },
                success: success,
                failure: failure
            });
        }
    }

    function register (force) {
        ajax({
            url: registerUrl + ST.now(),
            params: {
                agentId: ST.agentId,
                sessionId: ST.sessionId,
                proxyId: ST.proxyId,
                runnerId: ST.runnerId,
                force: force
            },
            success: function(options, xhr){
                var messages = JSON.parse(xhr.responseText);
                processMessages(messages);
            },
            failure: function(){}
        });
    }

    ST.Element.on(window, 'load', function() {
        ST.windowLoaded = true;
    });

    // ----------------------------------------------------------------------------
    // Public API

    /**
     * Add controller
     * @param controller
     * @member ST
     * @private
     */
    ST.addController = function(controller) {
        controllers.push(controller);
    };

    ST.globRegex = function (glob, opts) {
        /*
            https://github.com/fitzgen/glob-to-regexp
            Copyright (c) 2013, Nick Fitzgerald
            All rights reserved.

            Redistribution and use in source and binary forms, with or without
            modification, are permitted provided that the following conditions
            are met:

              - Redistributions of source code must retain the above copyright
                notice, this list of conditions and the following disclaimer.

              - Redistributions in binary form must reproduce the above copyright
                notice, this list of conditions and the following disclaimer in
                the documentation and/or other materials provided with the
                distribution.

            THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
            "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
            LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
            FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
            COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
            INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
            BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
            LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
            CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
            LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
            ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
            POSSIBILITY OF SUCH DAMAGE.
         */
        if (glob == null) {
            return null;
        }

        var str = String(glob),
            // The regexp we are building, as a string.
            reStr = "",
            // Whether we are matching so called "extended" globs (like bash) and should
            // support single character matching, matching ranges of characters, group
            // matching, etc.
            extended = opts ? !!opts.extended : false,
            // If we are doing extended matching, this boolean is true when we are inside
            // a group (eg {*.html,*.js}), and false otherwise.
            inGroup = false,
            // RegExp flags (eg "i" ) to pass in to RegExp constructor.
            flags = opts && typeof( opts.flags ) === "string" ? opts.flags : "",
            c, i, len;

        for (i = 0, len = str.length; i < len; i++) {
            c = str[i];

            switch (c) {
                case "\\": case "/": case "$": case "^": case "+": case ".":
                case "(": case ")": case "=": case "!": case "|":
                    reStr += "\\" + c;
                    break;

                case "?":
                    if (extended) {
                        reStr += ".";
                        break;
                    }
                    // fall...
                case "[": case "]":
                    if (extended) {
                        reStr += c;
                        break;
                    }
                    // fall...
                case "{":
                    if (extended) {
                        inGroup = true;
                        reStr += "(";
                        break;
                    }
                    // fall...
                case "}":
                    if (extended) {
                        inGroup = false;
                        reStr += ")";
                        break;
                    }
                    // fall...
                case ",":
                    if (inGroup) {
                        reStr += "|";
                        break;
                    }
                    reStr += "\\" + c;
                    break;

                case "*":
                    reStr += ".*";
                    break;

                default:
                    reStr += c;
            }
        }

        // When regexp 'g' flag is specified don't
        // constrain the regular expression with ^ & $
        if (!flags || !~flags.indexOf('g')) {
            reStr = "^" + reStr + "$";
        }

        return new RegExp(reStr, flags);
    };

    /**
     * Adds one or more allowable global variable names.
     * Variable names can be simple names or a regex.
     * @param {String/String[]} add
     * @member ST
     */
    ST.addGlobals = function (add) {
        var globals = ST.options.globals,
            args = arguments,
            i = args.length,
            s;

        while (i-- > 0) {
            if (!(s = args[i])) {
                continue;
            }

            if (typeof s === 'string') {
                if (idRe.test(s)) {
                    globals[s] = true;  // simple names can be in a map
                } else {
                    globalPatterns.push(ST.globRegex(s));
                }
            } else {
                ST.addGlobals.apply(ST, s);  // not a String so must be a String[]
            }
        }
    };

    ST.checkGlobalLeaks = function () {
        var allowedGlobals =  ST.options.globals,
            i, ok, property, value;

        for (property in window) {
            if (allowedGlobals[property]) {
                // Reading some properties from window can trigger warnings (such as
                // webkitStorageInfo), so skip early.
                continue;
            }

            for (i = 0; !ok && i < globalPatterns.length; ++i) {
                ok = globalPatterns[i].test(property);
            }
            if (ok) {
                continue;
            }

            try {
                // IE throws error when trying to access window.localStorage
                value = window[property];
            } catch (e) {
                continue;
            }

            if (value !== undefined &&
                (!value || // make sure we don't try to do a property lookup on a null value
                    // old browsers (IE6 and opera 11) add element IDs as enumerable properties
                    // of the window object, so make sure the global var is not a HTMLElement
                    value.nodeType !== 1 &&
                    // make sure it isn't a reference to a window object.  This happens in
                    // some browsers (e.g. IE6) when the document contains iframes.  The
                    // frames' window objects are referenced by id in the parent window object.
                    !(value.location && value.document))) {
                // add the bad global to allowed globals so that it only fails this one spec
                allowedGlobals[property] = true;

                ST.status.addResult({
                    passed: false,
                    message: 'Bad global variable: ' + property + ' = ' + ST.prettyPrint(value)
                });
            }
        }
    };

    ST.initGlobals = function () {
        var globals = ST.options.globals,
            add, prop;

        // Any properties already in the window object are ok
        for (prop in window) {
            globals[prop] = true;
        }

        // Old Firefox needs these
        globals.getInterface =
        globals.loadFirebugConsole =
        globals._createFirebugConsole =
        globals.netscape =
        globals.XPCSafeJSObjectWrapper =
        globals.XPCNativeWrapper =
        globals.Components =
        globals._firebug =
        // IE10+ F12 dev tools adds these properties when opened.
        globals.__IE_DEVTOOLBAR_CONSOLE_COMMAND_LINE =
        globals.__BROWSERTOOLS_CONSOLE_BREAKMODE_FUNC =
        globals.__BROWSERTOOLS_CONSOLE_SAFEFUNC =
        // in IE8 jasmine's overrides of setTimeout/setInterval make them iterable
        globals.setTimeout =
        globals.setInterval =
        globals.clearTimeout =
        globals.clearInterval =
        // In Ext JS 4 Ext.get(window) adds an id property
        globals.id =
            true;
    };

    /**
     * Set options on ST.options and if testOptions.globals is included add
     * provided global symbols to the common list of allowed global symbols.
     * @param testOptions
     */
    ST.setupOptions = function (testOptions) {
        var options = ST.options,
            globals = options.globals,
            add;

        if (testOptions) {
            ST.apply(options, testOptions);

            add = testOptions.globals;
            if (add !== undefined) {
                options.globals = globals; // put back the original globals
                ST.addGlobals(add);
            }
        }

        ST.ready.on(ST.initGlobals);
    };

    ST.typeOf = function (value) {
        if (value === null) {
            return 'null';
        }

        var type = typeof value,
            ret = type,
            typeToString;

        if (!typeofTypes[type]) {
            if (!(ret = toStringTypes[typeToString = toString.call(value)])) {
                if (type === 'function') {
                    ret = type;
                } else if (type !== 'object') {
                    ret = typeToString;
                } else if (value.nodeType === undefined) {
                    ret = type;
                } else if (value.nodeType === 3) {
                    ret = nonSpaceRe.test(value.nodeValue) ? 'textnode' : 'whitespace';
                } else {
                    ret = 'element';
                }
            }
        }

        return ret;
    };

    /**
     * @member ST
     * Send message
     * @param message
     * @param callback
     * @private
     */
    ST.sendMessage = function(message, callback) {
        if (!hasError) {
            if (typeof message != 'object') {
                message = {
                    type: message
                };
            }

            callback = callback || message.callback;
            delete message.callback;
            message.seq = ++seq;
            if (callback) {
                callbacks[message.seq] = callback;
                message.responseRequired = true;
            }
            messages.push(message);
            flushUpdates();
        }
    };

    ST.getParam = function (name) {
        return urlParams[name];
    };

    /**
     * @member ST
     * Called before test files are loaded
     * @private
     */
    ST.beforeFiles = function() {
        // The initial call to "register" must be after all the orion files have loaded
        // but ideally before the users spec files are loaded.
        // This ensures that if there is a pending startTestRun message it does not
        // get processed until jasmine-orion is available, and also ensures that
        // if we need to reload the page because of a runnerId mismatch we can do
        // it as soon as possible without waiting for all the user's code to load.
        register();

        // Even though we may defer execution/evaluation of the test inventory, the
        // timing of this messages does not need to closely correspond to when tests
        // actually start being described to the Runner.
        ST.sendMessage({
            type: 'beforeFiles'
        });
    };

    /**
     * @member ST
     * Called after test files are loaded
     * @private
     */
    ST.afterFiles = function() {
        var extMicroloader = Ext.Microloader,
            extOnReady = Ext.onReady,
            pickle;

        ST.currentTestFile = null;

        // In case the microloader is present, block orion until it's done with its
        // job, since it's asynchronously loading more scripts
        if (extMicroloader) {
            ST.ready.block();
            extMicroloader.onMicroloaderReady(function () {
                ST.ready.unblock();
            }); 
        }
        
        // We thought Ext JS was ready in the end of init.js, but if somebody (like jazzman)
        // decided to use the Loader, for instance, it will go back to a non-ready state.
        // Therefore, here we give a second chance for late calls that may eventually still
        // be going at this point.
        if (extOnReady) {
            ST.ready.block();
            extOnReady(function () {
                ST.defer(function() {
                    // Slightly delayed to ensure that this runs after any user onReady
                    // handlers.  This approach is preferred over using the priority option
                    // because it works with all versions of the framework.
                    ST.ready.unblock();
                }, 100);
            });
        }

        // If we had to reload in order to run the tests, we will have put the
        // startTestRun message in a pickle jar for now.
        pickle = JSON.parse(sessionStorage.getItem('orion.autoStartTestRun'));
        if (pickle) {
            sessionStorage.removeItem('orion.autoStartTestRun');

            // The type is not stored, so restore it and remove the reload option
            // (to avoid an infinite loop of reloads).
            pickle.type = 'startTestRun';
            pickle.reload = false;

            // And process the message as if the Runner had just sent it. Since we
            // not ready nor testsReady, this just gets things primed. In general, if
            // the user is click-happy the startTestRun message could arrive this
            // early anyway, so faking it here is not really very special.
            processMessages([ pickle ]);
        }

        // Because we may defer execution of the test inventory, connect this message
        // back to the Runner to the testsReady state. This is important for the Event
        // Recorder to know that the full test inventory has been described so that it
        // can determine if exactly one spec has the startRecording call in it.
        ST.testsReady.on(function () {
            ST.sendMessage({
                type: 'afterFiles'
            });
        });

        // We start with 1 ready blockage. Here we unblock it, which means ST itself
        // is ready to go.
        ST.ready.unblock();
    };

    /**
     * @member ST
     * Called before a test file is loaded
     * @param file
     * @private
     */
    ST.beforeFile = function (file) {
        ST.currentTestFile = file;
    };

    /**
     * @member ST
     * Called after a test file is loaded
     * @param file
     * @private
     */
    ST.afterFile = function (file) {
        ST.currentTestFile = null;
    };

    //-------------------------------------------------------------------------
    // Player

    /**
     * @member ST
     * Called when the Player throws an error
     * @private
     */
    ST.onPlayerError = function (ex) {
        ST.status.addResult({
            passed: false,
            message: ex.message || ex
        });
    };

    /**
     * Lazily creates and returns the shared {@link ST.event.Player event player}. This
     * is rarely called directly, but is the underlying mechanism used the inject events
     * using the {@link ST#play} and {@link ST.future.Element futures} API's.
     * @return {ST.event.Player}
     * @method player
     * @member ST
     */
    ST.player = function () {
        var player = ST._player;

        if (!player) {
            ST._player = player = new ST.event.Player();

            player.on('error', ST.onPlayerError);
        }

        return player;
    };

    ST.isPlayingEvents = function () {
        var player = ST._player;

        return player && player.events.length;
    };

    /**
     * Adds an array of events to the queue and optionally calls a `done` method when
     * the events have all been played.
     *
     * @param {ST.event.Playable[]} events The events to play.
     * @param {Function} [done] Optional function to call after the events have played.
     * @return {ST.event.Playable[]} The `events` array with each element now promoted
     * from config object to `ST.event.Playable` instance.
     * @method play
     * @member ST
     */
    ST.play = function (events, done) {
        var player = ST.player(),
            options = ST.options,
            tail = function () {
                player.un('error', tail);

                if (done) {
                    done();
                }
            };

        // By adding our tail fn to the event stream it will be played at the end
        // of the events we want to play.
        events.push(tail);
        player.add(events);
        events.pop();

        player.on('error', tail);

        player.eventDelay = options.eventDelay;
        player.typingDelay = options.typingDelay;
        player.visualFeedback = options.visualFeedback;

        player.injector.translate = options.eventTranslation;

        player.start();  // does nothing if already started
        return events;
    };

    /**
     * Takes a snapshot of the viewport and compares it to the associated baseline image.
     * @param {String} name
     * @param {Function} callback
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @method screenshot
     * @member ST
     */
    ST.screenshot = function (name, callback, timeout) {
        name = name || ST._screenshotCount++;

        ST.play([{
            timeout: timeout || ST.options.screenshotTimeout,
            fn: function(done){
                ST.system.screenshot(name, function (screenshot, err) {
                    var expectation;

                    if (screenshot) {
                        expectation = {
                            passed: screenshot.passed,
                            message: 'Expected screenshot ' + name + ' to match baseline.',
                            screenshot: screenshot.path,
                            baseline: screenshot.baseline,
                            diff: screenshot.diff
                        };
                    } else if (err) {
                        expectation = {
                            passed: false,
                            message: err
                        };
                    } else {
                        expectation = {
                            passed: true,
                            message: 'Screenshot comparison unsupported for this session'
                        };
                    }

                    ST.status.addResult(expectation);
                    callback();
                    done();
                });
            }
        }]);
    };

    /**
     * Starts the {@link ST.event.Recorder event recorder}. Once this method is called
     * all further test execution is halted.
     *
     * This method is typically injected automatically by Sencha Test Studio when using
     * its Event Recorder and is therefore rarely called directly.
     * @param {Object} config Options to configure the {@link ST.event.Recorder}.
     * @param done
     * @method startRecording
     * @member ST
     */
    ST.startRecording = function (config, done) {
        if (typeof config === 'function') {
            done = config;
            config = {};
        }

        config = config || {};

        if (!window.addEventListener) {
            ST.alert({
                title: 'Cannot Record Events',
                message: 'Event recording is not currently supported in this browser.',
                buttons: [{
                    text: 'OK',
                    handler: function() {
                        //redirect('about:blank');
                        // TODO: park?
                    }
                }]
            });

            return;
        }

        if (!ST.currentBlock && !config.skipChecks) {
            ST.alert({
                title: 'Cannot Record Events',
                message: 'Event recorder was called outside of a test.',
                buttons: [{
                    text: 'OK',
                    handler: function() {
                        //redirect('about:blank');
                        // TODO: park?
                    }
                }]
            });

            return;
        }

        // We create the Recorder now even if we are playing events since that ensures
        // the Block won't declare the spec as complete.
        var recorder = ST.recorder || (ST.recorder = new ST.event.Recorder(config)),
            player = ST.player();

        if (ST.isPlayingEvents() && !config.skipChecks) {
            // We use ST.play() to properly inject into the event timeline. This is
            // necessary to handle cases like this:
            //
            //      ST.button('@foo')
            //          .click()
            //          .and(function () {
            //              ST.startRecording(); // Fun!
            //          })
            //          .click();
            //
            // Once it is our turn, we pause() the player to avoid any further event
            // playback.
            ST.play([{
                fn: function () {
                    ST.startRecording(ST.apply({
                        skipChecks: true
                    }, config), done);
                }
            }]);
        }
        else {
            try {
                // Make sure no other events get played.
                player.pause();

                recorder.on({
                    scope: ST,
                    add: function (recorder, events) {
                        ST.sendMessage({
                            type: 'recordedEvents',
                            events: events
                        });
                    },
                    stop: function () {
                        ST.sendMessage({
                            type: 'recordingStopped'
                        });
                        done();
                    },
                    start: function () {
                        ST.sendMessage({
                            type: 'recordingStarted'
                        });
                    }
                });

                ST.warnOnLeave(true);

                recorder.start();
            } catch (err) {
                if (recorder) {
                    console.log(recorder);
                }

                console.error(err.message || err);
                console.error(err.stack || err);
            }
        }
    };

    ST.onBeforeUnload = function (evt) {
        return evt.returnValue = 'Sencha Test does not currently support page navigation during a test scenario.';
    }

    ST.warnOnLeave = function (warn) {
        var el = ST.fly(window);
        if (warn) {
            if (!ST._onbeforeload) {
                ST._onbeforeload = el.on('beforeunload', ST.onBeforeUnload);
            }
        } else if(ST._onbeforeload) {
            ST._onbeforeload.destroy();
            ST._onbeforeload = null;
        }
    }
    
    /**
     * @member ST
     * Log
     * @param message
     * @private
     */
    ST.log = function(message) {
        ST.sendMessage({
            type: 'log',
            message: message
        });
    };

    /**
     * @member ST
     * Pretty print
     * @param value
     * @private
     */
    ST.prettyPrint = function(value) {
        var formattedValue = value,
            className, superclass, id, type;

        if (value) {
            className = value.$className;

            if (className !== undefined) {
                // support for pretty printing instances of Ext classes

                if (!className) {
                    // support for anonymous classes - Ext.define(null, ...)
                    // loop up the inheritance chain to find nearest non-anonymous ancestor
                    superclass = value.superclass;
                    while (superclass && !superclass.$className) {
                        superclass = superclass.superclass;
                    }
                    if (superclass) {
                        className = superclass.$className;
                    }
                }

                id = value.id || (value.getId && value.getId());

                formattedValue = className + (id ? ('#' + id) : '');
            } else if (value instanceof Array) {
                formattedValue = 'Array';
            } else {
                type = typeof value;

                if (type === 'string') {
                    formattedValue = '"' + value + '"';
                } else if (type === 'boolean' || type === 'number') {
                    formattedValue = value;
                } else if (value.tagName) {
                    id = value.id;
                    formattedValue = '<' + value.tagName.toLowerCase() + (id ? ('#' + id) : '') + '>';
                } else if (type === 'function') {
                    formattedValue = 'Function';
                } else {
                    formattedValue = 'Object';
                }
            }
        }

        return formattedValue;
    };

    /**
     * Similar `setTimeout` but instead returns a function that cancels the timer.
     *
     * The timeout value (`millisec`) defaults to `ST.options.timeout` unless that value
     * is set to `0` in which case timeouts are disabled. In that case, `fn` will never be
     * called.
     * @param {Function} fn The function to call after `millisec` milliseconds.
     * @param {Object} [scope] The `this` pointer to use for calling `fn`.
     * @param {Number} [millisec] The delay in milliseconds. Defaults to `ST.options.timeout`
     * and is disabled if that value is `0`.
     * @return {Function}
     * @private
     * @member ST
     */
    ST.timeout = function (fn, scope, millisec) {
        var ms = ST.options.timeout;

        if (typeof scope === 'number') {
            millisec = scope;
            scope = null;
        }

        if (ms !== 0 && millisec != null) {
            // if ST.options.timeout is 0, ignore all timeouts even explicit ones
            ms = millisec;
        }

        return ms ? ST.doTimeout(fn, scope, ms) : ST.emptyFn;
    };

    ST.doTimeout = function (fn, scope, ms) {
        var cancelFn = function () {
                if (cancelFn.timerId > 0) {
                    ST.deferCancel(cancelFn.timerId);
                    cancelFn.timerId = 0;
                }
                return null;
            };

        cancelFn.timerId = ST.defer(fn, scope, ms);
        cancelFn.timeout = ms;

        return cancelFn;
    };

    /**
     * @class ST.Tests
     * @singleton
     * @protected
     */
    ST.Tests = {
        lastFile: null,
        queue: [],
        running: 0,

        enqueue: function (testFn) {
            var me = ST.Tests,
                queue = me.queue;

            if (!ST.options.evaluateTestsOnReady || me.running) {
                return testFn();
            }

            if (!queue.length) {
                // When we first defer a describe() we block the testsReady gate.
                ST.testsReady.block();
                ST.ready.on(ST.Tests.start);
            }

            queue.push({
                file: ST.currentTestFile,
                fn: testFn
            });
        },

        next: function () {
            var me = ST.Tests,
                queue = me.queue,
                record = queue.shift();

            if (record) {
                // Ensure top-level suites know the current test file path.
                me.setFile(record.file);

                ++me.running;

                record.fn();

                --me.running;

                if (queue.length) {
                    // Null this directly not using setCurrentFile since we may have
                    // multiple top-level tests in a file and therefore we are not really
                    // transitioning to the next file. We null this out since other async
                    // operations may fire before we get back to this and it would be
                    // incorrect to think we are in the context of this file unless we
                    // actually are processing its tests.
                    ST.currentTestFile = null;

                    ST.defer(me.next, 10);
                } else {
                    me.setFile(null);

                    // When we run the last describe() we unblock the testsReady gate.
                    ST.testsReady.unblock();
                }
            }
        },

        setFile: function (file) {
            var me = ST.Tests,
                lastFile = me.lastFile;

            if (lastFile !== file) {
                if (lastFile) {
                    ST.sendMessage({
                        type: 'afterFile',
                        file: lastFile
                    });
                }

                me.lastFile = lastFile = file;

                if (lastFile) {
                    ST.sendMessage({
                        type: 'beforeFile',
                        file: lastFile
                    });
                }
            }

            return ST.currentTestFile = file;
        },

        start: function () {
            // Must defer since enqueue() has not pushed() yet... in the rare case
            // where ST.ready is open already. Even if not, it is best to give the app
            // some room after it goes ready.
            ST.defer(ST.Tests.next, 50);
        }
    };

    /**
     * @class ST.Block
     * This class is created to wrap user test functions. It provides a `wrapperFn` to
     * pass to the test framework, manages a {@link ST.WatchDog watch dog} if the user's
     * code is asynchronous and coordinates with the {@link ST.event.Player event player}
     * to wait for queued events to complete.
     * @protected
     * @since 1.0.2
     */

    /**
     * @method constructor
     * @param {Function/Object} fn The user function or a config object to apply to `this`
     * instance. The config object must contain an `fn` property with the user function.
     * @param {Number} [timeout] The timeout for `fn` to complete. If not specified, the
     * {@link ST.options#timeout default timeout} is used.
     * @protected
     */
    ST.Block = function (fn, timeout) {
        var me = this;

        if (typeof fn === 'function') {
            me.fn = fn;
            me.timeout = timeout;
        } else {
            ST.apply(me, fn);
        }

        me.async = me.fn.length > 0;

        /**
         * @property {Function} wrapperFn
         * This function binds the user function `fn` to this `Block`. This function is
         * intended to be passed to the test framework. When called, this function stores
         * the `done` parameter and `this` pointer and passes control to the `invoke`
         * method of the owning `Block` instance.
         * @param {Function} done The callback provided by the test framework. This must
         * be a declarated parameter in order for test frameworks (such as Jasmine/Mocha)
         * to detect that the function is asynchronous.
         */
        me.wrapperFn = function (done) {
            // Capture the context object from the test framework.
            me._context = this;
            // And the "done" parameter.
            me._done = done;

            ST.currentBlock = me;

            me.invoke();

            return me.ret;
        };
    };

    ST.Block.prototype = {
        /**
         * @property {Object} _context
         * The `this` pointer supplied by the test framework.
         * @private
         */
        _context: null,

        /**
         * @property {Function} _done
         * The `done` parameter passed by the test framework. This property is set to
         * `null` after it is called.
         * @private
         */
        _done: null,

        /**
         * @property {Boolean} async
         * This property is `true` if the user's function is asynchronous.
         * @private
         */
        async: false,

        /**
         * @property {Boolean} calling
         * This property is `true` during the call to the user's function.
         * @private
         */
        calling: false,

        /**
         * @property {Boolean} playing
         * This property is `true` if the event player is running.
         * @private
         */
        playing: false,

        /**
         * @property {Object} ret
         * The value returned by the user's test function.
         * @private
         */
        ret: null,

        /**
         * @property {ST.WatchDog} watchDog
         * The `WatchDog` instance used to manage the timeouts for the user's code.
         * @private
         */
        watchDog: null,

        /**
         * Calls the user's function wrapped in a `try` / `catch` block (depending on the
         * {@link ST.option#handleExceptions test options}).
         */
        call: function () {
            var me = this,
                context = me._context,
                watchDog = me.watchDog,
                done = watchDog && watchDog.done,
                fn = me.fn,
                ret;

            me.calling = true; // allow the user to call through to done()

            if (ST.options.handleExceptions) {
                try {
                    ret = fn.call(context, done);
                } catch (e) {
                    me.error = e;
                }
            } else {
                ret = fn.call(context, done);
            }

            me.calling = false; // allow the user to call through to done()

            me.ret = ret;
        },

        /**
         * This method is called to report a test failure.
         * @param {Error/String} ex The exception (`Error` instance) or error message.
         */
        failure: function (ex) {
            // If we haven't called the test framework completion method (_done) yet,
            // we can still report failures. Once we call that callback, we clear the
            // _done property so we know we are outside the scope of the test.
            if (ex && this._done) {
                if(ex.specDisabled) {
                    ST.Test.current.disabled = ex.message;

                    ST.status.addResult({
                        passed: true,
                        message: ex.message,
                        disabled: true
                    });
                } else {
                    ST.status.addResult({
                        passed: false,
                        message: ex.message || ex
                    });
                }
            }
        },

        /**
         * This method is called to complete the test block.
         * @param {Error/String} [ex]
         */
        finish: function (ex) {
            var me = this,
                done = me._done,
                watchDog = me.watchDog,
                player;

            if (done) {
                me.failure(me.error || ex); // call before clearing "_done"
                me._done = null;

                if (watchDog) {
                    watchDog.destroy();
                    me.watchDog = null;
                }

                if (me.playing) {
                    me.playing = false;
                    player = ST.player();

                    player.un({
                        end: me.onEndPlay,
                        single: true,
                        scope: me
                    });

                    player.stop();
                }

                // If the event recorder is running we don't want to move forward,
                // so just stop here.
                if (!ST.recorder) {
                    ST.currentBlock = null;
                    done();
                }
            }
        },

        invoke: function () {
            var me = this,
                player;

            ST.Test.current.start();

            if (me.async) {
                me.watchDog = new ST.WatchDog(me.onWatchDog, me, me.timeout);
            }

            me.call();

            if (ST.isPlayingEvents()) {
                me.playing = true;

                player = ST.player();
                player.on({
                    end: me.onEndPlay,

                    single: true,
                    scope: me
                });
            }

            if (me.error || (!me.playing && !me.watchDog)) {
                me.finish();
            }
        },

        onEndPlay: function () {
            this.playing = false;

            if (!this.watchDog) {
                this.finish();
            }
        },

        onWatchDog: function (error) {
            var me = this;

            me.watchDog = null;

            if (error) {
                me.failure(error);
            }

            if (!me.playing && !me.calling) {
                // If the event player has started or we are still in the user's fn,
                // don't call done() just yet...
                me.finish();
            }
        }
    };

    /**
     * @class ST.Test
     * This base class for `ST.Spec` and `ST.Suite` manages a set of results and a
     * `failures` counter for an active test. Instances of `ST.Spec` and `ST.Suite`
     * are created by `{@link ST.status#suiteStarted ST.status.suiteStarted}` and
     * `{@link ST.status#testStarted ST.status.testStarted}` and are then used by the
     * test framework adapter to log results.
     * @since 1.0.2
     * @private
     */
    ST.Test = ST.define({
        /**
         * @property {Boolean} isTest
         * The value `true` to indicate an object is an `instanceof` this class.
         * @readonly
         * @private
         */
        isTest: true,

        /**
         * @property {ST.Test} current
         * The reference to the currently executing `ST.Spec` or `ST.Suite`.
         * @readonly
         * @private
         * @static
         */

        /**
         * @property {Number} failures
         * The number of failed results add to this test.
         * @readonly
         * @private
         */
        failures: 0,

        /**
         * @property {Object[]} results
         * An array of expectations/results. Each object should have at least these
         * fields:
         *
         *  * **passed** - A boolean value of `true` or `false`.
         *  * **message** - The associated message for the result.
         *
         * @readonly
         * @private
         */
        results: null,

        /**
         * @property {String} disabled
         * If present indicates that this test is disabled and explains why.
         *
         * @private
         */
        disabled: null,

        constructor: function (id, description) {
            /**
             * @property {ST.Suite} parent
             * The owning suite for this test.
             * @readonly
             * @private
             */
            this.parent = ST.Test.current;

            /**
             * @property id
             * The internal `id` for this test.
             * @readonly
             * @private
             */
            this.id = id;

            /**
             * @property {String} description
             * The test description. This is only stored here for diagnostic purposes.
             * @readonly
             * @private
             */
            this.description = description;

            ST.Test.current = this;
        },

        /**
         * Adds a result to this test and adjust `failures` count accordingly.
         * @param {Object} result
         * @param {Boolean} result.passed The pass (`true`) or failed (`false`) status.
         * @param {String} result.message The test result message.
         * @private
         */
        addResult: function (result) {
            var me = this;

            (me.results || (me.results = [])).push(result);

            result.status = result.disabled ?'disabled' : (result.passed ? 'passed' : 'failed');

            if (!result.passed) {
                ++me.failures;

                if (ST.options.breakOnFailure) {
                    debugger;
                }
            }
        },

        /**
         * Returns the `results` for this test and all `parent` tests.
         * @param {Boolean} [fork] Pass `true` to ensure the returned array is a copy
         * that can be safely modified. The default is to return the same `results` array
         * instance stored on this object (for efficiency).
         * @return {Object[]}
         * @private
         */
        getResults: function (fork) {
            var me = this,
                parent = me.parent,
                results = me.results || EMPTY,
                ret = results,
                n = results.length;

            if (parent && parent.hasResults()) {
                // Since our parent has results, we need a clone of them if we also
                // have results to append (or if our caller wanted a fork).
                ret = parent.getResults(fork || n > 0);
                if (n) {
                    ret.push.apply(ret, results);
                }
            }
            else if (fork) {
                // Even if we have no results, we must return a mutable array if we
                // are asked to fork the results.
                ret = results.slice();
            }

            return ret;
        },

        /**
         * Returns `true` if this test contains any failing expectations.
         * @return {Boolean}
         * @private
         */
        isFailure: function () {
            for (var test = this; test; test = test.parent) {
                if (test.failures) {
                    return true;
                }
            }

            return false;
        },

        /**
         * Returns `true` if this test contains any results.
         * @return {Boolean}
         * @private
         */
        hasResults: function () {
            for (var test = this; test; test = test.parent) {
                if (test.results) {
                    return true;
                }
            }

            return false;
        },

        start: function() {
            var parent = this.parent;
            if(!this.started) {
                this.started = true;
                if(parent) {
                    parent.start();
                }
                this.onStart();
            }
        },

        stop: function() {
            if(this.started && !this.stopped) {
                this.stopped = true;

                this.onStop();

                ST.Test.current = this.parent;
            }
        }
    });

    /**
     * @class ST.Suite
     * This class is an `ST.Test` container. It can also contain expectation results
     * due to methods like `beforeAll` which run outside the context of an `ST.Spec`.
     *
     * Instances are created by `{@link ST.status#suiteStarted ST.status.suiteStarted}`.
     * They are not typically created directly.
     * @extend ST.Test
     * @since 1.0.2
     * @private
     */
    ST.Suite = ST.define({
        extend: ST.Test,

        /**
         * @property {Boolean} isSuite
         * The value `true` to indicate an object is an `instanceof` this class.
         * @readonly
         */
        isSuite: true,

        onStart: function () {
            ST.status.suiteStarted({
                id: this.id,
                name: this.description
            });
        },

        onStop: function() {
            ST.status.suiteFinished({
                id: this.id,
                name: this.description,
                disabled: this.disabled
            });
        }
    });

    /**
     * @class ST.Spec
     * This class is a "specification" or leaf test case (not a container).
     *
     * Instances are created by `{@link ST.status#testStarted ST.status.testStarted}`.
     * They are not typically created directly.
     * @extend ST.Test
     * @since 1.0.2
     * @private
     */
    ST.Spec = ST.define({
        extend: ST.Test,

        /**
         * @property {Boolean} isSpec
         * The value `true` to indicate an object is an `instanceof` this class.
         * @readonly
         */
        isSpec: true,

        onStart: function () {
            failOnError = true;

            ST.status.testStarted({
                id: this.id,
                name: this.description
            });
        },

        onStop: function () {
            failOnError = false;

            ST.status.testFinished({
                id: this.id,
                name: this.description,
                passed: !this.isFailure(),
                expectations: this.getResults(),
                disabled: this.disabled
            });
        }
    });

    /**
     * @class ST.WatchDog
     * This class manages a `timeout` value for user code. Instances of `WatchDog` are
     * created to report failures if user code does not complete in the specified amount
     * of time.
     *
     * To provide this support, this class creates a `done` function that mimics the API
     * of the underlying test framework. This function is then passed to the user code
     * and is called when the test completes or fails. Failure to call this function in
     * the `timeout` period results in a failure.
     *
     * In all cases, the provided `callback` is called to report the result.
     *
     * @constructor
     * @param {Function} callback The callback to call when the user calls the returned
     * function or the `timeout` expires.
     * @param {Error/String} callback.error A timeout error message or `null` if the user
     * called the `done` function.
     * @param {Object} [scope] The `this` pointer for the `callback`.
     * @param {Number} [timeout] The timeout in milliseconds. Defaults to
     * {@link ST.options#timeout}.
     * @private
     * @since 1.0.2
     */
    ST.WatchDog = function (callback, scope, timeout) {
        var me = this;

        if (typeof scope === 'number') {
            timeout = scope;
        } else {
            me.scope = scope;
        }

        me.callback = callback;

        me.done = function () {
            me.fire(null);
        };

        me.done.fail = me.fail = function (e) {
            me.fire(e || new Error('Test failed'));
        };
        
        if (me.init) { // maybe for Moca?
            me.init();
        }

        me.set(timeout);
    };

    ST.WatchDog.prototype = {
        /**
         * @property {Function} done
         * This function is passed to user code and mimics the API of the test framework.
         * In Jasmine, this function has a `fail` function property that is called to
         * report failures. This function only reports succcess.
         * In Mocha, this function will instead accept an optional error parameter.
         * In all cases, calling this method with no arguments reports a success.
         * @readonly
         */
        done: null,

        /**
         * @method fail
         * This method is provided by the Test Framework Adapter. It is used to report
         * an asynchronous test failure.
         * @protected
         * @abstract
         * @param {String/Error} error
         */
        fail: null,

        /**
         * @method init
         * This method is provided by the Test Framework Adapter. It populates the `done`
         * property such that it mimics the test framework's API.
         * @protected
         * @abstract
         */
        init: null,

        scope: null,

        cancel: function () {
            var timer = this.timer;

            if (timer) {
                this.timer = this.timeout = null;
                timer();
            }
        },

        destroy: function () {
            this.cancel();
            this.callback = this.scope = null;
        },

        fire: function (e) {
            var me = this,
                callback = me.callback;

            me.cancel();

            if (callback) {
                me.callback = null;
                callback.call(me.scope || me, e);
            }
        },

        onTick: function () {
            var me = this,
                hasTimeout = !!me.timeout,
                timeout, msg;

            if (me.timer) {
                timeout = me.timeout || me.timer.timeout;
                msg = 'Timeout waiting for test step to complete (' + (timeout / 1000) + ' sec).';

                me.timer = me.timeout = null;

                if (!hasTimeout) {
                    msg += ' If testing asynchronously, ensure that you have called done() in your spec.';
                }
                
                me.fire(msg);
            }
        },

        set: function (timeout) {
            var me = this;

            me.cancel();

            me.timer = ST.timeout(me.onTick, me, me.timeout = timeout);
        }
    };

    /**
     * This class provides various methods that leverage WebDriver features. These are
     * only available when the browser is launched by WebDriver.
     * @class ST.system
     * @singleton
     * @private
     */
    ST.system = {
        /**
         * Get window handle
         * @method getWindowHandle
         * @param callback
         * @private
         */
        getWindowHandle: function(callback) {
            ST.sendMessage({
                type: 'getWindowHandle'
            }, callback);
        },

        /**
         * Get window handles
         * @method getWindowHandles
         * @param callback
         * @private
         */
        getWindowHandles: function(callback) {
            ST.sendMessage({
                type: 'getWindowHandles'
            }, callback);
        },

        /**
         * Switch to
         * @method switchTo
         * @param options
         * @param callback
         * @private
         */
        switchTo: function(options, callback) {
            options.type = 'switchTo';
            ST.sendMessage(options, callback);
        },

        /**
         * Close
         * @method close
         * @param callback
         * @private
         */
        close: function(callback) {
            ST.sendMessage({
                type: 'close'
            }, callback);
        },

        /**
         * Screenshot
         * @method screenshot
         * @param name
         * @param callback
         * @private
         */
        screenshot: function(name, callback) {
            ST.sendMessage({
                type: 'screenshot',
                name: name
            }, callback);
        },

        /**
         * Click
         * @method click
         * @param domElement
         * @param callback
         * @private
         */
        click: function(domElement, callback) {
            ST.sendMessage({
                type: 'click',
                elementId: domElement.id
            }, callback);
        },

        /**
         * Send Keys
         * @method sendKeys
         * @param domElement
         * @param keys
         * @param callback
         * @private
         */
        sendKeys: function(domElement, keys, callback) {
            ST.sendMessage({
                type: 'sendKeys',
                elementId: domElement.id,
                keys: keys
            }, callback);
        },

        /**
         * Post coverage results
         * @method postCoverageResults
         * @param name
         * @param reset
         * @private
         */
        postCoverageResults: function(name, reset) {
            var coverage = window.__coverage__,
                filtered;
            if (coverage) {
                filtered = JSON.stringify(getCoverage(coverage));
                if (name === '__init__') {
                    resetCodeCoverage(coverage);
                    ST.sendMessage({
                        type: 'codeCoverageStructure',
                        name: name,
                        results: JSON.stringify(coverage)
                    });
                }
                ST.sendMessage({
                    type: 'codeCoverage',
                    name: name,
                    results: filtered
                });
                if (reset) {
                    resetCodeCoverage(coverage);
                }
            }
        }
    };

    var propNames = ['s', 'b', 'f'];

    function getCoverage (coverage) {
        var out = {},
            cvg, p, prop, stats, total;

        for (var fileName in coverage) {
            cvg = coverage[fileName];
            total = 0;

            for (p = 0; p < propNames.length; p++) {
                prop = propNames[p];
                stats = cvg[prop];
                for (var num in stats) {
                    var val = stats[num];
                    if (ST.isArray(val)) {
                        for (var i = 0; i < val.length; i++) {
                            total += val[i];
                        }
                    } else {
                        total += stats[num];
                    }
                }
            }

            if (total > 0) {
                out[fileName] = cvg;
            }
        }
        return out;
    }

    function resetCodeCoverage (coverage) {
        var out = {},
            cvg, p, prop, stats;

        for (var fileName in coverage) {
            cvg = coverage[fileName];

            for (p = 0; p < propNames.length; p++) {
                prop = propNames[p];
                stats = cvg[prop];
                for (var num in stats) {
                    if (prop === 'b') {
                        stats[num] = [0, 0];
                    }
                    else {
                        stats[num] = 0;
                    }
                }
            }
        }
    }

    // ----------------------------------------------------------------------------
    // Internal API used by test runners to report results and progress

    /**
     * @class ST.status
     * @singleton
     * @private
     */
    ST.status = {
        addResult: function (result) {
            var current = ST.Test.current;

            if (!current) {
                throw new Error('Not running a test - cannot report results.');
            }

            current.addResult(result);
        },

        runStarted: function (info) {
            ST.sendMessage({
                type: 'testRunStarted',
                testIds: ST.testIds
            });
        },

        runFinished: function (info) {
            ST.sendMessage('testRunFinished');
        },

        //-----------------------------
        // Structure reporting methods

        suiteEnter: function (info) {
            var message = {
                type: 'testSuiteEnter',
                name: info.name,
                id: info.id,
                fileName: info.fileName
            };

            if (info.disabled) {
                message.disabled = true;
            }

            ST.sendMessage(message, info.callback);
        },

        testAdded: function (info) {
            var message = {
                type: 'testAdded',
                name: info.name,
                id: info.id,
                testDef: info
            };

            if (info.disabled) {
                message.disabled = true;
            }

            ST.sendMessage(message, info.callback);
        },

        suiteLeave: function (info) {
            ST.sendMessage({
                type: 'testSuiteLeave',
                id: info.id,
                name: info.name
            }, info.callback);
        },

        //-----------------------------
        // Run results methods

        suiteStarted: function (info) {
            ST.sendMessage({
                type: 'testSuiteStarted',
                id: info.id,
                name: info.name
            }, info.callback);
        },

        suiteFinished: function (info) {
            var suite = ST.Test.current;

            if (!suite) {
                throw new Error('No current suite to finish');
            }

            ST.sendMessage({
                type: 'testSuiteFinished',
                id: info.id,
                name: info.name
            }, info.callback);
        },

        testStarted: function (info) {
            ST.sendMessage({
                type: 'testStarted',
                id: info.id,
                name: info.name
            }, info.callback);
        },

        testFinished: function (info) {
            ST.checkGlobalLeaks();

            ST.sendMessage({
                type: 'testFinished',
                id: info.id,
                name: info.name,
                disabled: info.disabled,
                passed: info.passed,
                expectations: info.expectations
            }, info.callback);
        },

        duplicateId: function (info) {
            ST.sendMessage({
                type: 'duplicateId',
                id: info.id,
                fullName: info.fullName
            });
        }
    };

    ST.addController(Controller);

    ST.Element.on(window, 'error', function(e) {
        if (failOnError) {
            ST.Test.current.addResult({
                passed: false,
                message: e.message || e
            });
        }
    });
})();
