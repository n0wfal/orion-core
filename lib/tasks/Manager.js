'use strict';

var Observable = require('../Observable');

class Manager extends Observable {

    constructor(cfg) {
        super();
        var me = this;
        Object.assign(me, cfg);
        me.tasks = {};
        process.on('beforeExit', me.cleanupTasks.bind(me));
        process.on('exit', me.cleanupTasks.bind(me));
    }

    cleanupTasks () {
        var me = this;
        for (var name in me.tasks) {
            try {
                me.tasks[name].stop();
            } catch (err) {
                // ignore
            }
        }
    }

    getTask (id) {
        if (typeof id !== 'string') {
            id = id.id || id.taskId;
        }
        return this.tasks[id];
    }

    addTask (task) {
        var me = this;
        me.tasks[task.id] = task;
        me.fire({
            type: 'taskCreated',
            task: task
        });
        task.on({
            scope: this,
            complete: function() {
                me.removeTask(task);
            }
        });

    }

    removeTask (task) {
        var me = this;
        me.tasks[task.id] = null;
        me.fire({
            type: 'taskRemoved',
            task: task
        });
    }

}

module.exports = new Manager();