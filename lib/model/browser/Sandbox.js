'use strict';

const os = require('os');
const path = require('path');
const fork = require('child_process').fork;
const spawn = require('child_process').spawn;
const util = require('util');

const ChildProcessTask = require('orion-core/lib/tasks/ChildProcessTask');
const Browser = require('orion-core/lib/model/browser/Local');
const Observable = require('orion-core/lib/Observable');
const xfs = require('orion-core/lib/xfs');

const console = require('orion-core/lib/util/console-manager').console;

const allowedMessages = {
    windowCreated: 1,
    windowLoaded: 1,
    windowClosed: 1
}

class Sandbox extends Browser {
    
    static get meta () {
        return {
            prototype: {
                isSandbox: true,
                isDebuggable: true,
                portSeed: 9222
            }
        };
    }
    
    constructor (config) {
        super(Object.assign({
            description: 'Sandbox',
            version: process.version.chrome || '51',
            profile: '',
            type: 'chromium',
            detected: true
        }, config));
    }

    launch () {
        var me = this,
            parentDir = path.join(__dirname, '..'),
            electronPath,
            params = [],
            task,
            cwd;
        
        try {
            electronPath = require('electron-prebuilt');
            params.push(path.join(process.mainModule.filename, '..', 'studio.js'));
        } catch (e) {
            // production
            electronPath = require(process.env._);
        }
        
        console.log('Launching sandbox from ' + electronPath);
        
        params.push('--sandbox');
        
        params.push('--url');
        params.push(me.get('url'));
        
        params.push('--devtoolsPort');
        params.push(me.devToolsPort = me.portSeed++);        
        
        params.push('--proxyPort');
        params.push(me.get('proxyPort'));
        
        var opts = {
            execPath: electronPath,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        }
        
        task = me.task = new ChildProcessTask({
            description: 'Test Sandbox',
            executable: electronPath,
            args: params,
            stdoutLevel: 'debug',
            opts: opts
        });
        
        var addTaskListeners = function () {
            task.proc.on('message', function (m) {
                var type = m.type || m;
                console.log('Received: %s', type);
                if (allowedMessages[type]) {
                    me.fire(type, m);
                    if (me[type]) {
                        me[type](m);
                    }
                }
            });            
        }
        
        if (task.running) {
            addTaskListeners();
        } else {
            task.on('running', addTaskListeners);
        }
        
        return Promise.resolve();
    }
    
    
    
    screenshot (args) {
        var me = this;
        return new Promise(function (resolve, reject) {
            me._screenshotResolve = resolve;
            me.task.proc.send({
                type: 'screenshot'
            });
        });
    }
    
    terminate () {
        var me = this;
        me.task.proc.send({
            type: 'terminate'
        });
        me.task.stop();
        me.fire({
            type: 'terminated',
            browser: me
        });
    }
    
    getDriverConfig () {
        var browser = this.get('browser'),
            browserData = browser.data,
            farm = browser.pool.farm;
        
        return farm.driverConfig(browserData);
    }

}

module.exports = Sandbox;
