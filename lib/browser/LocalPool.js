'use strict';

var detecter = require('browser-launcher2/lib/detect'),
    LocalBrowser = require('orion-core/lib/model/browser/Local'),
    EmbeddedBrowser = require('orion-core/lib/model/browser/Embedded'),
    LocalBrowser = require('orion-core/lib/model/browser/Local'),
    Observable = require('orion-core/lib/Observable'),
    Pool = require('orion-core/lib/model/farm/Pool'),
    instance;

class LocalPool extends Observable {

    /**
     * @property {LocalPool} a singleton instance
     */
    static get instance() {
        return instance || (instance = new LocalPool());
    }

    /**
     * @private Do not call constructor directly always use the singleton instance
     */
    ctor () {
        this.id = Pool.nextId();
        this.name = 'Local Browsers';
        this.browsers = [];
        this.agentGroups = [];
        this.data = {
            name: this.name
        }
    }

    getName () {
        return this.name;
    }
    
    get browserClass() {
        return LocalBrowser;
    }

    add (browser) {
        var me = this,
            match = false,
            browsers = me.browsers;

        if (!browser.isBrowser) {
            browser = new LocalBrowser(browser);
        }
        browser.manager = me;

        return new Promise(function (resolve, reject) {
            browsers.forEach(function (existing) {
                var props = [
                        'command',
                        'description',
                        'name',
                        'type',
                        'profile',
                        'version'
                    ],
                    test = true;

                if (!match) {
                    props.forEach(function (prop) {
                        test = test && (existing.data[prop] === browser.data[prop]);
                    });
                    match = test;
                }
            });

            if (!match) {
                me.browsers.push(browser);
                browser.pool = me;

                if (!browser.detected) {
                    me._cacheUserBrowsers();
                }
            }

            resolve(browser);
        });
    }

    remove (browser) {
        var browsers = this.browsers,
            index = browsers.indexOf(browser);

        if (index !== -1) {
            browsers.splice(index, 1);
        }

        browser.pool = null;

        if (!browser.detected) {
            this._cacheUserBrowsers();
        }
    }

    update (browser, data) {
        Object.assign(browser, data);
        this._cacheUserBrowsers();
    }

    getBrowsers () {
        var me = this,
            browsers = me.browsers,
            userBrowsers;

        return new Promise(function(resolve, reject) {
            if (me._browsersInited) {
                resolve(browsers);
            } else {
                me.detect().then(function() {
                    if (window.localStorage) {
                        // If we are running in a browser environment we also need to check
                        // for browsers in localStorage that the user may have saved
                        userBrowsers = JSON.parse(localStorage.getItem('orionUserLocalBrowsers'));

                        if (userBrowsers) {
                            userBrowsers.forEach(function(userBrowser) {
                                me.add(new LocalBrowser(userBrowser));
                            });
                        }
                    }

                    me._browsersInited = true;
                    resolve(browsers);
                });
            }
        });
    }

    /**
     * Looks up a browser in the local pool by userAgent string.
     * @param {UserAgent} userAgent
     * @return {Browser}
     */
    lookupBrowserByUserAgent (userAgent) {
        return this.browsers.find(function(browser) {
            return browser.matchesUserAgent(userAgent);
        });
    }

    detect () {
        var me = this;

        return new Promise(function(resolve, reject){
            detecter(function(detected){
                detected.forEach(function(b){
                    if (b.type.toLowerCase() === 'ie') {
                        if (b.command.indexOf('Program Files (x86)') > -1) {
                            return;
                        }
                    }

                    if (b.type.toLowerCase() === 'phantomjs') {
                        return;
                    }

                    var rec = new LocalBrowser({
                        name: b.name,
                        type: b.type,
                        version: b.version,
                        command: b.command,
                        // detected browsers won't have profiles enabled, need custom ones
                        // to control the profile directory
                        profile: '',
                        detected: true
                    });

                    rec.detected = true;
                    me.add(rec);
                });
                
                resolve(me);
            });
        });
    }

    _cacheUserBrowsers () {
        var userBrowsers;

        if (window.localStorage) {
            // When running in a browser environment, user-added browsers are cached in localStorage
            userBrowsers = [];

            this.browsers.forEach(function (browser) {
                var data = browser.data;

                if (!data.detected) {
                    userBrowsers.push({
                        description: data.description,
                        name: data.name || data.browserName, // backward compatibility
                        version: data.version,
                        command: data.command,
                        profile: data.profile,
                        type: data.type
                    });
                }
            });

            localStorage.setItem('orionUserLocalBrowsers', JSON.stringify(userBrowsers));
        }
    }

    save () {
        this._cacheUserBrowsers();
    }

    sync (browsers) {
    }
}

LocalPool.prototype.isLocalPool = true;

module.exports = LocalPool;
