"use strict";

var archiver = require('archiver');
var fs = require('mz/fs');
var path = require('path');
// Use unzip2 instead of unzip due to:
// - https://github.com/EvanOxfeld/node-unzip/issues/20#issuecomment-74348436
// - https://github.com/EvanOxfeld/node-unzip/issues/47
var unzip = require('node-unzip-2');
var xfs = require ('orion-core/lib/xfs');
var File = require ('orion-core/lib/fs/File');

class Zip {
    /**
     * Zips up a directory.
     * @param {String} dir The directory
     * @param {String} [fileName] Filename for the zip file. Defaults to `dir + '.zip'`
     * @param {String[]} [include] Inclusion patterns (ant-style)
     * @param {String} [dest] Destination path inside the zip file
     * @return {Promise}
     */
    static fromDir(dir, fileName, include, dest)  {
        return new Promise(function (resolve, reject) {
            var output, archive;

            if (!fileName) {
                fileName = path.normalize(dir) + '.zip';
            }

            xfs.exists(dir).then(function(exists) {
                if (exists) {
                    output = fs.createWriteStream(fileName);
                    archive = archiver('zip');

                    output.on('close', function () {
                        resolve({ fileName: fileName, bytes: archive.pointer() });
                    });

                    archive.on('error', function (err) {
                        reject(err);
                    });

                    archive.pipe(output);

                    archive.bulk([{
                        expand: true,
                        cwd: dir,
                        src: include || ['**'],
                        dest: dest || path.basename(fileName, '.zip')
                    }]);

                    archive.finalize();
                } else {
                    reject('Cannot create zip file from directory. Directory does not exist: ' + dir);
                }
            });
        });
    }

    /**
     * Extracts a zip file to a directory
     * @param zipPath Full path to zip file
     * @param dir The directory to extract the contents of the zip file to.
     * The directory will be created if it does not exist.
     * @return {Promise}
     */
    static extract(zipPath, dir) {
        if (!dir) {
            dir = new File(zipPath).parent.path;
        }

        return new Promise(function(resolve, reject) {
            xfs.mkdir(dir).then(function () {
                fs.createReadStream(zipPath)
                    .pipe(unzip.Extract({ path: dir }))
                    .on('close', function(err) {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    })
                    .on('error', function(err) {
                        reject(err);
                    });
            }, function(err) {
                reject(err);
            });
        });
    }
}

module.exports = Zip;
