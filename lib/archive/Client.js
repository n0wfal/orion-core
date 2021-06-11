'use strict';

var Base = require('orion-core/lib/Base');
var Zip = require('orion-core/lib/fs/Zip');

var fs = require('mz/fs');
var request = require('request');
var url = require('url');
var util = require('util');
var path = require('path');

class Client extends Base {
    
    upload(archive, options) {
        var me = this;
        
        return new Promise(function (resolve, reject) {
            var postUrl = url.resolve(me.server, '/upload');
            var formData = {
                storageKey: options.storageKey || me.storageKey,
                archivePath: options.archivePath || '',
                archive: fs.createReadStream(archive)
            };
            request.post({url: postUrl, formData: formData}, function (err, resp, body) {
                if (err) {
                    reject(err);
                } else {
                    resolve(util.format('Server response: %s - %s', resp.statusCode, (body || resp.statusMessage)));
                }
            });
        });
    }

    download(options) {
        var me = this,
            localPath = options.localPath;

        return new Promise(function(resolve, reject) {
            var postUrl = url.resolve(me.server, '/download'),
                params = {
                    root: options.root,
                    storageKey: options.storageKey || me.storageKey,
                    path: options.path
                };

            request.post({url: postUrl, json: params, encoding: null}, function (err, resp, body) {
                var doResolve = function () {
                    resolve(util.format('Server response: %s', resp.statusCode));
                }
                if (err) {
                    reject(err);
                } else {
                    if (resp.statusCode === 200) {
                        fs.writeFile(path.normalize(localPath) + '.zip', body, function() {
                            Zip.extract(localPath + '.zip', path.dirname(localPath)).then(function() {
                                doResolve();
                            }, function(err) {
                                reject(err);
                            });
                        });
                    } else {
                        doResolve();
                    }
                }
            });
        });
    }
    
}

module.exports = Client;
