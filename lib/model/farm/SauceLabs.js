"use strict";

var sauceConnectLauncher = require('sauce-connect-launcher');
var util = require('util');
var SauceLabsClient = require('saucelabs');

var SauceLabsBrowser = require('orion-core/lib/model/browser/SauceLabs');
var ChildProcessTask = require('orion-core/lib/tasks/ChildProcessTask');
var Farm = require('./Farm');

class SauceLabs extends Farm {
    
    ctor() {
        var data = this.data;
        data.host = data.host || 'ondemand.saucelabs.com';
        data.port = data.port || 80;
    }
    
    get connectionDisplay () {
        return 'SauceLabs Tunnel';
    }

    get displayInfo () {
        return {
            displayName: 'Sauce Labs',
            iconClass: 'saucelabs',
            trialURL: 'https://saucelabs.com/signup/trial'
        }
    }
    
    get browserClass () {
        return SauceLabsBrowser;
    }
    
    get hostName() {
        return util.format('%s:%s@%s', this.username, this.accessKey, this.host);
    }
    
    start() {
        var me = this;
        
        return new Promise(function(resolve, reject) {
            var task = me._task;

            if (!task) {
                task = me._task = new ChildProcessTask({
                    description: 'SauceLabs Connect Tunnel',
                    launchProcess: function(){
                        return new Promise(function(resolve, reject){
                            // defer execution to next event loop to that ensure
                            // 'task' is defined when 'logger()' is first called
                            process.nextTick(function () {
                                sauceConnectLauncher({
                                    username: me.get('username'),
                                    accessKey: me.get('accessKey'),
                                    verbose: true,
                                    logger: function(data) {
                                        task.onStdoutData(data);
                                    }
                                }, function (err, tunnel) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        me._tunnel = tunnel;
                                        resolve(tunnel);
                                    }
                                });
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
            me._getAcccount().getAllBrowsers(function(err, res) {
                if (err) {
                    reject(err);
                } else {
                    var browsers = res.map(function (entry) {
                        return new SauceLabsBrowser({
                            browserName: entry.api_name,
                            version: entry.short_version,
                            platform: entry.os
                        });
                    });

                    resolve(browsers);
                }
            });
        });
    }
    
    _getAcccount() {
        return this._account || (this._account = new SauceLabsClient(this.username, this.accessKey));
    }
    
}

module.exports = SauceLabs;
