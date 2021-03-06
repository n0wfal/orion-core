"use strict";

var Entity = require('./Entity');
var App = require('./cmd/App');
var Framework = require('./cmd/Framework');
var Package = require('./cmd/Package');
var Project = require('./test/Project');
var Testable = require('./Testable');

var Browser = require('orion-core/lib/model/browser/Browser');
var Farm = require('orion-core/lib/model/farm/Farm');
var BrowserPool = require('orion-core/lib/model/farm/Pool');
var SauceLabs = require('orion-core/lib/model/farm/SauceLabs');
var BrowserStack = require('orion-core/lib/model/farm/BrowserStack');
var Embedded = require('orion-core/lib/model/farm/Embedded');
var Json = require('orion-core/lib/Json');
var Configuration = require('../config/Configuration');

var xfs = require('orion-core/lib/xfs');
var File = require('orion-core/lib/fs/File');
var Util = require('orion-core/lib/Util');
var WorkspaceScanner = require('orion-core/lib/model/WorkspaceScanner');

var fs = require('fs');
var path = require('path');

var farmTypeMap = {
    saucelabs: SauceLabs,
    browserstack: BrowserStack,
    generic: Farm,
    embedded: Embedded
};

/**
 * This class manages a Workspace definition.
 */
class Workspace extends Entity {
    static get meta () {
        return {
            prototype: {
                isWorkspace: true
            },
            mixins: [
                Testable
            ]
        };
    }

    ctor () {
        var me = this;

        me.apps = [];
        me.packages = [];
        me.frameworks = [];
        me.farms = [];
        me.pathMap = {};
    }

    add (item) {
        var me = this,
            collection;

        if (item instanceof App) {
            collection = me.apps;
        }
        else if (item instanceof Framework) {  // must come before Package
            collection = me.frameworks;
        }
        else if (item instanceof Package) {
            collection = me.packages;
        }
        else if (item instanceof Farm) {
            collection = me.farms;
        }
        else if (item instanceof Project) {
            // no collection to add
        }
        else {
            throw new Error('Unrecognized item type');
        }

        if (collection) {
            collection.push(item);
        }

        if (item.dir) {
            me.pathMap[xfs.normalize(item.dir)] = item;
        }

        item.workspace = me;
    }

    eachApp (fn, scope) {
        return this._each(this.apps, fn, scope);
    }

    eachFramework (fn, scope) {
        return this._each(this.frameworks, fn, scope);
    }

    eachPackage (fn, scope) {
        return this._each(this.packages, fn, scope);
    }

    eachFarm (fn, scope) {
        return this._each(this.farms, fn, scope);
    }

    /**
     * Locates the workspace member whose directory
     * matches exactly the provided path
     *
     * @param {String} path to the workspace member
     *
     * @returns {WorkspaceMember}
     */
    fromPath () {
        var s = this.resolve.apply(this, arguments);

        s = xfs.normalize(s);

        return this.pathMap[s] || null;
    }

    /**
     * Locates the workspace member whose directory
     * matches or is parent of the provided path
     *
     * @param {String} path to or within the workspace member
     *
     * @returns {WorkspaceMember}
     */
    fromDeepPath () {
        var me = this;
        var resolved = me.resolve.apply(me, arguments);
        var normalized = xfs.normalize(resolved);
        var pathMap = me.pathMap;

        for (var key of Object.keys(pathMap)) {
            if (normalized.indexOf(key) === 0) {
                var member = pathMap[key];
                return member;
            }
        }

        return null;
    }

    getTestScenario (path) {
        var me = this;
        var testables = [];
        
        testables = testables.concat(me.apps);
        testables = testables.concat(me.packages);
        if (me.tests) {
            testables.push(me);
        }
        
        for (let testable of testables) {
            if (testable.tests) {
                for (let scenario of testable.tests.scenarios) {
                    let scenarioDir = File.get(scenario.resolve());
                    if (scenarioDir.equals(path) || scenarioDir.contains(path)) {
                        return scenario;
                    }
                }
            }
        }
        
        return null;
    }

    getBrowserFarm (name) {
        var farms = this.farms,
            farm, i;

        name = name.toLowerCase();

        for (i = 0; i < farms.length; ++i) {
            if (name === (farm = farms[i]).getName().toLowerCase()) {
                return farm;
            }
        }

        return null;
    }

    isSoloApp () {
        if (this.apps.length === 1) {
            var app = this.apps[0];

            return this.dir === app.dir;
        }

        return false;
    }

    getTestProjectPath () {
        /*
            Workspaces store a "tests" object at their root object:

                "tests": {
                    "path": "test/project.json"
                }
         */
        var path = this.get('tests');

        path = path && path.path;
        path = path && this.resolve(path);

        return path;
    }

    setSourceFile (sourceFile) {
        super.setSourceFile(sourceFile);

        var data = this.data,
            s;

        if (sourceFile && !data.name) {
            s = new File(this.dir).name;
            data.name = s.charAt(0).toUpperCase() + s.substring(1);
        }
    }

    setTestProjectPath (path) {
        var tests = this.get('tests');

        if (!tests) {
            this.set('tests', tests = {});
        }

        tests.path = path;
    }

    setCmdClient (client) {
        this.cmdClient = client;
    }

    resolveVariables (path) {
        return path.split('${workspace.dir}').join(this.dir);
    }

    update (client) {
        this.setCmdClient(client);
        this.loadCmdWorkspace();
    }

    loadChildren () {
        var me = this;

        return Promise.all([
            me._loadTests(),
            me._loadApps(),
            me._loadFrameworks(),
            me._loadPackages(),
            me._loadBrowserPools()
        ]).then(function () {
            return me;
        });
    }

    loadCmdWorkspace () {
        var me = this,
            client = me.cmdClient,
            dirMap = {
                application: 'app.dir',
                package: 'package.dir',
                frameworkpackage: 'framework.dir'
            };

        if (!client) {
            return;
        }

        client.loadWorkspace(me.path).then(function (wsData) {
            me.cmdConfigs = wsData.configs;

            wsData.children.forEach(function (item) {
                var config = item.config,
                    item = dirMap[item.type];

                if (item) {
                    item = me.fromPath(config[item]);
                    if (item) {
                        item.cmdConfig = config;
                        item.cmdClient = client;
                    }
                }
            });
        //}).catch(function(err) {
        //    Studio.alert('Error loading workspace data from Cmd : ' + err); not here
        });
    }
    
    createFarm(data) {
        var me = this;
        var typeName = data.type;
        var Type = farmTypeMap[typeName] || Farm
        var farm = new Type(data);
        
        if (typeName && !farmTypeMap[typeName]) {
            farm.error = new Error('Unknown browser farm type "' + typeName + '"');
        }
        
        farm.workspace = me;
        me.add(farm);
        
        return farm;
    }

    //-------------------------------------------------------------------
    // Static

    static get jsonName () { return 'workspace.json'; }
    static get configName () { return '.sencha/workspace/sencha.cfg'; }

    static get kind () { return 'Workspace'; }

    static find (startAt) {
        return new Promise(function (resolve, reject) {
            var file = new File(startAt),
                dir = file;

            if (!file.existsSync()) {
                reject(xfs.wrapError(startAt, startAt + ' does not exist'));
                return;
            }
            
            function scan (dir) {
                var jsonFile = dir.join(Workspace.jsonName),
                    configFile = dir.join(Workspace.configName),
                    parent;

                if (jsonFile.existsSync()) {
                    resolve(jsonFile);
                }
                else {
                    if (configFile.existsSync()) {
                        var scanner = new WorkspaceScanner();
                        scanner.scan(dir).then(function(cfg){
                            jsonFile.writeJson(cfg, {
                                prettyPrint: true
                            }).then(function(){
                                resolve(jsonFile);
                            }, reject);
                        }, reject);
                    }
                    else {
                        parent = dir.parent;
                        if (parent) {
                            scan(parent);
                        }
                        else {
                            reject(xfs.wrapError(startAt, startAt + ' is not a valid workspace'));
                        }
                    }
                }
            }

            scan(dir);
        });
    }

    //-------------------------------------------------------------------
    // Private

    _each (items, fn, scope) {
        if (items) {
            for (var i = 0; i < items.length; ++i) {
                if (fn.call(scope, items[i]) === false) {
                    break;
                }
            }
        }
    }

    _loadTests() {
        var me = this;
        return me.loadTests().then(function (project) {
            if (!!project) {
                me.add(project);
            }
            return project;
        });
    }


    _loadApps () {
        var me = this,
            apps = me.data.apps,
            loading = [];

        if (apps) {
            apps.forEach(function (relPath) {
                if (relPath.path) {
                    relPath = relPath.path;
                }

                loading.push(App.load(me.resolve(relPath), me).then(function (app) {
                    me.add(app);
                    app.setRelativePath(relPath);
                    return app;
                }));
            });
        }
        else if (xfs.existsSync(xfs.join(me.dir, 'app.json'))) {
            // In simple cases, the app and workspace are in the same folder.
            return App.load(me.dir, me).then(function (app) {
                me.add(app);
                app.setRelativePath('');
                return app;
            });
        }

        return Promise.all(loading).then(function (apps) {
            me.apps.sort(function (a, b) {
                var n1 = a.getName().toLowerCase(),
                    n2 = b.getName().toLowerCase();

                if (n1 < n2) {
                    return -1;
                }
                if (n2 < n1) {
                    return 1;
                }
                return 0;
            });

            return apps;
        });
    }

    _loadFrameworks () {
        var me = this,
            properties = new Configuration(),
            path = me.dir + '/.sencha/workspace/sencha.cfg',
            all = [],
            dir;

        properties.loadSync(path);

        dir = properties.get('ext.dir');
        if (dir) {
            all.push(Framework.load(me.resolve(dir), me).then(function (framework) {
                me.add(framework);
            }));
        }

        dir = properties.get('touch.dir');
        if (dir) {
            all.push(Framework.load(me.resolve(dir), me).then(function (framework) {
                me.add(framework);
            }));
        }

        return Promise.all(all);
    }

    _loadPackages () {
        var me = this,
            local = me.data.packages;
            //loading = [],
            //items;

        local = (local && local.dir) || 'packages';

        return Package.loadAll(local, me).then(function (packages) {
            packages.forEach(me.add, me);
        });
    }

    _loadBrowserPools () {
        var me = this,
            tests = me.data.tests,
            loading = [],
            hasEmbedded = false, 
            browserPools, farms, invalidFarm, isFarmArray;

        if (tests && tests.browser) {
            farms = tests.browser.farms;
            isFarmArray = Array.isArray(farms);
            
            if (isFarmArray) {
                farms.forEach(function (data) {
                    if (data.type === 'embedded') {
                        hasEmbedded = true;
                    }
                });
            }

            if (!hasEmbedded && (!farms || isFarmArray)) {
                farms = isFarmArray ? farms : [];
                farms.unshift({
                    type: 'embedded',
                    name: 'embedded',
                    pools: [{
                        name: 'Embedded',
                        path: Studio.filesDir.join('embedded-pool.js').path
                    }]
                });
            }

            if (Array.isArray(farms)) {
                farms.forEach(function (data) {
                    var farm = me.createFarm(data);
                    farm.eachPool(function (pool) {
                        loading.push(pool.loadConfigFile());
                    });
                });
            }
            else if (farms) {
                throw new Error('Invalid workspace.json file: "tests.browser.farms" must be an array');
            }
        }

        return Promise.all(loading);
    }

}

module.exports = Workspace;
