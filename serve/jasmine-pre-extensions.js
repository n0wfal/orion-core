// This file contains extensions that must be added "pre-boot" - before the jasmine object
// is built up via jasmineRequire
(function() {
    var buildExpectationResult = jasmineRequire.buildExpectationResult;

    jasmineRequire.buildExpectationResult = function() {
        var fn = buildExpectationResult.apply(this, arguments);

        function patch(options) {
            var result = fn.apply(this, arguments);

            // Jasmine's implementation only adds expected/actual values for failed
            // specs.  Here we add that info for passed specs as well.
            if (result.passed) {
                result.expected = options.expected;
                result.actual = options.actual;
            }

            return result;
        }

        return patch;
    };
})();
