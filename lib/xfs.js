var Util = require('orion-core/lib/Util');
// Util.stacktrace();
// throw new Error();
var fs = require('fs');
var path = require('path');
var File = require('./fs/File');
var slashRe = /\\/g;
var os = require('os');
var uuid = require('uuid');
const child_process = require('child_process');


var xfs = {
    splitRe: /[/\\]/g,
    separator: File.separator,

    //session: uuid.v1(),
    session: 'session',
    homeDir: new File(os.homedir()),
    childProcesses: [],
    
    setTempDir (tmp) {
        var me = xfs;
        if (!tmp.$isFile) {
            tmp = new File(tmp);
        }
        me.tempDir = new File(tmp, 'Sencha-Studio');
        me.tempSessionDir = new File(me.tempDir, me.session);
        me.tempSessionDir.remove().then(function(data){
            me.tempSessionDir.ensurePathExists();
        });
        me.tempSessionDir.removeOnExit();
    },

    exists (path, callback) {
        if (typeof callback === 'function') {
            new File(path).exists().then(function(exists) {
                callback(exists);
            }).catch(function (err) {
                console.error(err.stack || err);
            });
        } else {
            return new File(path).exists();
        }
    },

    existsSync (path) {
        try {
            fs.accessSync(path, fs.F_OK);
            return true;
        } catch (err) {
            return false;
        }
    },

    normalize (path) {
        return (path || '').replace(slashRe, '/');
    },

    wrapError (fileName, error) {
       return File.wrapError(fileName, error);
    },

    dirList (fileName, recursive) {
        return new File(fileName).getFiles(recursive);
    },

    dirListSync (dir, recursive) {
        return new File(dir).getFilesSync(recursive);
    },

    listAllFilesSync (dir) {
        return xfs.dirListSync(dir, true);
    },

    isDirectory (fileName) {
        return new File(fileName).isDirectory();
    },

    isFile (fileName) {
        return new File(fileName).isFile();
    },

    join () {
        return File.join.apply(File, arguments);
    },

    flatten (pathstr) {
        return File.flatten(pathstr);
    },

    resolve () {
        return path.resolve.apply(path, arguments);
    },

    split (fileName) {
        return File.split(fileName);
    },

    getRelativePath (from, to) {
        return new File(from).relativeTo(to).path;
    },

    mkdir (dir) {
        return new File(dir).ensurePathExists();
    },

    writeFile (fileName, content, options) {
        return new File(fileName).write(content, options);
    },

    removeFile (fileName) {
        return new File(fileName).remove();
    },

    copy (source, target) {
        return new Promise(function(resolve, reject) {
            var called = false;

            function done(err) {
                if (!called) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                    called = true;
                }
            }

            source = source + '';
            target = target + '';

            var rd = fs.createReadStream(source);
            rd.on("error", function(err) {
                done(err);
            });
            var wr = fs.createWriteStream(target);
            wr.on("error", function(err) {
                done(err);
            });
            wr.on("close", function(ex) {
                done();
            });
            rd.pipe(wr);
        });
    },

    rename (oldName, newName) {
        return new Promise(function(resolve, reject) {
            fs.rename(oldName, newName, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    },

    readFile (path, options) {
        return new File(path).read(options);
    },

    runCommands (commands, callback, scope) {
        var separator = (os.platform() === 'win32' || os.platform() === 'win64') ? ' & ' : ';',
            callNumber = this.callIndex++,
            me = this,
            command, child;

        if (this.removalTimer !== null) {
            clearTimeout(this.removalTimer);
        }

        if (os.platform()  === 'darwin' || os.platform() === 'linux') {
            // touch 2.3.1 introduces some non-ascii chars
            // and while LC_* is set correctly in a regular
            // user session on os x, it seems set to "C"
            // in an archtiect exec generated session which
            // fails the compile
            //
            // Note that once compiled succesfully, this
            // error will not show until .sass-cache is removed
            // which is in resources/sass for touch projects
            commands.unshift('export LC_CTYPE=en_US.UTF-8');
        }

        command = commands.join(separator);

        child = child_process.exec(command, function(error, stdin, stderr) {

            var err = stderr.toString(),
                output = stdin.toString();
            
            console.log('async call end: ' + callNumber);
            //TODO: remove when cmd runs properly
            if (err && output) {
                //remove err "invalid" input if we also have good input
                err = err.split('\n');
                err = err.filter(function(line) {
                    if (line.match(/^sed:.*No such file or directory$/)) {
                        console.log('removing sed error from cmd output');
                        return false;
                    }
                    return true;
                });
                err = err.join('\n');
            }
            callback.call(scope, err, output, command);
            me._scheduleChildRemoval();
        });
        me.childProcesses.push(child);
    },

    _scheduleChildRemoval () {
        var me = this;

        if (this.removalTimer !== null) {
            clearTimeout(this.removalTimer);
        }

        this.removalTimer = setTimeout(function() {
            me.childProcesses = [];
        },30000);
    }
};

xfs.setTempDir(os.tmpdir());

/**
 * Windows : C:\Users\username\.sencha\
 * Linux   : ~/.local/share/data/Sencha/
 * Mac     : ~/Library/Application Support/Sencha/
 * Other   : ~/.sencha
 */
xfs.profileDir = new File(function () {
    var ret = os.homedir();

    switch (os.platform()) {
        case 'win32':
            return xfs.join(process.env.USERPROFILE, '.sencha');

        case 'darwin':
            return xfs.join(ret, 'Library/Application Support/Sencha');

        case 'linux':
            return xfs.join(ret, '.local/share/data/Sencha');
    }

    return xfs.join(ret, '.sencha');
}());

module.exports = xfs;
