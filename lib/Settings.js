'use strict';

const File  = require('./fs/File');
const xfs   = require('./xfs');
const Base  = require('./Base');
const Json  = require('./Json');
const Util  = require('./Util');

const DEFAULT = {};

class Settings extends Base {
    static get meta () {
        return {
            prototype: {
                isSettings: true,

                defaults: {
                    //
                },
                fileName: 'settings.json',
                filePath: xfs.profileDir,

                validators: {
                    //
                }
            }
        };
    }

    ctor () {
        var me = this,
            defaults = me.defaults,
            settings = Util.clone(defaults),
            props = me.props,
            file;

        try {
            if (props) me.filePath = props.getSettingsDir();

            me.filePath = File.get(me.filePath);
            me.filePath.ensurePathExistsSync();

            me._file = file = me.filePath.join(me.fileName);

            me.settings = Json.readSync(file.getPath());
            me.settings = Util.merge(settings, me.settings);

            me.validate();
        }
        catch (e) {
            (me.logger || console).error(e.message);

            me.settings = settings;
            me.save();
        }
    }

    flush () {
        if (this._saveTimer) {
            this.save();
        }
    }

    get (prop) {
        var settings = this.settings;

        return prop ? settings[prop] : settings;
    }

    set (props, value) {
        var settings = this.settings,
            name, value;

        if (typeof props === 'string') {
            props = {
                [props]: value
            };
        }

        for (name in props) {
            value = props[name];

            if (value === undefined) {
                delete settings[name];
            } else {
                settings[name] = value;
            }
        }
    }

    save () {
        var me = this,
            settings = me.validate();

        if (me._saveTimer) {
            clearTimeout(me._saveTimer);
            me._saveTimer = null;
        }

        settings = me.removeDefaults(Util.clone(settings), me.defaults);

        Json.writeSync(this._file.getPath(), settings);

        return this;
    }

    saveSoon () {
        var me = this;

        if (me._saveTimer) {
            clearTimeout(me._saveTimer);
        }

        me._saveTimer = setTimeout(me.onSaveTick.bind(me), 1000);
    }

    //------------------------------------------------------
    // Internals

    onSaveTick () {
        this._saveTimer = null;
        this.save();
    }

    removeDefaults (settings, defaults) {
        var me = this,
            count, name;

        if (settings === defaults) {
            return DEFAULT;
        }

        if (defaults != null) {
            if (Array.isArray(settings)) {
                if (Array.isArray(defaults)) {
                    count = settings.length;

                    settings.forEach(function (el, index) {
                        if (DEFAULT === me.removeDefaults(el, defaults[index])) {
                            --count;
                        }
                    });

                    if (!count) {
                        // If no element came back as non-default, then this array
                        // is DEFAULT
                        return DEFAULT;
                    }
                }
            }
            else if (settings != null && typeof settings === 'object' &&
                     typeof defaults === 'object') {
                count = 0;

                for (name in settings) {
                    if (DEFAULT === me.removeDefaults(settings[name], defaults[name])) {
                        delete settings[name];
                    } else {
                        ++count;
                    }
                }

                if (!count) {
                    return DEFAULT;
                }
            }
        }

        return settings;
    }

    validate () {
        return this._validate(this.settings, this.validators);
    }

    _validate (settings, validators) {
        var me = this,
            ret = settings,
            isFunc = (typeof validators === 'function'),
            i, n, vfn, value;

        if (settings && settings.constructor === Object) {
            if (isFunc) {
                settings = validators(settings);
                validators = null;
            } else if (!(validators && validators.constructor === Object)) {
                validators = null;
            }

            for (n in settings) {
                settings[n] = me._validate(settings[n], validators && validators[n]);
            }
        }
        else if (settings && Array.isArray(settings)) {
            if (isFunc) {
                vfn = validators;
                validators = null;
            } else if (!Array.isArray(validators)) {
                validators = null;
            }

            for (i = 0, n = settings.length; i < n; ++i) {
                value = settings[i];
                settings[i] = vfn ? vfn.call(me, value)
                                  : me._validate(value, validators && validators[i]);
            }
        }
        else if (isFunc) {
            ret = validators.call(me, ret);
        }

        return ret;
    }
}

module.exports = Settings;
