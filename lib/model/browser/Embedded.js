'use strict';

const os = require('os');
const path = require('path');
const fork = require('child_process').fork;
const spawn = require('child_process').spawn;
const util = require('util');

const ChildProcessTask = require('orion-core/lib/tasks/ChildProcessTask');
const Generic = require('orion-core/lib/model/browser/Generic');
const Observable = require('orion-core/lib/Observable');
const Util = require('orion-core/lib/Util');
const xfs = require('orion-core/lib/xfs');

const console = require('orion-core/lib/util/console-manager').console;

const allowedMessages = {
    windowCreated: 1,
    windowLoaded: 1,
    windowClosed: 1
}

class Embedded extends Generic {
    
    static get meta () {
        return {
            prototype: {
                isEmbeddedBrowser: true,
                isDebuggable: true,
                portSeed: 9222
            }
        };
    }

    launch (opts) {
        var me = this,
            parentDir = path.join(__dirname, '..'),
            electronPath,
            params = [],
            task,
            cwd;
        
        try {
            // Studio running from source
            electronPath = require('electron-prebuilt');
            params.push(path.join(process.mainModule.filename, '..', 'studio.js'));
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
        
        console.log('Launching embedded browser from ' + electronPath);
        
        params.push('--embedded');
        
        params.push('--url');
        params.push(opts.url);
        
        params.push('--port');
        params.push(me.devToolsPort = me.portSeed++);
        
        // if (!me.data.headless) {
            params.push('--show');
        // }
        
        var opts = {
            execPath: electronPath,
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        }
        
        task = me.task = new ChildProcessTask({
            description: 'Embedded Electron',
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
        
        return task;
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
        me.task.stop();
        me.fire({
            type: 'terminated',
            browser: me
        });
    }

    canPersist () {
        return !this.data.detected;
    }
}

module.exports = Embedded;
