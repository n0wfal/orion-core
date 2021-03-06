'use strict';

var Task = require('./Task'),
    ProcessUtil = require('../process/ProcessUtil'),
    platform = {
        isMac: /^darwin/.test(process.platform),
        isWin: /^win/.test(process.platform)
    };

class ChildProcessTask extends Task {
    static get meta () {
        return {
            prototype: {
                stdoutLevel: 'info',
                stderrLevel: 'error',
                messageRe: /^\[([a-zA-Z]{3})\]/g
            }
        };
    }

    ctor () {
        var me = this;

        me._init().then(function(proc){
            me.proc = proc;

            proc.stdout.on('data', me.onStdoutData.bind(me));
            proc.stderr.on('data', me.onStderrData.bind(me));
            proc.on('error', me.onError.bind(me));
            proc.on('close', me.onClose.bind(me));
            proc.on('exit', me.onExit.bind(me));

            me._set('running', true);
            me.fire('running');
        }).catch(function(err){
            var msg = (err.stack || err).toString();
            me.error(err);
            me._set('running', false);
        });
    }

    _init () {
        var me = this;
        return new Promise(function(resolve, reject) {
            var proc = me.proc;
            if (proc) {
                resolve(proc);
            } else {
                try {
                    proc = me.launchProcess();
                    if (proc instanceof Promise) {
                        proc.then(function(childProcess){
                            resolve(childProcess);
                        });
                    } else {
                        resolve(proc);
                    }
                } catch (err) {
                    reject(err);
                }
            }
        });
    }

    launchProcess () {
        var me = this;
        return ProcessUtil.spawn(me.executable, me.args, me.opts);
    }

    parseMessage (message, level) {
        message = message ? message.trim() : '';

        if (this.cmdFormatted) {
            var messageRe = this.messageRe,
                match = messageRe.exec(message);

            if (match) {
                level = match[1];
                message = message.replace(messageRe, '').trim();
            }
        }

        return {
            message: message,
            level: level
        };
    }

    getLines (message, level) {
        var me = this,
            lines = [],
            messages = message.split("\n");

        messages.forEach(function (message) {
            var res = me.parseMessage(message, level);

            if (res.message) {
                lines.push(res);
            }
        });

        return lines;
    }

    onStdoutData (data) {
        var me = this,
            message = data.toString(),
            level = me.stdoutLevel;

        me.fire({
            type: 'stdout',
            message: message
        });

        me.getLines(message, level).forEach(function(line){
            me.fire({
                type: 'logMessage',
                message: {
                    message: line.message,
                    time: new Date().getTime(),
                    level: line.level,
                    description: me.description,
                    type: 'stdout'
                }
            });
        });
    }

    onStderrData (data) {
        var me = this,
            message = data.toString(),
            level = me.stderrLevel;

        me.fire({
            type: 'stderr',
            message: message
        });
        me.getLines(message, level).forEach(function(line){
            me.fire({
                type: 'logMessage',
                message: {
                    message: line.message,
                    time: new Date().getTime(),
                    level: line.level,
                    description: me.description,
                    type: 'stderr'
                }
            });
        });
    }

    onClose (eCode, signal) {
        var me = this;
        me.exitCode = eCode;
        me.signal = signal;
        me.fire({
            type: 'closed',
            exitCode: eCode,
            signal: signal,
            task: me
        });
        me.done();
    }

    onExit (eCode, signal) {
        var me = this;
        me.exitCode = eCode;
        me.signal = signal;
        me.fire({
            type: 'exit',
            exitCode: eCode,
            signal: signal,
            task: me
        });
    }

    onError (err) {
        this.fire({
            type: 'error',
            error: err,
            task: this
        });
    }

    stop () {
        var me = this,
            proc = me.proc;

        me._set('forcedStopped', true);
        if (me.running) {
            try  {
                ProcessUtil.kill(proc.pid);
                proc.kill();
                me.done();
            } catch (err) {
                console.error(err.stack || err);
            }
        } else {
            me.done();
        }
    }
}

ChildProcessTask.prototype.isChildProcessTask = true;

module.exports = ChildProcessTask;
