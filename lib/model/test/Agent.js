"use strict";

var util = require('util');
var Observable = require('orion-core/lib/Observable')

/**
 * This class represents a browser instance that is connected to Orion via a reverse-proxy
 * Server instance.
 */
class Agent extends Observable {

    /**
     * @cfg {Number} id
     * Unique identifier for this Agent
     */

    /**
     * @cfg {UserAgent} userAgent
     * The UserAgent associated with this Agent
     */

    /**
     * @cfg {AgentGroup}
     * The AgentGroup that this agent belongs to
     */

    /**
     * @cfg {Number} [timeout=25000]
     * Number of milliseconds to leave each request open before sending an empty response
     * if no messages are received.
     */

    /**
     * @cfg {String} url
     * Url to use when launching this agent (remote only)
     */

    /**
     * @cfg {String[]} testIds
     * Ids of suites and specs that this agent will run when startTestRun is invoked
     */

    ctor() {
        var me = this;

        me.isAgent = true;

        if (!me.timeout) {
            me.timeout = 25000;
        }

        me.isRunning = false;
        me.sequence = 0;
        me._messages = [];
        me._callBacks = {};
        me._messageSeq = 0;
        me.lastConnectionOpenTime = 0;
        me.lastConnectionCloseTime = 0;
    }

    /**
     * Creates a promise that will resolve with an array of message objects
     * for the agent as soon as one or more are available
     * @returns {Promise}
     */
    getMessages () {
        var me = this;

        return new Promise(function(resolve, reject){
            var messages = me._messages,
                complete = function(flushMessages) {
                    me.onConnectionClose();

                    if (flushMessages) {
                        me._messages = [];
                        resolve(messages);
                    }
                };
            if (messages.length) {
                complete(true);
            } else {
                me._messageHandler = function(flushMessages) {
                    me._messageHandler = null;
                    clearTimeout(me._flushTimeoutId);
                    me._flushTimeoutId = null;
                    complete(flushMessages !== false);
                };

                me._flushTimeoutId = setTimeout(me._messageHandler, me.timeout);
            }
        });
    }

    beforeRegister () {
        if (this._connectionCloseTimeout) {
            // If there is a pending timeout for lost connection it probably means the
            // user refreshed the browser directly.  In this case we want to go ahead
            // and give interested parties a chance to clean up state from the previous
            // connection before proceeding.
            clearTimeout(this._connectionCloseTimeout);
            this.fire('lostconnection');
        }
    }
    
    onRegister () {
        return Promise.resolve();
    }

    /**
     * Called whenever a connection from an agent is opened, either through the messages
     * or updates channel
     * @param {http.ServerResponse} response
     */
    onConnectionOpen (response) {
        var me = this;

        me.lastConnectionOpenTime = +new Date();

        clearTimeout(me._connectionCloseTimeout);

        response.once('close', function() {
            // Connection closed by agent - invoke the message handler so that we close out
            // the response object we are holding in memory, but pass false so that we do
            // not attampt to flush pending messages - the agent is gone and we can only
            // flush messages if and when its heartbeat resumes. Message handler may not be
            // present in case a timeout ocurred and it was already invoked.
            if (me._messageHandler) {
                me._messageHandler(false);
            }

            me.onConnectionClose();

            me._connectionCloseTimeout = setTimeout(function() {
                // Agent terminated the connection - usually means the browser tab or window
                // was closed.  We need to provide an opportunity for interested parties
                // to clean up state (e.g. test run reporter).
                // Wait a second first to see if the agent reconnects (probably will never
                // happen but doesn't hurt to be sure)
                if (!me._lostConnection && !me.terminated) {
                    // only fire lostconnection once. (avoid firing for both messages and
                    // updates channels if both connections are lost, e.g. when remote
                    // agent is terminated)
                    me.fire('lostconnection');
                    me._lostConnection = true;
                }
            }, 1000);
        });
    }

    /**
     * Called whenever a connection from an agent is closed.  This can happen when
     * the "updates" or "messages" response object fires the "close" event, or when we
     * respond to a messages request from the agent.
     */
    onConnectionClose () {
        this.lastConnectionCloseTime = +new Date();
    }

    /**
     * Instructs the Agent's browser to begin a test run
     * @param {Number} runId Unique id for the run
     * @param {String[]} [testIds] Ids of suites and/or specs to run (defaults to the
     * value of the testIds instance variable).  If omitted, and the instance variable
     * is not set, all suites and specs will run.
     * @param {Boolean} reload Causes a browser reload before the test run starts
     */
    startTestRun(runId, testIds, reload) {
        var me = this,
            ids = testIds || me.testIds,
            message = {
                type: 'startTestRun',
                runId: runId,
                reload: !!reload
            },
            runner = me.runner,
            testOptions = runner.getTestOptions();

        me.isRunning = true;

        if (ids) {
            message.testIds = ids;
        }
        
        Object.assign(testOptions, me.getTestOptions());
        message.testOptions = testOptions;

        // put this message at the beginning of the queue so it goes before any pending reload messages
        me.sendMessage(message, true);
    }
    
    getTestOptions() {
        return { };
    }

    /**
     * Sends a message to the Agent browser
     * @param {Object} message
     */
    sendMessage(message, first, callback) {
        if (first && typeof first === 'function') {
            callback = first;
            first = null;
        }

        callback = callback || message.callback;
        delete message.callback;
        message.seq = ++this._messageSeq;

        if (first) {
            this._messages.unshift(message);
        } else {
            this._messages.push(message);
        }

        if (callback) {
            this._callBacks[message.seq] = callback;
            message.responseRequired = true;
        }

        // Messages is sent immediately if we have a response object.
        // If we do not have a response object it likely means we just sent a response
        // and are waiting for the Agent browser to initiate a new request - in which
        // case the message is queued and will be sent when the new request arrives
        this.flushMessages();
    }

    flushMessages() {
        if (this._messageHandler) {
            this._messageHandler();
        }
    }

    validateSequence(sequence) {
        if (sequence != ++this.sequence) {
            var message = util.format('Unexpected message sequence %d (expected: %d)', sequence, this.sequence);
            throw new Error(message);
        }
    }

    /**
     * Reloads an agent (triggers a location.reload())
     */
    reload() {
        this.sendMessage({
            type: 'reload'
        });
    }

    /**
     * Redirects the agent to a url, or a port/page relative to existing location.origin
     * @param {Object} config
     * @param {String} [config.url]
     * @param {String} [config.port]
     * @param {String} [config.page
     */
    redirectTo (config) {
        this.sendMessage({
            type: 'redirect',
            url: config.url,
            port: config.port,
            page: config.page
        });
    }

    isSupportedMessage (type) {
        return this.supportedMessages[type];
    }

    dispatch (message) {
        var me = this,
            type = message.type,
            result, isErr;
        try {
            if (me.isSupportedMessage(type) && me[type]) {
                result = me[type](message)
            }
        } catch (err) {
            result = (err.stack || err).toString();
            isErr = true;
        }
        if (message.responseRequired) {
            return new Promise(function(resolve, reject){
                if (result && typeof result.then === 'function') {
                    result.then(function(res){
                        resolve({
                            type: 'response',
                            responseSeq: message.seq,
                            value: res
                        });
                    }).catch (function(err) {
                        resolve({
                            type: 'response',
                            responseSeq: message.seq,
                            error: err.message
                        });
                    });
                } else {
                    resolve({
                        type: 'response',
                        responseSeq: message.seq,
                        value: isErr ? null : result,
                        error: isErr ? result : null
                    });
                }
            });
        }
        else if (isErr) {
            // if we're not capturing the result for a response message, log
            // any generated errors to the console to indicate somewhere that something
            // went wrong
            console.error(result);
        }
    }

    // ************************** Message Handlers **************************

    response (message) {
        var me = this,
            seq = message.responseSeq;
        if (me._callBacks[seq]) {
            try {
                me._callBacks[seq](message.value, message.error);
            } finally {
                delete me._callBacks[seq];
            }
        }
    }

    testRunFinished (message) {
        var me = this;

        me.isRunning = false;
        if (me.terminateOnFinish) {
            me.terminate();
        }
    }
    
    terminate () {
        var me = this,
            browser = me.browser;
        
        if (browser && browser.terminate) {
            browser.terminate();
        }
        
        me.fire({
            type: 'terminated',
            agent: me
        });
    }
    
    screenshot(data) {
        var me = this;
        
        if (me.archiver && me.archiver.enableScreenshots) {
            return me._screenshot().then(function (screenshotBase64) {
                if (screenshotBase64) {
                    let base64data = screenshotBase64.replace(/^data:image\/png;base64,/, "");
                    let screenshot = new Buffer(base64data, 'base64');
                    return me.archiver.saveScreenshot(data.name, screenshot, me);
                }
            });
        }
    }
    
    _screenshot() {
        var browser = this.browser;
        if (browser && browser.screenshot) {
            return browser.screenshot();
        } else {
            return Promise.resolve();
        }
    }
    
    log (message) {
        console.log(message.message);
    }

}

Agent.prototype.supportedMessages = {
    log: 1,
    response: 1,
    screenshot: 1,
    testRunStarted: 1,
    testRunFinished: 1
};

module.exports = Agent;
