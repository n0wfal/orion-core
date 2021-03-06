'use strict';

var child_process = require('child_process');
var path = require('path');
var scriptName = 'shell-wrapper.sh';
var xfs = require('../xfs');
var tmpDir = xfs.tempDir;
var homeDir = xfs.homeDir;
var File = require('../fs/File');
var scriptName = 'shell-wrapper.sh';

var dir = new File(__dirname);
var wrapperBase = path.join(__dirname, scriptName);
var wrapper = new File(dir, scriptName);

var platform = {
        isLinux: /^linux/.test(process.platform),
        isMac: /^darwin/.test(process.platform),
        isWin: /^win/.test(process.platform)
    };

var fs = require('fs');
var pidFormat = /^\d+$/;

class ProcessUtil {

    _getCfg (executable, args, options) {
        if (platform.isWin) {
            return this._getWinCfg(executable, args, options);
        } else {
            return this._getUnixCfg(executable, args, options);
        }
    }

    _getWinCfg (executable, args, options) {
        args = args || [];
        args.unshift('/C', executable);
        executable = 'cmd.exe';
        var opts = {
            encoding: 'utf8'
        };
        Object.assign(opts, options);
        return {
            executable: executable,
            args: args,
            options: opts
        };
    }

    _getUnixCfg (executable, args, options) {
        args = args || [];
        args.unshift('-l', wrapper.getCanonicalPath(), executable);
        executable = '/bin/sh';
        var opts = {
            encoding: 'utf8'
        };
        Object.assign(opts, options);
        return {
            executable: executable,
            args: args,
            options: opts
        };
    }

    spawn (cfg, args, options) {
        if (typeof cfg === 'string') {
            cfg = this._getCfg(cfg, args, options);
        }

        if (cfg.options && cfg.options.cwd) {
            let file = new File(cfg.options.cwd);

            file.ensurePathExistsSync();
        }

        return child_process.spawn(cfg.executable, cfg.args, cfg.options);
    }

    spawnSync (cfg, args, options) {
        if (typeof cfg === 'string') {
            cfg = this._getCfg(cfg, args, options);
        }

        if (cfg.options && cfg.options.cwd) {
            let file = new File(cfg.options.cwd);

            file.ensurePathExistsSync();
        }

        return child_process.spawnSync(cfg.executable, cfg.args, cfg.options);
    }

    exec (cmd, options, callback) {
        if (options && options.cwd) {
            let file = new File(options.cwd);

            file.ensurePathExistsSync();
        }

        return child_process.exec(cmd, options, callback);
    }

    _winKill (pid) {
        var res = this.spawnSync({
            executable: 'taskkill',
            args: [
                '/PID',
                pid,
                '/F',
                '/T'
            ],
            options: {
                encoding: 'utf8'
            }
        });
        if (res.error) {
            console.error(res.error.stack || res.error);
        }
        return res.status === 0 && !res.error
    }

    _unixKill (pid) {
        var me = this,
            res = child_process.spawnSync('pgrep', ['-P', pid], {
                encoding: 'utf8'
            }),
            out, num;
        if (res.status === 0) {
            out = res.stdout.split('\n');
            out.forEach(function(line) {
                line = line && line.trim();
                if (line && pidFormat.test(line)) {
                    num = parseInt(line);
                    me._unixKill(num);
                }
            });
        } else {
            if (res.error) {
                console.error(res.error.stack || res.error);
            }
        }
        res = child_process.spawnSync('kill', ['-9', pid], {
            encoding: 'utf8'
        });
        if (res.error) {
            console.error(res.error.stack || res.error);
        }
        return res.status === 0 && !res.error;
    }

    kill (pid) {
        if (platform.isWin) {
            return this._winKill(pid);
        } else {
            return this._unixKill(pid);
        }
    }
}

if ((wrapper.path.indexOf('app.asar') > 0) && (platform.isMac || platform.isLinux)) {
    // if this is a bundled electron app, then we need to extract the the bundled
    // shell script, as it won't be readable from the archive directly by the
    // child_process module
    try {
        var data = wrapper.readSync(),
            currentData;
        wrapper = homeDir.join('bin/sencha').join(scriptName);
        wrapper.getStat().then(function(stat){
            var doWrite = true,
                created, modified;

            if (stat) {
                currentData = wrapper.readSync();
                created = stat.birthtime.getTime();
                modified = stat.mtime.getTime();

                // if the wrapper file exists and was last modified more than a minute
                // after it was created, then we'll keep the user's modifications.
                // else, we'll overwrite the existing copy with a current one
                if ((modified - created) > (60 * 1000)) {
                    doWrite = false;
                }

                // if the file has not been modified, and the content is the same
                // as the current content, then don't write the file so we avoid
                // updating the time stamps
                else if (data == currentData) {
                    doWrite = false;
                }
            }

            if (doWrite) {
                if (stat) {
                    wrapper.removeSync();
                }
                wrapper.writeSync(data);
            }
        });
    } catch (err) {
        console.error(err.stack || err);
    }
}

module.exports = new ProcessUtil();
