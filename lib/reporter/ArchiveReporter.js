"use strict";

var Client = require('orion-core/lib/archive/Client');
var Comparator = require('orion-core/lib/image/Comparator');
var Observable = require('orion-core/lib/Observable');
var ReporterBase = require('orion-core/lib/reporter/ReporterBase');
var xfs = require('orion-core/lib/xfs');
var File = require('orion-core/lib/fs/File');
var Zip = require('orion-core/lib/fs/Zip');

var path = require('path');
var sanitizeFilename = require('sanitize-filename');
var uuid = require('uuid');
var co = require('co');

var console = require('orion-core/lib/util/console-manager').console;

function ignore () {
    
}

function exec(generator, callback) {
    co(generator)
        .then(function (value) {
            callback && callback(value);
        }, function (err) {
            console.error(err.stack);
        });
}

function sanitize (filename) {
    return sanitizeFilename(filename || 'child')
        .replace(/ /g, '-')
        .substr(0, Math.min(32, filename.length));
}

class ArchiveReporter extends ReporterBase {
    ctor (cfg) {
        var me = this;

        me.id = me.id || uuid.v1();

        me._pendingWrites = 0;
        me._contexts = new Map();
        me._descriptors = {};
        me._browsers = {};
        me.idSeed = 0;

        if (me.enableScreenshots === undefined) {
            me.enableScreenshots = true;
        }

        me.init();
    }
    
    init() {
        var me = this,
            workdir = me.workdir || me.basedir,
            baselinedir = me.baselinedir,
            projectArchivePath, rootDescriptor, basedirPath;

        if (!workdir) {
            workdir = xfs.tempSessionDir.join('reports');
        }
        me.workdir = workdir = new File(workdir);
        me.basedir = workdir.join(me.id);
        basedirPath = me.basedir.path;
        
        if (!baselinedir) {
            baselinedir = workdir.join('baseline');
        }
        me.baselinedir = new File(baselinedir);
        
        projectArchivePath = me.scenario.project.get('archivePath') || '';
        if (projectArchivePath.startsWith('/')) {
            projectArchivePath = projectArchivePath.substring(1);
        }
        me.projectArchivePath = new File(projectArchivePath);

        me.archivedir = me.basedir.join(projectArchivePath);
        me.scenariodir = me.archivedir.join(sanitize(me.scenario.get('name')));
      
        // Merged archives will contain results for multiple scenarios
        rootDescriptor = me.getDescriptor(me.basedir);
        rootDescriptor.scenarios = [{ 
            path: me.basedir.relativeTo(me.scenariodir).path 
        }];
    }

    removeDirectory() {
        this.basedir.remove();
    }

    flush() {
        var me = this;
        console.log('[ARCHIVER] Flushing result queues'.gray);
        return me._flushQueues()
            .then(function () {
                delete me['_contexts'];
                // Max ID is used by the archive server to reindex
                // merged results
                me.getDescriptor(me.basedir).maxId = me.idSeed;
                
                console.log('[ARCHIVER] Writing results to disk'.gray);
                return me._flushDescriptors();
            })
            .then(function() {
                console.log('[ARCHIVER] Compressing result archive'.gray);
                return me._zipArchive();
            })
            .then(function(zipFile) {
                if (me.server) {
                    console.log('[ARCHIVER] Uploading results to server %s'.gray, me.server);
                    return me._upload(zipFile);
                }
            })
            .then(function () {
                console.log('[ARCHIVER] Done'.gray);
            });
    }
    
    _flushQueues() {
        var promises = [];
        for (let context of this._contexts.values()) {
            promises.push(context.flush());
        }
        return Promise.all(promises);
    }
    
    _flushDescriptors() {
        var me = this;
        
        return new Promise(function (resolve, reject) {
            var descriptors = me._descriptors;
            var dirs = Object.keys(descriptors);
            var totalDescriptors = dirs.length;
            var flushedDescriptors = 0;
            
            if (totalDescriptors === 0) {
                resolve();
                return;
            }
            
            for (let dir of dirs) {
                let descriptor = descriptors[dir];
                delete descriptors[dir];
                let data = JSON.stringify(descriptor, null, 4);
                dir = new File(dir);
                let dataFile = dir.join('data.json');
                
                dataFile.write(data).then(function () {
                    if (++flushedDescriptors === totalDescriptors) {
                        resolve();
                    }
                }).catch(function (err) {
                    reject(err);
                });
            }
        });
    }
    
    _zipArchive() {
        var me = this;

        return new Promise(function(resolve, reject) {
            Zip.fromDir(me.basedir.path, me.workdir.join(me.id + '.zip').path).then(function(info) {
                console.log('[ARCHIVER] Report archived to %s (%d bytes)'.grey, info.fileName, info.bytes);
                resolve(info.fileName);
            }, function(err) {
                reject(err);
            });
        });
    }
    
    _upload(zipFile) {
        var me = this;
        var server = me.server;
        
        if (!server) {
            return Promise.resolve();
        }
        
        var client = new Client({
            server: me.server
        });
        
        return client.upload(zipFile, { 
            storageKey: me.storageKey,
            archivePath: me.archivePath
        }).then(function (result) {
            var hasWarning = result.toLowerCase().indexOf('warning') >= 0;
            
            result = '[ARCHIVER] ' + result;
            result = result.split('\n');
            
            for (let line of result) {
                if (hasWarning) {
                    console.warn(line);
                } else {
                    console.log(line.gray);
                }
            }
        }, function (err) {
            console.error(err.stack || err);
        });
    }

    testSuiteEnter(message) {
        var me = this,
            context = me._getContext(message.agent),
            file, dir;

        if (message.fileName) {
            context.reset();
            me.projectArchivePath.getPathParts().forEach(function (archiveDir) {
                if (archiveDir) {
                    context.down({
                        name: archiveDir,
                        type: 'dir'
                    });
                }
            });
            
            file = me.archivedir.relativeTo(me.scenariodir.join(message.fileName));
            dir = file.getParentFile();
            dir.getPathParts().forEach(function (part) {
                if (part) {
                    context.down({
                        name: part,
                        type: 'dir'
                    });
                }
            });
            context.down({
                name: file.name,
                type: 'file'
            });
        }
        
        context.down({
            name: message.name,
            type: 'suite',
            id: message.id
        });
    }

    testSuiteLeave(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.up();
    }

    testAdded(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.addTest(message);
    }

    // TODO: we need the inital results that are for the __init__ coverage phase
    // to be associated with the test scenario rather than the archive root
    // ideally the path is <scenario>/__init__/coverage-<browserId>.json
    testRunStarted (message) {
        this.archiveRunning = true;
        this._getContext(message.agent).reset();
    }

    testSuiteStarted(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.suite(message.id);
    }

    testStarted(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.startTest(message);
    }

    testFinished(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.endTest(message);
    }

    testSuiteFinished(message) {
        var me = this,
            context = me._getContext(message.agent);

        context.up();
    }

    codeCoverageStructure (message) {
        var me = this,
            context = me._getContext(message.agent);

        context.saveCoverageStructure(message.results, null);
    }

    codeCoverage (message) {
        var me = this,
            context = me._getContext(message.agent);

        context.saveCoverage(message.results, message.name);
    }

    saveScreenshot(name, buffer, agent) {
        var me = this;
        var context = me._getContext(agent);
        
        return context.saveScreenshot(name, buffer)
    }

    _ensureBaselineExists() {
        var me = this,
            localPath, client;

        return me._ensureBaselineExistsPromise || (me._ensureBaselineExistsPromise =
            new Promise(function(resolve, reject) {
                if (!me.server) {
                    resolve();
                } else if (!me._baselineDownloaded) {
                    client = new Client({
                        server: me.server
                    });
    
                    localPath = File.join(me.workdir.path, 'baseline');
    
                    client.download({
                        storageKey: me.storageKey,
                        path: File.join(me.archivePath, 'baseline'),
                        localPath: localPath
                    }).then(function() {
                        me._baselineDownloaded = true;
                        resolve();
                    }, function(err) {
                        console.error(err);
                        reject(err);
                    });
                } else {
                    resolve();
                }
            }));
    }

    _getContext(agent) {
        var me = this;
        var contexts = me._contexts || (me._contexts = new Map());
        var id = agent.id;
        
        return contexts.get(id) || contexts.set(id, me._newContext(agent)).get(id);
    }

    _newContext(agent) {
        var me = this;
        
        var agentGroup = agent.agentGroup;
        var userAgent = agent.userAgent;
        
        // FIXME IE8+saucelabs - agentGroup is undefined because the agent is removed from the group before we get here
        // looks like we're receiving only 'testFinished' back from the browser
        if (!me._browsers[agentGroup.id]) {
            var descriptor = me.getDescriptor(me.basedir);
            var browsers = descriptor.browsers || (descriptor.browsers = []);
            var id = me._getUniqueBrowserId(agentGroup, userAgent);
            var browser = {
                id: id,
                name: userAgent.name,
                userAgent: userAgent.userAgent
            }
            browsers.push(browser);
            me._browsers[agentGroup.id] = id;
        }
        
        return new Context({
            reporter: me,
            archiver: me,
            dir: me.basedir,
            browserId: me._browsers[agentGroup.id]
        });
    }
    
    _getUniqueBrowserId(agentGroup) {
        var me = this,
            browsers = me._browsers,
            browser = agentGroup.browser || agentGroup.userAgent.browser,
            // userAgent.browser is just an object, so we need to be able to differentiate
            isInstance = !!browser.parsedVersion,
            version = isInstance ? browser.parsedVersion : browser.version,
            major = version.major,
            name = isInstance ? browser.canonicalName : browser.name.toLowerCase();
        // FIXME sometimes getting null agentGroup

        var id = name + major;
        
        id = id.replace(/ /g, '');
        
        if (!browsers[id]) {
            return id;
        }
        
        var newId;
        for (var i = 0; i < 1000; i++) {
            newId = id + '-' + i;
            if (!browsers[newId]) {
               return newId;
            }
        }
        
        throw new Error('Unable to generate unique ID for browser ' + id);
    }

    getDescriptor(dir) {
        var me = this,
            descriptor = me._descriptors[dir.path] || (me._descriptors[dir.path] = me._newDescriptor());
        return descriptor;
    }

    _newDescriptor() {
        return {
            id: ++this.idSeed,
            children: []
        }
    }

    _newUniqueDirName(name, siblings) {
        var dirBaseName = sanitize(name),
            dirFinalName = dirBaseName,
            unique = false,
            suffix = 0;
        
        while (!unique) {
            let collision = false;
            
            for (let i = 0; i < siblings.length; i++) {
                if (siblings[i].dir === dirFinalName) {
                    collision = true;
                    break;
                }
            }
            
            if (collision) {
                dirFinalName = dirBaseName + '~' + ++suffix;
            } else {
                unique = true;
            }
        }
        
        return dirFinalName;
    }

}

class Context extends Observable {

    ctor(cfg) {
        var me = this;
        me._promise = Promise.resolve();
        me._map = {
            test: {},
            suite: {}
        };
        me._currentTest = null;
    }

    flush() {
        var me = this;
        return me.queue(new Promise(function (resolve, reject) {
            resolve();
        }));
    }

    queue(promiseFactory) {
        var me = this;
        return me._promise = me._promise.then(promiseFactory);
    }

    suite(id) {
        var me = this;
        me.queue(function () {
            // ID generated by the browser, used for lookup
            // within the context
            me.dir = new File(me._map.suite[id]);
        });
    }

    saveCoverageStructure (coverage, coverageName) {
        var me = this,
            reporter = me.reporter;
        me.queue(function(){
            return new Promise(function(resolve, reject){
                var browserId = me.browserId,
                    name = 'coverage-' + browserId + '-structure.json',
                    dir = new File(me.dir),
                    file = dir.join(name),
                    descriptor = reporter.getDescriptor(me.dir);

                descriptor.coverages = descriptor.coverages || [];
                descriptor.coverages.unshift({
                    browserId: browserId,
                    path: name,
                    structure: true
                });

                file.write(coverage).then(resolve, reject);
            });
        });
    }

    saveCoverage (coverage, coverageName) {
        var me = this,
            reporter = me.reporter;
        me.queue(function(){
            return new Promise(function(resolve, reject){
                var browserId = me.browserId,
                    dir = new File(me.dir),
                    name = 'coverage-' + browserId + '.json',
                    file = dir.join(name),
                    descriptor = reporter.getDescriptor(me.dir);

                if (coverageName === '__init__') {

                    var displayName = 'Page Initialization'
                    coverageName = sanitize(displayName);
                    dir = reporter.scenariodir;
                    descriptor = reporter.getDescriptor(dir);

                    var initDescriptorFile = dir.join(coverageName).join('data.json'),
                        initDescriptor = reporter.getDescriptor(initDescriptorFile.getParentFile()),
                        file = dir.join(coverageName).join(name),
                        childDescriptor;

                    initDescriptor.name = displayName;
                    initDescriptor.type = 'file';
                    initDescriptor.coverages = initDescriptor.coverages || [];
                    initDescriptor.coverages.push({
                        browserId: browserId,
                        path: name
                    });

                    childDescriptor = me.getEntryByName(descriptor.children, displayName);
                    if (!childDescriptor) {
                        childDescriptor = {
                            name: displayName,
                            type: 'file',
                            dir: coverageName
                        };
                        descriptor.children.push(childDescriptor);
                    }
                    childDescriptor.id = initDescriptor.id;
                    file.write(coverage).then(resolve, reject);
                }
                else {
                    descriptor.coverages = descriptor.coverages || [];
                    descriptor.coverages.push({
                        browserId: browserId,
                        path: name
                    });

                    file.write(coverage).then(resolve, reject);
                }
            });
        });
    }

    startTest(data) {
        var me = this,
            reporter = me.reporter;
        
        me.queue(function () {
            // lookup within the context by browser-generated hash ID
            var test = me._currentTest = me._map.test[data.id],
                descriptor = reporter.getDescriptor(me.dir);
            
            descriptor[me.browserId] = descriptor[me.browserId] || 0; 
            test[me.browserId] = true;
            me.bubbleUp(true);
        });
    }
    
    endTest(data) {
        var me = this,
            reporter = me.reporter;
        
        me.queue(function () {
            var test = me._currentTest,
                passed = data.passed,
                id = data.id,
                browserDetails, expectations, descriptor, failureCount;
            
            
            if (test[me.browserId] == null) {
                test[me.browserId] = passed;
            } else {
                test[me.browserId] = passed ? test[me.browserId] : false;
            }
            
            browserDetails = me.getDetails(test, me.browserId);
            expectations = browserDetails.expectations || (browserDetails.expectations = []);
            browserDetails.expectations = expectations.concat(data.expectations);
            
            descriptor = reporter.getDescriptor(me.dir);
            
            failureCount = (descriptor[me.browserId] || 0);
            if (!data.passed) {
                failureCount++;
            }
            descriptor[me.browserId] = failureCount;

            if (!data.passed) {
                me.bubbleUp(false);
            }
            
            // lookup within the context by browser-generated hash ID
            delete me._map.test[id];
            me._currentTest = null;
        });
    }
    
    getDetails(test, browserId) {
        var details = test.details || (test.details = []);
        var entry = null;
        
        for (var i = 0; i < details.length; i++) {
            if (details[i].browser === browserId) {
                entry = details[i];
                break;
            }
        }
        
        if (!entry) {
            entry = {
                browser: browserId
            }
            details.push(entry);
        }
        
        return entry;
    }
    
    bubbleUp(passed) {
        var me = this;
        var reporter = me.reporter;
        var dir = me.dir;
        var newFailures = passed ? 0 : 1;
        var descriptor, childEntry, childDescriptor;
        
        do {
            childDescriptor = reporter.getDescriptor(dir);
            dir = dir.getParentFile();
            descriptor = reporter.getDescriptor(dir);
            childEntry = me.getEntryById(descriptor.children, childDescriptor.id);
            childEntry[me.browserId] = (childEntry[me.browserId] || 0) + newFailures;
            descriptor[me.browserId] = (descriptor[me.browserId] || 0) + newFailures;
        } while (dir.path != reporter.basedir.path);

        // might need to remove the ID property of the root data.json to allow
        // allow the studio app to load this entry before ahead of the tree store
        // by assigning the ID of the root node to the root url
        if (dir.path == reporter.basedir.path) {
            descriptor = reporter.getDescriptor(dir);
            if (descriptor.id) {
                delete descriptor.id;
            }
        }
    }
    
    reset() {
        var me = this;
        me.queue(function () {
            var reporter = me.reporter;
            me.dir = reporter.basedir;
            me._currentTest = null;
        });
    }

    up() {
        var me = this;
        me.queue(function () {
            me.dir = me.dir.getParentFile();
        });
    }
    
    getEntryByName(entries, name) {
        return this.getEntryByProperty(entries, 'name', name);
    }
    
    getEntryById(entries, id) {
        return this.getEntryByProperty(entries, 'id', id);
    }
    
    getEntryByProperty(entries, property, value) {
        var me = this;
        var reporter = me.reporter;

        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];
            if (entry[property] === value) {
                return entry;
            }
        }

        return null;
    }

    down(data) {
        var me = this,
            reporter = me.reporter;

        var addChildEntry = function () {
            var descriptor = reporter.getDescriptor(me.dir),
                children = descriptor.children,
                name = data.name,
                dirname, childEntry, childDescriptor;
            
            // find the existing child entry for this test asset
            childEntry = me.getEntryByName(children, data.name);
            if (!childEntry) {
                childEntry = {
                    name: data.name,
                    type: data.type,
                    dir: reporter._newUniqueDirName(name, children)
                };
                children.push(childEntry);
            }
            
            dirname = childEntry.dir;
            childDescriptor = reporter.getDescriptor(me.dir.join(dirname));
            if (data.id !== undefined) {
                // sequential unique ID
                childDescriptor.id = ++reporter.idSeed;
            }
            childDescriptor.name = data.name;
            childDescriptor.type = data.type
            childEntry.id = childDescriptor.id;
            
            return dirname;
        };

        var goDown = function (dir) {
            return co(function* () {
                var newdir = me.dir.join(dir);
                var exists = yield xfs.exists(newdir);
                if (!exists) {
                    yield xfs.mkdir(newdir);
                }
                me.dir = newdir;
            });
        };

        var initDescriptor = function () {
            var descriptor = reporter.getDescriptor(me.dir);
            if (!descriptor.name) {
                descriptor.name = data.name;
                descriptor.type = data.type;
            }
        }

        var initMap = function () {
            var id = data.id;
            
            if (!me._map[data.type]) {
                me._map[data.type] = {};
            }

            // lookup table - uses browser-generated hash ID
            if (!me._map[data.type][id]) {
                me._map[data.type][id] = me.dir.path;
            }
        }

        me.queue(addChildEntry);
        me.queue(goDown);
        me.queue(initDescriptor);
        if (data.id !== undefined) {
            me.queue(initMap);
        }
    }

    addTest(data) {
        var me = this,
            reporter = me.reporter;
        
        me.queue(function () {
            var descriptor = reporter.getDescriptor(me.dir),
                children = descriptor.children,
                test = null;

            for (var i = 0; i < children.length; i++) {
                if (children[i].name === data.name) {
                    test = children[i];
                    break;
                }
            }

            if (!test) {
                test = {
                    // sequential ID, shared across all contexts/browsers,
                    // used by the result grid and result merger
                    id: ++reporter.idSeed,
                    name: data.name,
                    disabled: data.disabled,
                    type: 'test'
                };
                descriptor.children.push(test);
            }

            // hash ID generated by the browser, used only for lookup
            // within the context
            me._map.test[data.id] = test;
        });
    }
    
    saveScreenshot(name, buffer) {
        var me = this;
        return new Promise(function (resolve, reject) {
            me.queue(co(function* () {
                yield me.archiver._ensureBaselineExists();
                var absolutePath = me.dir.join(me.browserId + '-' + name + '.png');
                var relativePath = me.archiver.basedir.relativeTo(absolutePath);
                yield absolutePath.write(buffer);

                var expected = me.archiver.baselinedir.join(relativePath);
                if (yield expected.exists()) {
                    var comparator = new Comparator();
                    var diff = yield comparator.compare(expected.path, absolutePath.path);
                    var diffCount = diff.diffCount;
                    var baselineRelativePath, diffRelativePath;
                    if (diffCount) {
                        var baselineAbsolutePath = me.dir.join(me.browserId + '-' + name + '-baseline.png');
                        var diffAbsolutePath = me.dir.join(me.browserId + '-' + name + '-diff.png');
                        baselineRelativePath = me.archiver.basedir.relativeTo(baselineAbsolutePath).slashify();
                        diffRelativePath = me.archiver.basedir.relativeTo(diffAbsolutePath).slashify();
                        yield diff.save(diffAbsolutePath);
                        yield xfs.copy(expected, baselineAbsolutePath);
                    }
                    resolve({
                        passed: diffCount == 0,
                        diffCount: diffCount,
                        path: relativePath.slashify(),
                        baseline: baselineRelativePath,
                        diff: diffRelativePath
                    });
                } else {
                    resolve({
                        passed: true,
                        path: relativePath.slashify()
                    });
                }
            }).catch(function (err) {
                console.error('[ARCHIVER] Error processing screenshot %s from %s', name, me.browserId);
                console.error(err.stack || err);
            }));
        });
    }

}

module.exports = ArchiveReporter;
