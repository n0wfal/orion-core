"use strict";

var co = require('co');
var util = require('util');
var Agent = require('./Agent');

/**
 * This class represents a remote browser launched via WebDriver
 */
class RemoteAgent extends Agent {
    
    static get meta () {
        return {
            prototype: {
                isRemoteAgent: true,
                terminateOnFinish: true
            }
        };
    }

    /**
     * @cfg {WebdriverIO} driver
     * Remote WebDriver instance
     */
    
    /**
     * @cfg {ArchiveReporter} archiver
     * Artifact archiver
     */

    /**
     * @cfg {Number} [keepAliveInterval=30000]
     * Interval at which to send a "keep alive" ping to prevent the agent from timing out.
     */

    ctor() {
        var me = this;

        me.retries = me.retries || 2;
        //me.connRetries = me.connRetries || 3;
        
        me.connRetryInterval = me.connRetryInterval || (2 * 1000); 
        me.keepAliveInterval = me.keepAliveInterval || (30 * 1000);
        
        me.connectionTimeout   = me.connectionTimeout   || me.remoteTimeout || (5 * 60 * 1000);
        me.registrationTimeout = me.registrationTimeout || me.remoteTimeout || (2 * 60 * 1000);
        me.idleTimeout         = me.idleTimeout         || me.remoteTimeout || (2 * 60 * 1000);
    }
    
    loadDriver() {
        var me = this,
            farm = me.farm,
            browserData = me.agentGroup.browser.data,
            driver;
        
        driver = me.driver = farm.remoteDriver(browserData);
        return driver;
    }
    
    screenshot(data) {
        var me = this,
            driver = me.driver;

        // For now we do not take screenshots during local runs (when there is no archiver)
        // TODO: make screenshots work for local runs.
        if (me.archiver && me.archiver.enableScreenshots) {
            return driver.saveScreenshot(function(err, screenshot, response) {
                return me.archiver.saveScreenshot(data.name, screenshot, me);
            });
        }
    }
    
    waitForDriverSessionID() {
        var me = this,
            start = (new Date).getTime(),
            timeout = 2 * 60 * 1000;
        return new Promise(function (resolve, reject) {
            var fn = function() {
                var sessionID = me.driver.requestHandler.sessionID,
                    now = (new Date).getTime();
                if (sessionID) {
                    me.seleniumSessionID = sessionID;
                    resolve(sessionID);
                } else if ((new Date).getTime() - start > timeout) {
                    reject(util.format("[AGENT: %d] Couldn't get Selenium sessionID after 120 seconds", me.id));
                } else {
                    setTimeout(fn, 1000);
                } 
            };
            fn();
        });
    }
    
    testRunStarted(data) {
        // once the agent starts reporting results, it can no longer be restarted
        // otherwise the results will be duplicated
        this.retries = 0;
    }
    
    retry(getYieldable, retries, interval) {
        var times = 0;
        return co(function*() {
            while (retries--) {
                try {
                    yield getYieldable();
                    break;
                } catch (err) {
                    if (!retries) {
                        throw err;
                    }
                    yield function(callback) {
                        setTimeout(callback, interval);
                    }
                }
            }
        });
    }
    
    dispatch(message) {
        this._messageReceived();
        if (!this._failed) {
            return super.dispatch(message);
        }
    }

    /**
     * Launches a remote agent. (Not applicable for local agents)
     */
    launch() {
        var me = this,
            driver = me.loadDriver();
        
        me._failed = false;
        me._watchdogId = setInterval(me._watchdog.bind(me), me.watchdogInterval);
        
        return co(function* () {
            try {
                me._connectionStart = (new Date).getTime();
                yield driver.init();
                me._connectionStart = null;
                
                if (!me._failed) {
                    me._registrationStart = (new Date).getTime();
                    yield driver.url(me.url);
                }
                
                // FIXME get retry (aka soft retry) seems to break the agent registration
                // workflow, causing unexpected exceptions 
                
                //yield me.driver.init();
                //yield me.retry(function () {
                //    return driver.url(me.url);
                //}, me.connRetries, me.connRetryInterval);
            } catch (err) {
                me.fail(err);
            }
        });
    }
    
    onRegister() {
        var me = this;
        me._registrationStart = null;
        me._messageReceived();
        
        return me.waitForDriverSessionID().then(function () {
            me._keepAliveId = setInterval(me._keepAlive.bind(me), me.keepAliveInterval);
        });
    }

    /**
     * Terminates the agent
     */
    terminate() {
        var me = this;
        
        // tell the agent to stop polling, otherwise it will be an unknown agent
        // on its next poll and therefore will be recognized as an ad-hoc local browser
        me.sendMessage({
            type: 'terminated'
        });
        
        return me._shutdown().then(function () {
            me.terminated = true;
            me.fire({
                type: 'terminated',
                agent: me
            });
        });
    }
    
    fail(err) {
        var me = this;
        me._failed = true;
        return me._shutdown().then(function () {
            console.error(err.stack || err);
            me.fire({
                type: 'failed',
                agent: me,
                error: err.stack || err
            });
        });
    }
    
    _shutdown() {
        var me = this,
            driver = me.driver;
        
        return co(function* () {
            try {
                me._keepAliveId != null && clearInterval(me._keepAliveId);
                me._watchdogId != null && clearInterval(me._watchdogId);
                
                me.sessionId = null;
                me.seleniumSessionID = null;
                me._connectionStart = null;
                me._registrationStart = null;
                me._lastMessage = null;
                
                if (driver) {
                    yield driver.end();
                }
            } catch (err) {
                console.error('Error shutting down remote agent');
                console.error(err.stack || err);
            }
        });
    }

    _keepAlive() {
        // Execute an empty function in the agent browser to keep the connection alive
        this.driver.execute(function() {});
    }
    
    _watchdog() {
        var me = this,
            sessionID = me.seleniumSessionID,
            now = (new Date).getTime(),
            lastMessage = me._lastMessage,
            connectionStart = me._connectionStart,
            registrationStart = me._registrationStart,
            connectionTimeout = me.connectionTimeout,
            registrationTimeout = me.registrationTimeout,
            idleTimeout = me.idleTimeout;
        
        if (lastMessage && now - lastMessage > idleTimeout) {
            me.fail(util.format(
                'No communication from remote browser received for %d ms (sessionID: %s)',
                idleTimeout, sessionID));
        } else if (registrationStart && now - registrationStart > registrationTimeout) {
            me.fail(util.format(
                "Agent didn't register within %d ms (sessionID: %s)",
                registrationTimeout, sessionID));
        } else if (connectionStart && now - connectionStart > connectionTimeout) {
            me.fail(util.format("Couldn't allocate browser within %d ms",
                connectionTimeout));
        }
    }
    
    _messageReceived() {
        this._lastMessage = (new Date).getTime();
    }
    

}

module.exports = RemoteAgent;
