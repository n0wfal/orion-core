// This is the first file included

/**
 * @class ST
 * @singleton
 *
 * This is the root namespace for the Sencha Test API.
 */
var ST = ST || {};

// Create our sub-namespaces.
ST.future = {};
ST.event = {};
ST.locator = {};

/**
 * @class ST.Gate
 * This class manages a counter-based notification queue. Gates start blocked and must
 * be released by calling `unblock`. If other processes must be injected before the Gate
 * should open, the `block` method is used to increment the internal counter. Each such
 * call to `block` must have a corresponding call to `unblock`.
 * @private
 * @since 1.0.2
 */
ST.Gate = function (name, delay) {
    if (delay != null) {
        this.delay = delay;
    }

    this.name = name;

    /**
     * @property {Number} blocks
     * The number of blocks that must be released to open this Gate (see `unblock`).
     * @readonly
     * @private
     */
    this.blocks = 1;

    /**
     * @property {Function[]} callbacks
     * The array of notification handlers to call when the Gate is opened.
     * @readonly
     * @private
     */
    this.callbacks = [];
};

ST.Gate.prototype = {
    /**
     * @property {Number} delay
     * The number of milliseconds to delay before calling the `callbacks` after the last
     * `unblock` call is made.
     * @readonly
     * @private
     */
    delay: null,

    /**
     * Registers a `callback` function to be called when this gate opens.
     * @param callback
     * @private
     */
    on: function (callback) {
        if (this.blocks) {
            this.callbacks.push(callback);
        } else {
            callback();
        }
    },

    /**
     * Increments the `blocks` counter by one, thereby preventing this gate from opening.
     * Each call to this method must have a corresponding call to `unblock` to decrement
     * the counter and eventually allow the gate to open.
     * @private
     */
    block: function () {
        ++this.blocks;
    },

    /**
     * Notifies all registered `callbacks` that this gate is open. This method is not
     * called directly, but rather when `unblock` has decremented `blocks` to 0.
     * @private
     */
    fire: function () {
        //console.log('fire', this.name);
        var callbacks = this.callbacks,
            fn;

        while (callbacks.length && !this.blocks) {
            fn = callbacks.shift();
            fn();
        }
    },

    /**
     * Decrements the `blocks` counter by one, thereby allowing this gate to open. This
     * method should be called once for each call to `block`.
     * @private
     */
    unblock: function () {
        var me = this,
            delay = me.delay;

        if (--me.blocks < 1) {
            if (delay === null) {
                me.fire();
            } else {
                ST.defer(function () {
                    me.fire();
                }, delay);
            }
        }
    }
};

/**
 * @property {ST.Gate} ready
 * The `ready` gate is opened when the document is ready as well as Ext JS / Sencha Touch.
 * @readonly
 * @private
 * @since 1.0.2
 */
ST.ready = new ST.Gate('ready');
// The initial block count of 1 is decremented by afterFiles()

/**
 * @property {ST.Gate} testsReady
 * The `testsReady` gate is opened when all tests are described and ready to run.
 * @readonly
 * @private
 * @since 1.0.2
 */
ST.testsReady = new ST.Gate('testsReady', 50);

// The ready gate opens first and signals that ST is ready and, if the app is using a
// Sencha SDK, that it is ready.
//
// The testsReady gate must not open before ready, but can open immediately after. The
// jasmine-orion adapter defers running top-level describe() calls until the ready gate
// is open to ensure those test suites have access to application classes. To do this,
// jasmine-orion blocks the testsReady gate and defers even running top-level describes()
// until the ready gate is open.

ST.ready.on(function () {
    // We start with 1 testsReady blockage so here we unblock it. We may have blocked
    // testsReady to load tests but that does not make any difference since we must
    // "balance out the books" for the initial block.
    ST.testsReady.unblock();
});

/**
 * This method queues a function to be called when ST is ready to run.
 * @method onReady
 * @param {Function} fn
 * @private
 */
ST.onReady = function (fn) {
    ST.ready.on(fn);
};

ST.now = function () {
    return +new Date();
}

/**
 * This object contains various test options.
 * @class ST.options
 * @singleton
 */
ST.options = {
    /**
     * @cfg {Boolean} breakOnFailure
     * Specify `true` to trigger a `debugger` statement when a test fails.
     */
    breakOnFailure: false,

    /**
     * @cfg {Boolean} evaluateTestsOnReady
     * Specify `false` to evaluate tests immediately instead of scheduling them for
     * after the page achieves `ready` state.
     */
    evaluateTestsOnReady: true,

    /**
     * @cfg {Number} eventDelay
     * The milliseconds to delay between events in `ST.play` calls.
     */
    eventDelay: 500,

    /**
     * @cfg {Boolean} eventTranslation
     * `false` to disable event translation.  If `false` events that are not supported by
     * the browser's event APIs will simply be skipped.
     */
    eventTranslation: true,

    /**
     * @cfg {Boolean} failOnMultipleMatches
     * Specify `false` to suppress errors when locators produce multiple results.
     */
    failOnMultipleMatches: true,

    /**
     * @property {Object} globals
     * An object holding as property keys the names of allowed global variables. Any
     * other global variables created by a test will be reported as failures due to
     * global variable leakage. Use {@link ST#addGlobals} to add allowable globals.
     * Normally, allowed globals are configured in the test project and/or scenario.
     */
    globals: {},

    /**
     * @cfg {Boolean} handleExceptions
     * Set to `false` to disable internal `try`/`catch` wrappers. Disabling these
     * wrappers can make it easier to catch problems as they happen in the debugger
     * but will prevent test execution from continuing beyond them.
     */
    handleExceptions: true,

    /**
     * @cfg {number} [screenshotTimeout=60000]
     * The default timeout value (in milliseconds) for screenshots.
     */
    screenshotTimeout: 60000,

    /**
     * @cfg {number} timeout
     * The default timeout value (in milliseconds). Specify `0` to disable timeouts
     * by default. This can be useful when debugging since it allows time to
     * manipulate the environment during test execution.
     */
    timeout: 5000,

    /**
     * @cfg {Number} typingDelay
     * The milliseconds to delay between keyboard events in `ST.play` calls when playing
     * back `type` events.
     */
    typingDelay: 100,

    /**
     * @cfg {Boolean} visualFeedback
     * `false` to disable visual feedback during event playback (mouse cursor, and "gesture"
     * indicator)
     */
    visualFeedback: true
};

(function () {
    var scripts = document.getElementsByTagName('script'),
        n = scripts.length,
        cookie = 'ext-cache=1; expires=',
        src;

    while (n-- > 0) {
        src = scripts[n].src;

        // Pick up the "_dc=" query parameter on our init.js file to see if the
        // cacheBuster is enabled. Based on that we set or remove the "ext-cache"
        // cookie. This cookie has been checked by Ext JS since 4.1.x era as a
        // way to control the cacheBuster w/o resorting to URL hacks.
        //
        if (src && src.indexOf('~orion/files/init.js') > 0) {
            cookie += (src.indexOf('_dc') < 0) ? 0 : 'Thu, 01 Jan 1970 00:00:00 GMT';
            cookie += '; path=/';
            document.cookie = cookie;
            break;
        }
    }
}());

//-----------------------------------------------------------------------
// Ext._beforereadyhandler is called very early on Ext JS initialization,
// so we use it to block ST immediately in case the framework is
// present and unblock it once it's ready. But that's not the end of the
// story - see orion.js afterFiles().

var Ext = Ext || {};
Ext._beforereadyhandler = function() {
    ST.Ext = Ext; // feature detector for Ext JS (since we created the global)
    
    if (Ext.getVersion) {
        ST.isModern = Ext.isModern;
        ST.isTouch = !!Ext.versions.touch;
        ST.isClassic = !ST.isModern && !ST.isTouch;
        ST.sdkVersion = new ST.Version(Ext.getVersion().version);
    }

    ST.ready.block();

    Ext.onReady(function () {
        ST.defer(function() {
            // Slightly delayed to ensure that this runs after any user onReady
            // handlers.  This approach is preferred over using the priority option
            // because it works with all versions of the framework.
            ST.ready.unblock();
        }, 100);
    });
};
