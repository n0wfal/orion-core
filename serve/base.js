(function (ST) {
    var _enumerables = ['valueOf', 'toLocaleString', 'toString', 'constructor'],
        _template = function(){},
        _Base = function(){},
        temp, STArray, STString;

    for (temp in { toString: 1 }) {
        if (temp === 'toString') {
            _enumerables.length = 0;
            break;
        }
    }

    // To distinguish ST instances from Ext JS
    _Base.prototype.$ST = true;

    /**
     * Copies all the properties of `config` to the specified `object`.
     *
     *      ST.apply(obj = {}, { a: 1 });
     *      // obj.a === 1
     *
     * @param {Object} object The receiver of the properties.
     * @param {Object} config The primary source of the properties.
     * @param {Boolean} [own] Pass `true` to limit the copy to `hasOwnProperty` properties
     * of the `config` object.
     * @return {Object} returns `object`.
     * @method apply
     * @member ST
     */
    ST.apply = function (object, config, own) {
        if (object && config) {
            var i, j, k;

            for (i in config) {
                if (!own || config.hasOwnProperty(i)) {
                    object[i] = config[i];
                }
            }

            for (j = _enumerables.length; j--;) {
                k = _enumerables[j];
                if (config.hasOwnProperty(k)) {
                    object[k] = config[k];
                }
            }
        }

        return object;
    };

    /**
     * Copies all the properties of config to object if they don't already exist.
     * @param {Object} object The receiver of the properties
     * @param {Object} config The source of the properties
     * @param {Boolean} [own] Pass `true` to limit the copy to `hasOwnProperty` properties
     * of the `config` object.
     * @return {Object} returns obj
     * @method applyIf
     * @member ST
     */
    ST.applyIf = function (object, config, own) {
        var property;

        if (object && config && typeof config === 'object') {
            var i, j, k;

            for (i in config) {
                if (!own || config.hasOwnProperty(i)) {
                    if (object[i] === undefined) {
                        object[i] = config[i];
                    }
                }
            }

            for (j = _enumerables.length; j--;) {
                k = _enumerables[j];
                if (object[k] === undefined && config.hasOwnProperty(k)) {
                    object[k] = config[k];
                }
            }
        }

        return object;
    };

    /**
     * Returns a new object with the given object as the prototype chain. This method is
     * designed to mimic the ECMA standard `Object.create` method and is assigned to that
     * function when it is available.
     *
     * **NOTE** This method does not support the property definitions capability of the
     * `Object.create` method. Only the first argument is supported.
     *
     * @param {Object} object The prototype chain for the new object.
     * @method chain
     * @member ST
     */
    ST.chain = Object.create || function (object) {
        _template.prototype = object;
        var result = new _template();
        _template.prototype = null;
        return result;
    };

    /**
     * Capitalize the first letter of the given string.
     * @param {String} string
     * @return {String}
     * @method capitalize
     * @member ST
     */
    ST.capitalize = function (string) {
        return string ? string.charAt(0).toUpperCase() + string.substr(1) : '';
    };

    /**
     * Lower-cases the first letter of the given string.
     * @param {String} string
     * @return {String}
     * @method decapitalize
     * @member ST
     */
    ST.decapitalize = function (string) {
        return string ? string.charAt(0).toLowerCase() + string.substr(1) : '';
    };

    function _makeCtor () {
        function ctor () {
            if (this.constructor) {
                return this.constructor.apply(this, arguments);
            }
            return this;
        }

        ctor.isClass = true;
        return ctor;
    }

    /**
     * Defines a primitive class similar to the Ext JS class system. The following
     * features are provided:
     *
     *   * `extend`
     *   * `singleton`
     *   * `statics` (like ES6, all statics are inherited)
     *
     * @param {Object/Function} data The class body or a method that will return the
     * class body. The method is passed the class constructor as its single argument.
     * @param {Function} [onComplete] Optional completion method. Since this method is
     * synchronous, `onComplete` is called immediately.
     * @return {Function} The class constructor
     * @method define
     * @member ST
     */
    ST.define = function (data, onComplete) {
        var ctor = _makeCtor();

        if (typeof data === 'function') {
            data = data(ctor);
        }

        var extend = data.extend || _Base,
            proto = ctor.prototype,
            singleton = data.singleton,
            mixins = data.mixins;

        delete data.singleton;
        delete data.mixins;

        if (extend) {
            delete data.extend;

            // Copy ownProperties from the base (inheritable statics like ES6)
            ST.apply(ctor, extend, true);

            ctor.prototype = proto = ST.chain(ctor.superclass = extend.prototype);
            proto.self = ctor;
        }

        if (mixins) {
            mixins = ST.isArray(mixins) ? mixins : [mixins];

            for (i=0; i<mixins.length; i++) {
                mixin = mixins[i].prototype;

                for (key in mixin) {
                    if (proto[key] === undefined) {
                        proto[key] = mixin[key];
                    }
                }
            }
        }   

        if (data.statics) {
            // These will overwrite any inherited statics (as they should)
            ST.apply(ctor, data.statics);

            delete data.statics;
        }

        ST.apply(proto, data);

        if (onComplete) {
            onComplete.call(ctor, ctor);
        }

        if (singleton) {
            return new ctor();
        }

        return ctor;
    };

    ST.emptyFn = function () {};

    /**
     * Iterates an array or an iterable value and invoke the given callback function for
     * each item.
     *
     *     var countries = ['Vietnam', 'Singapore', 'United States', 'Russia'];
     *
     *     ST.each(countries, function(name, index, countriesItSelf) {
     *         console.log(name);
     *     });
     *
     *     var sum = function() {
     *         var sum = 0;
     *
     *         ST.each(arguments, function(value) {
     *             sum += value;
     *         });
     *
     *         return sum;
     *     };
     *
     *     sum(1, 2, 3); // returns 6
     *
     * The iteration can be stopped by returning `false` from the callback function.
     * Returning `undefined` (i.e `return;`) will only exit the callback function and
     * proceed with the next iteration of the loop.
     *
     *     ST.each(countries, function(name, index, countriesItSelf) {
     *         if (name === 'Singapore') {
     *             return false; // break here
     *         }
     *     });
     *
     * @param {Array/NodeList} iterable The value to be iterated.
     * @param {Function} fn The callback function. If it returns `false`, the iteration
     * stops and this method returns the current `index`. Returning `undefined` (i.e
     * `return;`) will only exit the callback function and proceed with the next iteration
     * in the loop.
     * @param {Object} fn.item The item at the current `index` in the passed `array`
     * @param {Number} fn.index The current `index` within the `array`
     * @param {Array} fn.allItems The `array` itself which was passed as the first argument
     * @param {Boolean} fn.return Return `false` to stop iteration.
     * @param {Object} [scope] The scope (`this` reference) in which the specified function
     * is executed.
     * @param {Boolean} [reverse=false] Reverse the iteration order (loop from the end to
     * the beginning).
     * @return {Boolean} If no iteration returns `false` then this method returns `true`.
     * Otherwise this method returns the index that returned `false`. See description for
     * the `fn` parameter.
     * @method each
     * @member ST
     */
    ST.each = function (iterable, fn, scope, reverse) {
        if (iterable) {
            var ln = iterable.length,
                i;

            if (reverse !== true) {
                for (i = 0; i < ln; i++) {
                    if (fn.call(scope || iterable[i], iterable[i], i, iterable) === false) {
                        return i;
                    }
                }
            }
            else {
                for (i = ln - 1; i > -1; i--) {
                    if (fn.call(scope || iterable[i], iterable[i], i, iterable) === false) {
                        return i;
                    }
                }
            }

            return true;
        }
    };

    ST.eachKey = function (obj, fn) {
        if (!obj) {
            return;
        }
        for (var key in obj) {
            fn(key, obj[key]);
        }
    };

    /**
     * Returns the first matching key corresponding to the given value.
     * If no matching value is found, null is returned.
     * @param {Object} object
     * @param {Object} value The value to find
     * @method getKey
     * @member ST
     * @private
     */
    ST.getKey = function (object, value) {
        for (var property in object) {
            if (object.hasOwnProperty(property) && object[property] === value) {
                return property;
            }
        }

        return null;
    };

    /**
     * Gets all values of the given object as an array.
     * @param {Object} object
     * @return {Array} An array of values from the object
     * @method getValues
     * @member ST
     * @private
     */
    ST.getValues = function (object) {
        var values = [],
            property;

        for (property in object) {
            if (object.hasOwnProperty(property)) {
                values.push(object[property]);
            }
        }

        return values;
    };

    ST.isArray = function (value) {
        return value instanceof Array;
    };

    ST.isBoolean = function (value) {
        return typeof value === 'boolean';
    };

    ST.isEmpty = function (value) {
        return (value == null) || (value && ST.isArray(value) && !value.length);
    };

    ST.isNumber = function (value) {
        return typeof value === 'number';
    };

    ST.isPrimitive = function (value) {
        var t = typeof value;

        return t === 'string' || t === 'number' || t === 'boolean';
    };

    ST.isString = function (value) {
        return typeof value === 'string';
    };

    //----------------------------------------------------------------------
    // Array

    var slice = Array.prototype.slice,
        fixArrayIndex = function (array, index) {
            return (index < 0) ? Math.max(0, array.length + index)
                : Math.min(array.length, index);
        },
        replaceSim = function (array, index, removeCount, insert) {
            var add = insert ? insert.length : 0,
                length = array.length,
                pos = fixArrayIndex(array, index);

            // we try to use Array.push when we can for efficiency...
            if (pos === length) {
                if (add) {
                    array.push.apply(array, insert);
                }
            } else {
                var remove = Math.min(removeCount, length - pos),
                    tailOldPos = pos + remove,
                    tailNewPos = tailOldPos + add - remove,
                    tailCount = length - tailOldPos,
                    lengthAfterRemove = length - remove,
                    i;

                if (tailNewPos < tailOldPos) { // case A
                    for (i = 0; i < tailCount; ++i) {
                        array[tailNewPos+i] = array[tailOldPos+i];
                    }
                } else if (tailNewPos > tailOldPos) { // case B
                    for (i = tailCount; i--; ) {
                        array[tailNewPos+i] = array[tailOldPos+i];
                    }
                } // else, add == remove (nothing to do)

                if (add && pos === lengthAfterRemove) {
                    array.length = lengthAfterRemove; // truncate array
                    array.push.apply(array, insert);
                } else {
                    array.length = lengthAfterRemove + add; // reserves space
                    for (i = 0; i < add; ++i) {
                        array[pos+i] = insert[i];
                    }
                }
            }

            return array;
        },
        replaceNative = function (array, index, removeCount, insert) {
            if (insert && insert.length) {
                // Inserting at index zero with no removing: use unshift
                if (index === 0 && !removeCount) {
                    array.unshift.apply(array, insert);
                }
                // Inserting/replacing in middle of array
                else if (index < array.length) {
                    array.splice.apply(array, [index, removeCount].concat(insert));
                }
                // Appending to array
                else {
                    array.push.apply(array, insert);
                }
            } else {
                array.splice(index, removeCount);
            }
            return array;
        },

        eraseSim = function (array, index, removeCount) {
            return replaceSim(array, index, removeCount);
        },

        eraseNative = function (array, index, removeCount) {
            array.splice(index, removeCount);
            return array;
        },

        spliceSim = function (array, index, removeCount) {
            var pos = fixArrayIndex(array, index),
                removed = array.slice(index, fixArrayIndex(array, pos+removeCount));

            if (arguments.length < 4) {
                replaceSim(array, pos, removeCount);
            } else {
                replaceSim(array, pos, removeCount, slice.call(arguments, 3));
            }

            return removed;
        },

        spliceNative = function (array) {
            return array.splice.apply(array, slice.call(arguments, 1));
        },

        supportsSplice = (function () {
            var array = [],
                lengthBefore,
                j = 20;

            if (!array.splice) {
                return false;
            }

            // This detects a bug in IE8 splice method:
            // see http://social.msdn.microsoft.com/Forums/en-US/iewebdevelopment/thread/6e946d03-e09f-4b22-a4dd-cd5e276bf05a/

            while (j--) {
                array.push("A");
            }

            array.splice(15, 0, "F", "F", "F", "F", "F","F","F","F","F","F","F","F","F","F","F","F","F","F","F","F","F");

            lengthBefore = array.length; //41
            array.splice(13, 0, "XXX"); // add one element

            if (lengthBefore + 1 !== array.length) {
                return false;
            }
            // end IE8 bug

            return true;
        }()),

        erase = supportsSplice ? eraseNative : eraseSim,
        replace = supportsSplice ? replaceNative : replaceSim,
        splice = supportsSplice ? spliceNative : spliceSim;

    ST.Array = STArray = {
        erase: erase,
        replace: replace,
        // Note: IE8 will return [] on slice.call(x, undefined).
        slice: ([1,2].slice(1, undefined).length ?
            function (array, begin, end) {
                return slice.call(array, begin, end);
            } :
            function (array, begin, end) {
                // see http://jsperf.com/slice-fix
                if (typeof begin === 'undefined') {
                    return slice.call(array);
                }
                if (typeof end === 'undefined') {
                    return slice.call(array, begin);
                }
                return slice.call(array, begin, end);
            }
        ),
        splice: splice,
        insert: function (array, index, items) {
            return replace(array, index, 0, items);
        },
        indexOf: function (array, item) {
            if (array.indexOf) {
                return array.indexOf(item);
            }

            for (var i = 0, n = array.length; i < n; i++) {
                if (array[i] === item) {
                    return i;
                }
            }

            return -1;
        },
        remove: function (array, item) {
            var index = STArray.indexOf(array, item);
            if (index >= 0) {
                erase(array, index, 1);
            }
        },
        toMap: function (array) {
            var ret = {},
                i;

            for (i = array && array.length; i-- > 0; ) {
                ret[array[i]] = 1;
            }

            return ret;
        }
    };

    ST.String = STString = {
        spaceRe: /[ ]+/g,
        trimRe: /^\s+|\s+$/g,

        startsWith: function (s, prefix) {
            return s.length >= prefix.length && s.indexOf(prefix) === 0;
        },

        split: function (s) {
            return s ? s.split(STString.spaceRe) : [];
        },

        trim: function (s) {
            return s ? s.replace(STString.trimRe, '') : '';
        }
    }

    //----------------------------------------------------------------------

    ST.Observable = ST.define({
        _update: function (add, name, fn, scope, opts) {
            var me = this,
                array, entry, i, key, keys, listeners, n, old;

            if (typeof name !== 'string') {
                for (key in name) {
                    if (key !== 'scope' && key !== 'single') {
                        if (typeof(fn = name[key]) === 'function') {
                            opts = name;
                        } else {
                            opts = fn;
                            fn = opts.fn;
                        }

                        me._update(add, key, fn, name.scope, opts);
                    }
                }
            }
            else {
                listeners = me._listeners || (me._listeners = {});
                array = listeners[name] || (listeners[name] = []);

                opts = ST.apply({
                    scope: scope,
                    fn: fn
                }, opts);

                if (add) {
                    if (array.firing) {
                        listeners[name] = array = array.slice();
                    }

                    array.push(opts);
                } else {
                    // Array.splice() is bugged in IE8, so avoid it (which is
                    // easy since we often need to make a new array anyway):
                    old = array;
                    array = null;

                    for (i = 0, n = old.length; i < n; ++i) {
                        entry = old[i];

                        if (array) {
                            array.push(entry);
                        }
                        else if (opts.fn === entry.fn && opts.scope === entry.scope &&
                            opts.single === entry.single) {
                            listeners[name] = array = old.slice(0, i);
                        }
                    }
                }
            }
        },

        on: function (name, fn, scope, opts) {
            this._update(true, name, fn, scope, opts);
        },

        un: function (name, fn, scope, opts) {
            this._update(false, name, fn, scope, opts);
        },

        fireEvent: function (name) {
            var me = this,
                listeners = me._listeners,
                array = listeners && listeners[name],
                args, entry, fn, i, len, ret, scope;

            if (!(len = array && array.length)) {
                return;
            }

            args = Array.prototype.slice.call(arguments, 1);
            array.firing = (array.firing || 0) + 1;

            for (i = 0; i < len; i++) {
                entry = array[i];
                ret = (fn = entry.fn).apply((scope = entry.scope) || me, args);

                if (entry.single) {
                    me.un(name, fn, scope, entry);
                }

                if (ret === false) {
                    break;
                }
            }

            array.firing--;

            return ret;
        }
    });

})(ST);
