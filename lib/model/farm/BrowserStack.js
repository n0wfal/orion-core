"use strict";

var BrowserStackTunnel = require('browserstacktunnel-wrapper');
var BrowserStackClient = require('browserstack');
var util = require('util');
var webdriverio = require('webdriverio');

var BrowserStackBrowser = require('orion-core/lib/model/browser/BrowserStack');
var ChildProcessTask = require('orion-core/lib/tasks/ChildProcessTask');
var Farm = require('./Farm');

class BrowserStack extends Farm {
    
    ctor() {
        var data = this.data;
        data.host = data.host || 'hub.browserstack.com';
        data.port = data.port || 80;
    }
    
    get connectionDisplay () {
        return 'BrowserStack Tunnel';
    }

    get browserClass() {
        return BrowserStackBrowser;
    }
    
    get displayInfo () {
        return {
            displayName: 'BrowserStack',
            iconClass: 'browserstack',
            trialURL: 'https://www.browserstack.com/users/sign_up'
        }
    }
    
    /*
    A man looks at the menu of a restaurant and reads: "hamburger"
    Waiter:   What can I get for you, Sir?
    Costumer: Hamburger, please.
    Waiter:   What do you mean?
    Costumer: Hamburger (and points to the menu).
    Waiter:   Ah, you mean a disc of ground meat between the top and bottom part
              of a bun sliced in a half?
    Costumer: Ahmmm... yeah, that thing.
    Waiter:   How do you like it cooked sir?
    Costumer: Medium rare, please.
    
    Half hour later....
    
    Waiter:   Your order was refused sir, we don't have a medium rare option your choice.
    Costumer: What? No medium-rare burger?
    Waiter:   Burger? You mean a disc of ground beat between...
    Costumer: Yeah, yeah, that one.
    Waiter:   What can I bring you instead?
    Costumer: May I have potatoes sliced in sticks, deep fried in vegetable oil?
    Waiter:   Not sure if I'm following you, Sir. Why don't you simply ask for 'french fries'? 
     */
    
    driverConfig(browserData) {
        var me = this,
            data = { },
            browserstack, keys;
        
        Object.assign(data, browserData);
        
        data['browserstack.user'] = me.username;
        data['browserstack.key'] = me.accessKey;
        
        browserstack = data.browserstack || {};
        delete data.browserstack;
        
        // we need to flatten all browserstack.* properties
        keys = Object.keys(browserstack);
        for (let key of keys) {
            data['browserstack.' + key] = browserstack[key];
        }
        
        return {
            host: me.hostName,
            port: me.port,
            desiredCapabilities: data
        };
    }
    
    start() {
        var me = this;
        
        return new Promise(function(resolve, reject) {
            var task = me._task;

            if (!task) {
                var tunnel = me._tunnel = new BrowserStackTunnel({
                    key: me.accessKey,
                    hosts: [{
                        name: 'localhost',
                        port: 8000,
                        sslFlag: 0
                    }]
                });

                task = me._task = new ChildProcessTask({
                    description: 'BrowserStack Tunnel',
                    launchProcess: function(){
                        return new Promise(function(resolve, reject){
                            tunnel.start(function(err){
                                if (err) {
                                    reject(err);
                                } else {
                                    resolve(tunnel.tunnel);
                                }
                            });
                        });
                    }
                });

                me.onTaskStart(task);

                task.on({
                    scope: me,
                    complete: function() {
                        me.onTaskStop();
                        me._task = null;
                        me._tunnel = null;
                    }
                });
            }

            if (task.running) {
                resolve(task);
            } else {
                task.on({
                    scope: me,
                    single: true,
                    running: function() {
                        resolve(task);
                    }
                });
            }
        });
    }
    
    stop() {
        var task = this._task;

        if (task) {
            task.stop();
        }
    }
    
    getBrowsers() {
        var me = this;

        return new Promise(function(resolve, reject) {
            me._getAcccount().getBrowsers(function(err, res) {
                if (err) {
                    reject(err);
                } else {
                    var converted = res.map(function (entry) {
                        return new BrowserStackBrowser({
                            browser: entry.browser,
                            browser_version: entry.browser_version,
                            os: entry.os,
                            os_version: entry.os_version,
                            device: entry.device
                        });
                    });

                    resolve(converted);
                }
            });
        });
    }
    
    _getAcccount() {
        var me = this;
        return me._account || (me._account = BrowserStackClient.createClient({
                username: me.get('username'),
                password: me.get('accessKey')
            }));
    }
    
}

module.exports = BrowserStack;
