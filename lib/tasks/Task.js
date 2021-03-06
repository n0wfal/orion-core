'use strict';

var Observable = require('../Observable'),
    Manager = require('./Manager'),
    uuid = require('uuid');

class Task extends Observable {
    static get meta () {
        return {
            prototype: {
                internal: false,
                htmlFormatMessages: false
            }
        };
    }

    ctor () {
        this.id = this.id || uuid.v1();

        Manager.addTask(this);
    }

    _set(name, value) {
        var me = this,
            old = me[name];

        if (old != value) {
            if (me.record) {
                me.record.set(name, value);
                me.record.commit();
            }
            me[name] = value;
            me.fire({
                type: 'change',
                property: name,
                old: old,
                value: value
            });
            if(name === 'complete' && value == true ) {
                me.fire('complete');
            }
        }
    }

    setDescription (description) {
        this._set('description', description);
    }

    done () {
        var me = this;

        me._set('stopped', true);
        me._set('running', false);
        me._set('complete', true);
    }

    stop () {
        this.done();
    }

    getRecordData () {
        var me = this;
        return {
            id: me.id,
            internal: me.internal,
            description: me.description,
            running: me.running
        }
    }

    setInternal (isInternal) {
        this._set("internal", isInternal);
    }

    _log (message, level) {
        var me = this;

        if (typeof message === 'string') {
            message = {
                message: message,
                level: level || 'info',
                time: new Date().getTime(),
                description: me.description
            }
        } else {
            message.level = level || message.level;
        }

        if (me.htmlFormatMessages) {
            message.message = (message.rawMessage = message.message)
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/\n/g, '<br>');
        }

        this.fire({
            type: 'logMessage',
            message: message
        });

        return message;
    }

    warn (message) {
        this._log(message, 'warn');
    }

    info (message) {
        this._log(message, 'info');
    }

    error (message) {
        this._log(message, 'error');
    }
}

Task.prototype.isTask = true;

module.exports = Task;