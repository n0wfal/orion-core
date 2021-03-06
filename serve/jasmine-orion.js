(function() {
    var hashToId = {},
        idToHash = {},
        rootSuiteIdsByFile = {},
        failOnError;

    /**
     * @class ST.jasmine
     * @singleton
     * @private
     */
    ST.jasmine = {
        alphaRe: /[A-Z]/g,

        /**
         * An object to tell the expectation result to pretty print
         * the expected value of the expectation. To prevent, set the
         * matcher name to `false`, anything else will pretty print it.
         */
        prettyPrintExpected: {
            toHaveBeenCalled: false,
            toHaveBeenCalledTimes: false,
            toHaveBeenCalledWith: false
        },

        addExpectationResult: function (suiteOrSpec, data) {
            var expectation = suiteOrSpec.expectationResultFactory(data),
                matcherName = expectation.matcherName,
                message = expectation.message;

            if ((matcherName && jasmine.matchers[matcherName]) || !message) {
                /**
                 * If the matcher is a default jasmine matcher, create the message.
                 * If the matcher is a custom matcher and it did not provide a
                 * message, create one.
                 */
                message = 'Expected ' + this.prettyPrint(expectation.actual) +
                    ' ' +
                    matcherName.replace(ST.jasmine.alphaRe, function(s) {
                        return ' ' + s.toLowerCase();
                    });

                if (this.prettyPrintExpected[matcherName] !== false) {
                    message += ' ' + this.prettyPrint(expectation.expected);
                }
            }

            suiteOrSpec.result.$test.addResult({
                passed: expectation.passed,
                message: message
            });
        },

        prettyPrint: function (value) {
            if (value) {
                if (jasmine.isSpy(value)) {
                    return value.and.identity() || 'Function';
                } else {
                    return ST.prettyPrint(value);
                }
            } else {
                return value;
            }
        },

        /**
         * By default jasmine computes the "fullName" of a spec or suite by joining it
         * with the descriptions of all its ancestors using " " as the delimiter.
         * This function computes an orionFullName property that uses "->" as the delimiter
         * to avoid a situation where the following two specs have the same fullName:
         * 
         *      describe("foo bar", function() {
         *          it("baz", function() {});
         *      });
         *      
         *      describe("foo", function() {
         *          it("bar baz", function() {});
         *      });
         *      
         * @param suiteOrSpec The Jasmine Suite or Spec instance.
         * @private
         */
        getFullName: function (suiteOrSpec) {
            var fullName = suiteOrSpec.description,
                delimiter = ' -> ',
                suite = suiteOrSpec.parentSuite || ST.jasmine.currentSuite;
    
            while (suite && suite.parentSuite) { // skip root jasmine suite
                fullName = suite.description + delimiter + fullName;
                suite = suite.parentSuite;
            }
    
            fullName = ST.currentTestFile + delimiter + fullName;
    
            return fullName;
        },

        getHash: function (fullName, jasmineId) {
            var len = fullName.length,
                hash = 0,
                char, i;
    
            // see http://www.cse.yorku.ca/~oz/hash.html
            for (i = 0; i < len; i++) {
                char = fullName.charCodeAt(i);
                hash = char + (hash << 6) + (hash << 16) - hash;
            }
    
            if (hash in hashToId) {
                ST.status.duplicateId({
                    id: hash,
                    fullName: fullName
                });
            }
    
            hashToId[hash] = jasmineId;
            idToHash[jasmineId] = hash;
    
            return hash;
        }
    };

    ST.jasmine.Reporter = {
        suiteEnter: function(result, status) {
            var id = ST.jasmine.getHash(result.orionFullName, result.id),
                fileName = ST.currentTestFile,
                baseUrl, scripts, rootSuiteIds;

            result.hash = id;

            if (result.orionIsRoot && !fileName) {
                // top-level describe in a file - need to track its file name so that the
                // test runner UI can append the suite to the correct file node.
                scripts = document.getElementsByTagName('script');

                // base url = page url minus query string
                baseUrl = location.href.split('?')[0];
                // Path to the file relative to the app root
                fileName = scripts[scripts.length - 1].src.substr(baseUrl.lastIndexOf('/') + 1);

                // remove possible cache buster param from file name
                fileName = fileName.split('?')[0];
            }

            if (result.orionIsRoot && fileName) {
                result.orionFileName = fileName;

                rootSuiteIds = rootSuiteIdsByFile[fileName] || (rootSuiteIdsByFile[fileName] = []);
                rootSuiteIds.push(id);
            }

            ST.status.suiteEnter({
                id: id,
                name: result.description,
                fileName: result.orionIsRoot ? fileName : null,
                disabled: status === 'disabled'
            });
        },

        specAdded: function (result) {
            var id = ST.jasmine.getHash(result.orionFullName, result.id),
                def = {
                    id: (result.hash = id),
                    name: result.description,
                    disabled: result.orionIsDisabled
                };

            if (result.orionRecording) {
                // TODO consider these to get location information:
                //      https://github.com/stacktracejs/stacktrace.js/
                //      https://github.com/stacktracejs/error-stack-parser/
                //      https://github.com/stacktracejs/stackframe
                //      https://github.com/stacktracejs/stack-generator
                //
                def.recording = true;
            }

            ST.status.testAdded(def);
        },

        suiteLeave: function (result) {
            ST.status.suiteLeave({
                id: result.hash,
                name: result.description
            });
        },

        jasmineStarted: function (suiteInfo) {
            ST.status.runStarted();
        },

        postCoverageResults: function (result) {
            var reporter = ST.jasmine.Reporter,
                coverageName = reporter.coverageName || '__init__',
                currName = result && result.orionFileName || null;

            if (currName !== coverageName) {
                ST.system.postCoverageResults(coverageName, true);
                if (result) {
                    reporter.coverageName = result.orionFileName;
                } else {
                    reporter.coverageName = null;
                }
            }
        },

        suiteStarted: function (result) {
            if (result.orionFileName) {
                ST.jasmine.Reporter.postCoverageResults(result);
            }

            result.$test = new ST.Suite(result.hash, result.description);
            result.$test.jasmineResult = result;
        },
        
        // Jasmine notifies specStarted even with disabled specs so let ST.Spec handle
        // state change notifications to Sencha Test.
        specStarted: function (result) {
            result.$test = new ST.Spec(result.hash, result.description);
            result.$test.jasmineResult = result;

            // because jasmine won't invoke the xit function we must start the test
            // so it will properly progress through it's lifecycle and stop().
            if (result.orionIsDisabled) {
                result.$test.start();
            }
        },
    
        specDone: function (result) {
            result.$test.stop();
        },

        suiteDone: function (result) {
            result.$test.stop();
        },

        jasmineDone: function () {
            ST.jasmine.Reporter.postCoverageResults();
            ST.status.runFinished();
        }
    };

    ST.TestController = {
        startTestRun: function (message) {
            if (ST.reloadPending) {
                return;
            }

            // We have to wait for testsReady gate to open before we can actually run
            // any tests.
            ST.testsReady.on(function () {
                var testIds = message.testIds,
                    testOptions = ST.options,
                    ids, id, i, len, j, idLen, suiteIds;

                if (testIds) {
                    ids = [];
                    for (i = 0, len = testIds.length; i < len; i++) {
                        id = testIds[i].toString();

                        if (id.substr(id.length - 3) === '.js') {
                            // String id ending in '.js' means we were given a file name
                            suiteIds = rootSuiteIdsByFile[id];

                            if (suiteIds) {
                                for (j = 0, idLen = suiteIds.length; j < idLen; j++) {
                                    ids.push(hashToId[suiteIds[j]]);
                                }
                            }
                        } else {
                            ids.push(hashToId[id]);
                        }
                    }
                }

                // Map over options that apply to Jasmine:

                // NOTE: currently noTryCatch() is only supported in sencha/jasmine#no-try-catch branch.
                jasmine.getEnv().noTryCatch(!testOptions.handleExceptions);

                jasmine.getEnv().execute(ids);
            });
        }
    };

    ST.addController(ST.TestController);
})();
