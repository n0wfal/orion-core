(function() {
    // Jasmine extensions - add support for suiteEnter, suiteLeave, and specAdded
    // reporter methods.
    // These overrides need to be reexamined for accuracy with each jasmine upgrade.
    // This file contains extensions that must be added "post-boot" - after the global
    // "jasmine" object is available.

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 1e9;

    var env = jasmine.getEnv(),
        describe = env.describe,
        fdescribe = env.fdescribe,
        xdescribe = env.xdescribe,
        it = env.it,
        xit = env.xit,
        afterAll = env.afterAll,
        afterEach = env.afterEach,
        beforeAll = env.beforeAll,
        beforeEach = env.beforeEach,
        pending = env.pending,
        reporter = ST.jasmine.Reporter,
        pp = jasmine.pp,
        addSuiteExpectationResult;

    function reportSuite (suite) {
        var children = suite.children,
            len = children.length,
            i, child;

        suite.result.orionFullName = ST.jasmine.getFullName(suite);

        ST.jasmine.currentSuite = suite;
        reporter.suiteEnter(suite.result, suite.orionIsDisabled ? 'disabled' : suite.status());

        for (i = 0; i < len; i++) {
            child = children[i];

            if (child instanceof jasmine.Suite) {
                reportSuite(child);
            } else if (child instanceof jasmine.Spec) {
                child.result.orionFullName = ST.jasmine.getFullName(child);
                reporter.specAdded(child.result);
            }
        }

        reporter.suiteLeave(suite.result);
        ST.jasmine.currentSuite = suite.parentSuite;
    }

    function doDescribe (type, description, definition, flag) {
        var suite = type.call(env, description, definition);

        // jasmine sets the suite's initial status to pending, This flag allows us to know
        // which suites are disabled when reporting the initial inventory.
        if (flag) {
            suite[flag] = true;
        }

        if (suite.parentSuite.id === 'suite0') {
            // suite0 is the jasmine global root level suite.  If the suite is a direct
            // child of suite0 it means it is a top-level suite in a file.  Decorate the
            // result object with a special property to indicate that it is a "root suite".
            // This is used by the reporter for matching up suites with their files in suiteEnter()
            suite.result.orionIsRoot = true;
            reportSuite(suite);
        }

        return suite;
    }

    env.describe = function(description, definition) {
        return ST.Tests.enqueue(function () {
            //console.log('describe("' + description + '"');
            return doDescribe(describe, description, definition);
        });
    };

    env.fdescribe = function(description, definition) {
        return ST.Tests.enqueue(function () {
            //console.log('fdescribe("' + description + '"');
            return doDescribe(fdescribe, description, definition, 'orionIsFocused');
        });
    };

    env.xdescribe = function (description, definition) {
        return ST.Tests.enqueue(function () {
            //console.log('xdescribe("' + description + '"');
            return doDescribe(xdescribe, description, definition, 'orionIsDisabled');
        });
    };

    env.afterAll = function (fn, timeout) {
        var block = new ST.Block(fn, timeout);
        return afterAll.call(env, block.wrapperFn);
    };

    env.afterEach = function (fn, timeout) {
        var block = new ST.Block(fn, timeout);
        return afterEach.call(env, block.wrapperFn);
    };

    env.beforeAll = function (fn, timeout) {
        var block = new ST.Block(fn, timeout);
        return beforeAll.call(env, block.wrapperFn);
    };

    env.beforeEach = function (fn, timeout) {
        var block = new ST.Block(fn, timeout);
        return beforeEach.call(env, block.wrapperFn);
    };

    env.it = function (description, fn, timeout) {
        var block, spec, text;

        if (!fn) {
            spec = it.apply(env, arguments);
            spec.result.orionIsDisabled = true;
        } else {
            block = new ST.Block(fn, timeout);
            spec = (block.spec = it.call(env, description, block.wrapperFn));

            if (ST.urlParams.orionRecording) {
                text = fn.toString();
                spec.result.orionRecording = text.indexOf('ST.startRecording(') >= 0;
            }
        }

        spec.result.$spec = spec;

        return spec;
    };

    // Jasmine does not set the initial status of a spec defined using "xit()" to "disabled".
    // Instead the status gets initially set to "pending" and then changed to "disabled"
    // when the spec finishes running.  This override allows us to know at spec-declaration
    // time whether or not it is disabled
    env.xit = function() {
        var spec = xit.apply(env, arguments);

        spec.result.orionIsDisabled = true;

        return spec;
    };

    env.pending = function(message) {
        var err = new Error(message);
        err.specDisabled = true;
        throw err;
    }

    // Suite#addExpectationResult will call Spec#addExpectationResult (to handle
    // beforeAll). We aggregate the results on the suite and then pass them along
    // to the specs individually so we ignore this "broadcast". Since we hook the
    // addExpectationResult of both Suite and Spec, we also should not see this
    // anymore, but to be safe we ensure that we only pass results forward

    jasmine.Suite.prototype.addExpectationResult = function (passed, data) {
        ST.jasmine.addExpectationResult(this, data);
    };

    jasmine.Spec.prototype.addExpectationResult = function (passed, data) {
        ST.jasmine.addExpectationResult(this, data);
    };

    jasmine.pp = function(value) {
        if (value && ST.Ext && ST.Ext.Base) {
            if (value instanceof ST.Ext.Base) {
                if (value.id) {
                    value = value.id;
                } else if (value.xtype) {
                    value = value.xtype;
                } else if (value.$className) {
                    value = value.$className;
                }
            }
        }

        return pp.call(this, value);
    };
})();
