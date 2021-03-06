'use strict';

var run = require('browser-launcher2/lib/run'),
    Instance = require('orion-core/lib/browser/Instance'),
    Observable = require('orion-core/lib/Observable'),
    Browser = require('./Browser'),
    Version = require('orion-core/lib/Version'),
    UserAgent = require('orion-core/lib/model/UserAgent');

class Local extends Browser {
    static get meta () {
        return {
            prototype: {
                isLocalBrowser: true
            }
        };
    }

    ctor() {
        var me = this;

        this.instances = {};
        this.instCount = 0;
    }

    launch (opts) {
        if (typeof opts === 'string') {
            opts = {
                url: opts
            };
        }

        var me = this;

        return new Promise(function (resolve, reject) {
            var name = me.data.name,
                version = me.data.version,
                profile = me.data.profile,
                command = me.data.command,
                type = me.data.type,
                launcher = run({
                    browsers: [{
                        // prefer browser type to the name
                        name: name,
                        type: type,
                        profile: profile,
                        command: command,
                        version: version
                    }]
                }, name, version),
                args = [];

            if (process.platform === 'darwin') {
                // fix an issue with the browser launcher improperly
                // re-arranging arguments
                if (type.startsWith('chrome')) {
                    args.push(opts.url);
                    //args.push('--no-default-browser-check');
                } else if (type.startsWith('opera')) {
                    args.push('--disable-restore-session-state');
                }
            }

            var launchOpts = Ext.apply({
                browser: name,
                version: version,
                command: command,
                detached: true,
                options: args
            }, opts);

            launcher(opts.url, launchOpts, function (err, instance) {
                if (err) {
                    reject(err);
                } else {
                    instance.process.unref();
                    instance.process.stdin.unref();
                    instance.process.stdout.unref();
                    instance.process.stderr.unref();
                    var inst = new Instance(this, instance);
                    var count = me.instCount = me.instCount + 1;
                    me.instances[count] = inst;
                    inst.idx = count;
                    inst.on({
                        scope: me,
                        stop: function(){
                            me.instances[inst.idx] = null;
                        }
                    });
                    resolve(inst);
                }
            });
        });
    }

    /**
     * Checks if the browser's name and version are a match for a given userAgent
     * @param {UserAgent} userAgent
     * @return {Boolean} `true` if the browser is a match
     */
    matchesUserAgent(userAgent) {
        var version = this.parsedVersion,
            browser = userAgent.browser,
            browserVersion = browser.version,
            osMatches = true,
            localUserAgent = UserAgent.local;

        if (localUserAgent) {
            // We can only reasonably check if the OS matches the current system OS
            // if we are running in a browser environment and have a userAgent string.
            // to compare to. The "os" node module can provide platform info but it will
            // be tricky to map the info to os/version from a userAgent string.  For example
            // os.platform() == 'darwin' && os.release == '14.5.0' maps to MAC OS X 10_10_5
            // in the userAgent string.  We probably won't ever need to match up browsers
            // based on userAgent string in headless mode however, since the runner will
            // be completely in control of launching the AgentGroups, so for now in headless
            // mode osMatches will always be true)
            osMatches = localUserAgent.isOsEqual(userAgent);
        }

        return osMatches && (
            (browser.name.toLowerCase() === this.data.name.toLowerCase()) &&
            // Only compare major and minor versions for now because the recognized
            // Patch and build versions may not match those that the browser sends in
            // The request userAgent string.
            // Example: Firefox 41.0.2 is detected on the system as "41.0.2" but the userAgent
            // string on the request contains "41.0" as the version.
            (browserVersion.major === version.major) &&
            (version.minor === 0 || browserVersion.minor === version.minor)
        );
    }

}

module.exports = Local;
