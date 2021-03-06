"use strict";

const GenericBrowser = require('orion-core/lib/model/browser/Generic');
const BrowserPool = require('orion-core/lib/model/farm/Pool');
const Entity = require('orion-core/lib/model/Entity');
const Observable = require('orion-core/lib/Observable');

const webdriverio = require('webdriverio');

class Farm extends Entity {
    static get meta () {
        return {
            mixins: [
                Observable
            ]
        };
    }
    
    ctor() {
        var data = this.data;
        data.port = data.port || 4444;
    }
    
    get connectionDisplay () {
        return 'Generic Selenium Farm';
    }

    get displayInfo () {
        return {
            displayName: 'Generic Selenium',
            iconClass: 'selenium'
        }
    }
    
    get browserClass () {
        return GenericBrowser;
    }
    
    get hostName () {
        return this.host;
    }
    
    get username() {
        return this.data.username;
    }
    
    set username(val) {
        this.data.username = val;
    }
    
    get accessKey() {
        return this.data.accessKey;
    }
    
    set accessKey(val) {
        this.data.accessKey = val;
    }
    
    get host() {
        return this.data.host;
    }
    
    get port() {
        return this.data.port;
    }
    
    get sessionCount() {
        return this._sessionCount;
    }
    
    set sessionCount(val) {
        this._sessionCount = val;
    }
    
    get sessionLimit() {
        return this.data.sessionLimit;
    }
    
    get autoStartTunnel() {
        return this.data.autoStartTunnel;
    }
    
    set autoStartTunel(val) {
        this.data.autoStartTunnel = val;
    }
    
    get displayType() {
        return 'Generic';
    }

    ctor () {
        var me = this,
            /**
             * @property {Pool[]} pools
             * The array of browser pool instances for this farm.
             */
            pools = (me.pools = []),
            data = me.data,
            entries = data.pools;

        /**
         * @property {Agent[]} agentQueue
         * An array of agents to launch as soon as sessionCount drops below sessionLimit
         */
        me.agentQueue = [];

        /**
         * @property {Number} sessionCount
         * The number of currently open sessions in this farm
         */
        me.sessionCount = 0;

        if (entries) {
            delete data.pools;
            if (Array.isArray(entries)) {
                entries.forEach(function (poolData) {
                    me.add(new BrowserPool(poolData));
                });
            } else {
                me.error = new Error('The "pools" property must be an array for browser farm "' +
                    data.name + '"');
            }
        }
    }
    
    remoteDriver(browserData) {
        var config = this.driverConfig(browserData);
        return webdriverio.remote(config);
    }
    
    driverConfig(browserData) {
        var config = {
            host: this.hostName,
            port: this.port,
            desiredCapabilities: browserData
        };
        return config;
    }

    add (pool) {
        if (pool.farm) {
            if (pool.farm === this) {
                return;
            }

            pool.farm.remove(pool);
        }

        this.pools.push(pool);
        pool.farm = this;
    }

    eachPool (fn, scope) {
        this.pools.forEach(fn, scope);
    }

    getBrowsers () {
        function range (record, from, to) {
            var ret = [],
                i;

            for (i = from; i <= to; ++i) {
                ret.push(Object.assign({
                    long_version: i + '.0',
                    short_version: i
                }, record));
            }

            return ret;
        }

        // TODO do something better
        // Since we allow the user to enter whatever they way (i.e., these are just
        // helpful hints), we make a basic effort here.
        return Promise.resolve([].concat(
            range({ api_name: 'internet explorer', long_name: 'Internet Explorer', os: 'Windows 7' }, 8, 11),
            range({ api_name: 'firefox', long_name: 'Firefox', os: 'Windows 7' }, 38, 42),
            range({ api_name: 'chrome', long_name: 'Google Chrome', os: 'Windows 7' }, 42, 46),
            range({ api_name: 'safari', long_name: 'Safari', os: 'Mac 10.9' }, 6, 9)
        ));
    }

    getPool (name) {
        var pools = this.pools,
            pool, i;

        name = name.toLowerCase();

        for (i = 0; i < pools.length; ++i) {
            if (name === (pool = pools[i]).getName().toLowerCase()) {
                return pool;
            }
        }

        return null;
    }
    
    getPools (name) {
        var pools = this.pools;
        var matchingPools = [];
        
        for (let i = 0; i < pools.length; i++) {
            let pool = pools[i];
            if (pool.name.toLowerCase().indexOf(name.toLowerCase()) >= 0) {
                matchingPools.push(pool);
            }
        }
        
        return matchingPools;
    }

    remove (pool) {
        var pools = this.pools,
            index = pool;

        if (typeof pool === 'number') {
            pool = pools[index];
        } else {
            index = pools.indexOf(pool);
        }

        if (index >= 0) {
            pools.splice(index, 1);
            pool.farm = pool.workspace = null;
        }

        return pool;
    }

    start () {
        return Promise.resolve();
    }

    stop () {

    }

    onTaskStart (task) {
        var me = this;

        me.isTaskRunning = true;
        me.fire('taskstarted', me);

        task.on({
            scope: me,
            single: true,
            running: function() {
                me.isConnectionRunning = true;
                me.fire('connectionstarted', me);
            }
        });
    }

    onTaskStop () {
        this.isTaskRunning = false;
        this.isConnectionRunning = false;
        this.fire('connectionstopped', this);
        this.fire('taskstopped', this);
    }
}

module.exports = Farm;
