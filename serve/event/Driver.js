/**
 * @class ST.event.Driver
 * This is the base class for {@link ST.event.Recorder} and {@link ST.event.Player}.
 * @protected
 */
ST.event.Driver = ST.define({
    extend: ST.Observable,

    active: null,

    specialKeysByName: {
        PGUP:  33,
        PGDN:  34,
        END:   35,
        HOME:  36,
        LEFT:  37,
        UP:    38,
        RIGHT: 39,
        DOWN:  40
    },

    specialKeysByCode: {
    },

    /**
     * @event start
     * Fires when this object is started.
     * @param {Ext.ux.event.Driver} this
     */

    /**
     * @event stop
     * Fires when this object is stopped.
     * @param {Ext.ux.event.Driver} this
     */

    getTextSelection: function (el) {
        // See https://code.google.com/p/rangyinputs/source/browse/trunk/rangyinputs_jquery.js
        var doc = el.ownerDocument,
            range, range2, start, end;

        if (typeof el.selectionStart === "number") {
            start = el.selectionStart;
            end = el.selectionEnd;
        } else if (doc.selection) {
            range = doc.selection.createRange();
            range2 = el.createTextRange();
            range2.setEndPoint('EndToStart', range);

            start = range2.text.length;
            end = start + range.text.length;
        }

        return [ start, end ];
    },

    /**
     * Returns the number of milliseconds since start was called.
     */
    getTimestamp: function () {
        var d = + new Date();
        return d - this.startTime;
    },

    onStart: function () {},

    onStop: function () {},

    /**
     * Starts this object. If this object is already started, nothing happens.
     */
    start: function () {
        var me = this;

        if (!me.active) {
            me.active = new Date();
            me.startTime = 0;
            me.startTime = me.getTimestamp();

            me.onStart();
            me.fireEvent('start', me);
        }
    },

    /**
     * Stops this object. If this object is not started, nothing happens.
     */
    stop: function () {
        var me = this;

        if (me.active) {
            me.active = null;
            me.onStop();
            me.fireEvent('stop', me);
        }
    }
}, function (Driver) {
    var proto = Driver.prototype;

   ST.eachKey(proto.specialKeysByName, function (name, value) {
        proto.specialKeysByCode[value] = name;
    });
});
