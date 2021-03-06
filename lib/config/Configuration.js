'use strict';

var Json = require('../Json');
var fs = require('fs');
var xfs = require('../xfs');
var path = require('path');

class Configuration {
    constructor () {
        this._data = {};
        this._parent = null;
    }

    /**
     * Returns the value of the requested key(s). If `key` is an array of key names, the
     * values of those keys are returned in an array with corresponding indexes of values
     * to key names. If `key` is an object, the values of the keys present in that object
     * are placed in a new object and returned.
     *
     *      var v = config.get('foo');  // value of 'foo' property
     *
     *      var a = config.get(['foo', 'bar']);
     *      // Same as:
     *      //  a = [ config.get('foo'), config.get('bar') ];
     *
     *      var o = config.get({ foo: 1, bar: 1 });
     *      // Same as:
     *      // o = { foo: config.get('foo'), bar: config.get('bar') };
     *
     * @param {String/String[]/Object} key The key or keys desired.
     * @return {String/Array/Object}
     */
    get (key) {
        var me = this,
            data = me._data,
            parent = me._parent,
            name, ret;

        if (typeof key === 'string') {
            if (data.hasOwnProperty(key)) {
                ret = data[key];
            }
            else if (parent) {
                ret = parent.get(key);
            }
        }
        else if (key) {
            if (Array.isArray(key)) {
                ret = [];

                key.forEach(k => {
                    ret.push(me.get(k));
                });
            }
            else {
                ret = {};

                for (name in key) {
                    ret[name] = me.get(name);
                }
            }
        }

        return ret;
    }

    /**
     * Sets a value given a key or an object of key/value pairs and returns the previous
     * value of the key(s).
     *
     * @param {String/Object} key The key name or an object of key/value pairs.
     * @param value The value of the `key` if `key` is a String.
     * @return {Mixed}
     */
    set (key, value) {
        var prev = this.get(key),
            data = this._data;

        if (typeof key === 'string') {
            if (value === undefined) {
                delete data[key];
            } else {
                data[key] = value;
            }
        }
        else {
            Object.assign(data, key);
        }

        return prev;
    }

    get parent () {
        return this._parent;
    }

    set parent (v) {
        this._parent = v;
    }

    load (file) {
        var me = this;

        if (file.endsWith('.json')) {
            return Json.read(file).then(function (data) {
                me.set(data);
                return me;
            });
        }

        return new Promise(function(resolve, reject) {
            fs.readFile(file, 'utf8', function (error, content) {
                if (error) {
                    reject(xfs.wrapError(file, error));
                } else {
                    try {
                        me.parseProperties(content);
                        resolve(me);
                    } catch (e) {
                        reject(xfs.wrapError(file, e));
                    }
                }
            });
        });
    }

    loadSync (file) {
        try {
            var data;

            if (file.endsWith('.json')) {
                data = Json.readFileSync(file);

                this.set(data);
            } else {
                data = fs.readFileSync(file, 'utf8');
                this.parseProperties(data);
            }

            return true;
        }
        catch (e) {
            return false;
        }
    }

    parseProperties (data) {
        var i, key, line, equal;

        data = data.split('\n');

        for (i = 0; i < data.length; ++i) {
            line = data[i].trim();
            if (line && !line.startsWith('#')) {
                equal = line.indexOf('=');
                if (equal > 0) {
                    key = line.substring(0, equal).trim();

                    this._data[key] = line.substring(equal+1);  // no trim here
                }
            }
        }
    }

    /**
     * Gets the relative path to the directory where settings are stored within the Sencha home directory
     * @return {String}
     */
    getSettingsDir() {
        const appVer = parseInt(this.get('app.version'), 10).toString();
        const shortName = this.get('app.shortName');
        return path.join(xfs.profileDir.path, shortName, appVer);
    }

    /**
     * Returns the path to the log file
     * @return {String}
     */
    getLogFile() {
        return path.join(this.getSettingsDir(), `${this.get('app.shortName')}.log`);
    }
}

Configuration.prototype.isConfiguration = true;

module.exports = Configuration;
