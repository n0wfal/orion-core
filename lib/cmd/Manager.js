'use strict';

var Base = require('../Base'),
    ProcessUtil = require('../process/ProcessUtil'),
    Client = require('./Client'),
    Version = require('../Version'),
    Path = require('path'),
    xfs = require('../xfs'),
    File = require('../fs/File');

var minimumCmdVer = '6.0.0';

class Manager extends Base {

    forEachClient (fn, scope) {
        var clients = this.clients,
            key;

        for (key in clients) {
            if (false === fn.call(scope, clients[key])) {
                break;
            }
        }
    }

    ctor () {
        var me = this;

        Object.assign(me, {
            versions: [
                // '6.1.0.2', ...
            ],
            clients: {
                // '6.1.0.2': new Client()
            },
            current: null, // clients['6.1.0.2']
            latest: null, // clients['6.1.0.123'],
            installDir: me.installDir || xfs.homeDir.join('bin/Sencha/Cmd')
        });

        try {
            me._detectFileSystem();
        } catch (err) {
            console.error(err.stack || err);
            try {
                me._detectPath();
            } catch (e) {
                me.error = e || err;
            }
        }
    }

    _detectPath () {
        var me = this,
            current = false,
            latest = false,
            local = false,
            i, line, lines, out, stdout, version, proc;

        proc = ProcessUtil.spawnSync('sencha', ['switch', '-list'], {
            encoding: 'utf8'
        });

        if (proc.status || proc.error) {
            var error = proc.error || proc.stderr;
            console.error(error.stack || error);
            throw new Error(error);
        }

        stdout = proc.stdout;
        out = stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        lines = out.split(/\n/g);

        for (i = 0; i < lines.length; i++) {
            line = lines[i];
            line = line && line.trim();

            if (line) {
                if (line.indexOf('Looking for versions at: ') > -1) {
                    me.basePath = line.substring(25);
                } else {
                    line = line.toLowerCase();
                    if (line.indexOf('current version') > -1) {
                        current = true;
                    } else if (line.indexOf('newest version installed') > -1) {
                        latest = true;
                    } else if (line.indexOf('locally available versions') > -1) {
                        local = true;
                    } else if (/\d{1,4}\.\d{1,4}\.\d{1,4}\.\d{1,4}/.test(line)) {
                        version = line.trim();
                        var Ver = new Version(version);
                        if (Ver.gt(minimumCmdVer)) {
                            if (local) {
                                me.versions.push(version);
                                me.clients[version] = new Client({
                                    manager: me,
                                    version: new Version(version),
                                    directory: Path.join(me.basePath, version)
                                });
                            }
                            else if (latest) {
                                me.latest = version;
                            }
                            else if (current) {
                                me.current = version;
                            }
                        }
                    }
                }
            }
        }

        me.latest = me.clients[me.latest];
        me.current = me.clients[me.current] || me.latest;
    }

    _detectFileSystem() {
        var me = this,
            senchaBase = me.installDir;

        if (senchaBase.existsSync()) {
            var files = senchaBase.getFilesSync(),
                rx = /^\d{1,4}\.\d{1,4}\.\d{1,4}\.\d{1,4}$/,
                items;

            items = files.filter(function(item){
                if (item.isFile()) {
                    return false;
                }
                return rx.test(item.name);
            }).map(function(file){
                return {
                    file: file,
                    ver: new Version(file.name)
                }
            });

            items.sort(function(a, b){
                return Version.compare(a.ver, b.ver);
            });

            files = items.map(function(item){
                return item.file;
            });

            files.forEach(function(file) {
                var version = new Version(file.name),
                    client = new Client({
                        manager: me,
                        version: version,
                        directory: file.getCanonicalPath()
                    });

                if (version.gt(minimumCmdVer)) {
                    me.versions.push(version.toString());
                    me.clients[version.toString()] = client;
                    me.latest = client;
                    me.current = client;
                }
            });

            var verFile = senchaBase.join('version.properties');
            if (verFile.existsSync()) {
                var data = verFile.readSync(),
                    prefix = "version.full=",
                    idx = data.indexOf(prefix),
                    current;

                if (idx === 0) {
                    current = data.substring(prefix.length).trim();
                    if (me.clients[current]) {
                        me.current = me.clients[current];
                    }
                }
            }
            if (!me.current && me.latest) {
                me.current = me.latest;
            }
        }
        else {
            throw new Error("Sencha Cmd install directory not found : " + senchaBase);
        }

    }
}

module.exports = Manager;
