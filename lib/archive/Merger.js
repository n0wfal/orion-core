'use strict';

var Observable = require('orion-core/lib/Observable');
var File = require('orion-core/lib/fs/File');
var Zip = require('orion-core/lib/fs/Zip');
var Json = require('orion-core/lib/Json');

var co = require('co');
var mv = require('mv');
var util = require('util');
var xfs = require('orion-core/lib/xfs');
var path = require('path');

/**
 * Result archive merger
 */
class Merger extends Observable {

    /**
     * @cfg archive1
     */

    /**
     * @cfg archive2
     */

    /**
     * Merge an archive dir into another existing archive dir
     * 
     * @param archive1 path to the destination archive directory (to)
     * @param archive2 path to the source archive directory (from)
     * 
     * @returns {Promise}
     */
    merge(archive1, archive2) {
        var me = this,
            rootDir1, rootDir2,
            rootDataFile1, rootDataFile2,
            rootData1, rootData2;
        
        me.rootDir1 = rootDir1 = (archive1.$isFile ? archive1 : new File(xfs.resolve(archive1)));
        me.rootDir2 = rootDir2 = (archive2.$isFile ? archive2 : new File(xfs.resolve(archive2)));

        me.rootDataFile1 = rootDataFile1 = rootDir1.join('data.json');
        me.rootDataFile2 = rootDataFile2 = rootDir2.join('data.json');
        
        return co(function* () {
            var dictionary = yield me._getBrowserIdDictionary(),
                rootData1 = yield Json.read(rootDataFile1.path),
                maxId = rootData1.maxId || 0;
                
            function* mergeDirectory(dir1, dir2, id) {
                var dataFile1 = dir1.join('data.json'),
                    dataFile2 = dir2.join('data.json'),
                    data1, data2;
                
                data2 = yield Json.read(dataFile2.path);
                
                // read or initialize target data.json
                yield dir1.ensurePathExists();
                data1 = (yield dataFile1.exists())
                    ? (yield Json.read(dataFile1.path)) 
                    : {
                        // recursive invocation will align newly assigned IDs
                        "id": id,
                        "type": data2.type,
                        "name": data2.name,
                        "dir": data2.dir
                    };
                
                // sum up total failures per browser
                for (let id of Object.keys(dictionary)) {
                    let translatedId = dictionary[id];
                    data1[translatedId] = (data1[translatedId] || 0) + data2[id]; 
                }
                
                function mergeEntries(array1, array2, matchProperty) {
                    var existingNames = {};
                    
                    for (let entry of array1) { 
                        existingNames[entry[matchProperty]] = 1;
                    }
                    
                    for (let entry of array2) {
                        if (!existingNames[entry[matchProperty]]) {
                            array1.push(entry);
                        }
                    }
                    
                    return array1;
                }
                
                // reassign IDs
                for (let child of data2.children) {
                    child.id = ++maxId;
                }
                
                // merge children array (this array will always exist in dir2/data.json)
                if (!data1.children) {
                    data1.children = data2.children;
                } else {
                    data1.children = mergeEntries(data1.children, data2.children, 'name');
                }
                
                // merge scenarios
                if (data2.scenarios) {
                    if (!data1.scenarios) {
                        data1.scenarios = data2.scenarios;
                    } else {
                        data1.scenarios = mergeEntries(data1.scenarios, data2.scenarios, 'path');
                    }
                }
                
                // merge browsers
                if (data2.browsers) {
                    if (!data1.browsers) {
                        data1.browsers = data2.browsers;
                    } else {
                        // translate browser ids
                        for (let browser of data2.browsers) {
                            browser.id = dictionary[browser.id];
                        }
                        data1.browsers = mergeEntries(data1.browsers, data2.browsers, 'id');
                    }
                }
                
                if (data2.coverages) {
                    if (!data1.coverages) {
                        data1.coverages = data2.coverages;
                    } else {
                        // copy coverage files
                        let copyOperations = [];
                        for (let coverage of data2.coverages) {
                            yield xfs.copy(dir2.join(coverage.path), dir1.join(coverage.path));
                        }
                        data1.coverages = mergeEntries(data1.coverages, data2.coverages, 'path');
                    }
                }
                
                yield Json.write(dataFile1.path, data1);
                
                for (let child of data2.children) {
                    if (child.dir) {
                        // inform recursion about the newly assigned ID
                        let id = child.id;
                        yield mergeDirectory(dir1.join(child.dir), dir2.join(child.dir), id);
                    }
                }
            };
            
            yield mergeDirectory(rootDir1, rootDir2);
            
            // update maximum assigned ID in the root descriptor
            rootData1 = yield Json.read(rootDataFile1.path);
            rootData1.maxId = maxId;
            yield Json.write(rootDataFile1.path, rootData1);
        });
    }

    _getBrowserIdDictionary() {
        var me = this,
            rootData1,
            rootData2;
        return Promise.all([
            Json.read(me.rootDataFile1.path).then(function (data) {
                rootData1 = data;
            }),
            Json.read(me.rootDataFile2.path).then(function (data) {
                rootData2 = data;
            }),
        ]).then(function () {
            var browserIndex = {},
                dictionary = {},
                browsers1 = rootData1.browsers,
                browsers2 = rootData2.browsers;
            
            for (let browser of browsers1) {
                browserIndex[browser.id] = browser;
            }
            
            for (let browser of browsers2) {
                let id = browser.id,
                    existing = browserIndex[id];
                
                if (existing && (existing.name !== browser.name || existing.userAgent !== browser.userAgent)) {
                    let originalId = id,
                        index = 0;
                    do {
                        id = originalId + '-' + ++index;
                    } while (browserIndex[id])
                    dictionary[originalId] = id;
                } else {
                    browserIndex[id] = browser;
                    dictionary[id] = id;
                }
            }
            return dictionary;
        });
    }
    
}

module.exports = Merger;
