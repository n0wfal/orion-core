"use strict";

var Pool = require('orion-core/lib/model/farm/Pool');
var EmbeddedBrowser = require('orion-core/lib/model/browser/Embedded');
var ChildProcessTask = require('orion-core/lib/tasks/ChildProcessTask');
var webdriverio = require('webdriverio');
var Farm = require('./Farm');
var path = require('path');
var selenium = require('selenium-standalone');
var util = require('util');
var instance;
var seleniumHub, seleniumNode;

class Embedded extends Farm {

    ctor() {
        var data = this.data;
        data.port = data.port || 4444;
        this.seleniumBasePath = Studio.filesDir.join('.selenium').path;
    }

    get connectionDisplay () {
        return 'Embedded Selenium Server';
    }

    add (pool) {
        if (pool.farm) {
            if (pool.farm === this) {
                return;
            }

            pool.farm.remove(pool);
        }
        // add staic embedded browser to the list; others can be added by user
        pool.add(new EmbeddedBrowser({
            browserName: 'chromium',
            displayName: 'Embedded',
            detected: true,
            sencha: {
                concurrency: 1
            }
        }));

        pool.farm = this;

        this.pools.push(pool);
    }

    get browserClass() {
        return EmbeddedBrowser;
    }
    
    getPool () {
        return this.pools[0];
    }

    driverConfig(browserData) {
        var me = this,
            data = {},
            electronPath;

        data = Object.assign(data, browserData);

        if (data.detected) {
            try {
                // Studio running from source
                electronPath = require('electron-prebuilt');
            } catch (e) {
                // Studio running from binary
                electronPath = process.env._;
                
                if (Util.isMac) {
                    let binPath = '/Contents/MacOS/Sencha Studio';
                    if (electronPath.indexOf(binPath) < 0) {
                        electronPath = path.join(electronPath, binPath);
                    }
                }
            }
            data = {
                browserName: 'chrome',
                chromeOptions: {
                    binary: electronPath,
                    args: ['--embedded']
                }
            };
        }

        return {
            host: 'localhost',
            port: 4444,
            desiredCapabilities: data
        };
    }

    startHub () {
        var me = this;
        return new Promise(function (resolve, reject) {
            // start selenium in the hub role
            selenium.start({
                version: '2.53.1',
                seleniumArgs: ['--', '-role', 'hub'],
                basePath: me.seleniumBasePath,
                drivers: {} // no default drivers for the hub
            }, function (err, child) {
                if (err) {
                    reject(err);
                } else {
                    me.seleniumHub = child;
                    resolve(me);
                }
            });
        });
    }

    startNode (hubHost, hubPort) {
        var me = this,
            hubHost = hubHost || 'http://localhost',
            hubPort = hubPort || 4444,
            hubUrl = util.format('%s:%s/grid/register', hubHost, hubPort);

        return new Promise(function (resolve, reject) {
            selenium.start({
                version: '2.53.1',
                seleniumArgs: ['--', '-role', 'node', '-hub', hubUrl],
                // we need the chrome driver for the embedded electron browser
                drivers: {
                    chrome: {
                        version: '2.22'
                    }
                },
                basePath: me.seleniumBasePath
            }, function (err, child) {
                if (err) {
                    reject(err);
                } else {
                    me.seleniumNode = child;
                    resolve(child);
                }                    
            });
        });
    }

    start () {
        var me = this;
        
        return new Promise(function(resolve, reject) {
            var task = me._task;

            if (!task) {
                task = me._task = new ChildProcessTask({
                    description: 'Embedded Selenium Hub',
                    launchProcess: function(){
                        return new Promise(function (resolve, reject) {
                            me.startHub()
                                .then(function () {
                                    return me.startNode();
                                })
                                .then(function (node) {
                                    resolve(node);
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

    stop () {
        var me = this,
            task = me._task;
        if (task) {
            task.stop();
        }

        if (me.seleniumHub) {
            // killing the hub will take down any running nodes connected to it
            me.seleniumHub.kill();
        }
    }
}

module.exports = Embedded;
