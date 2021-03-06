"use strict";

var Entity = require('orion-core/lib/model/Entity');
var Observable = require('orion-core/lib/Observable');
var Strings = require('orion-core/lib/Strings');
var Version = require('orion-core/lib/Version');

var canonicalNames = {
    'android browser':   'android',
    'android':           'android',
    'chrome':            'chrome',
    'chromium':          'chromium',
    'edge':              'edge',
    'htmlunit':          'htmlunit',
    'microsoft edge':    'edge',
    'microsoftedge':     'edge',
    'ie':                'ie',
    'internet explorer': 'ie',
    'ie mobile':         'iemobile',
    'ipad':              'ipad',
    'iphone':            'iphone',
    'firefox':           'firefox',
    'opera':             'opera',
    'opera browser':     'operamobile',
    'safari':            'safari',
    'mobile safari':     'safarimobile',
    'yandex':            'yandex'
};

var displayNames = {
    android:      'Android',
    chrome:       'Google Chrome',
    chromium:     'Chromium',
    edge:         'Microsoft Edge',
    htmlunit:     'HtmlUnit',
    ie:           'Internet Explorer',
    iemobile:     'Internet Explorer Mobile',
    ipad:         'iPad',
    iphone:       'iPhone',
    firefox:      'Firefox',
    opera:        'Opera',
    operamobile:  'Opera Mobile',
    safari:       'Safari',
    safarimobile: 'Safari Mobile',
    yandex:       'Yandex'
};

var canonicalPlatforms = {
    'android':  'android',
    'ios':      'ios',
    'linux':    'linux',
    'mac':      'osx',
    'opera':    'opera',
    'osx':      'osx',
    'os x':     'osx',
    'unix':     'unix',
    'vista':    'windows',
    'windows':  'windows',
    'winphone': 'windows',
    'xp':       'windows',
}

var displayVersionLengths = {
    chrome:       1,
    chromium:     1,
    edge:         1,
    ie:           1,
    firefox:      1,
    opera:        1
}

class Browser extends Entity {
    static get meta () {
        return {
            mixins: [
                Observable
            ],
            prototype: {
                isBrowser: true
            }
        };
    }
    
    static getCanonicalName(str) {
        str = (typeof str === 'string') ? str.toLowerCase() : str;
        return canonicalNames[str];
    }
    
    static getDisplayName(canonical) {
        return displayNames[canonical];
    }   
    
    static getCanonicalPlatform(str) {
        if (str == null) {
            return null;
        }
        
        str = (typeof str === 'string') ? str.toLowerCase() : (str + '');
        for (let key of Object.keys(canonicalPlatforms)) {
            if (str.indexOf(key) >= 0) {
                return canonicalPlatforms[key];
            }
        }
        
        return null;
    }
    
    ctor () {
        this.id = Browser.nextId();
    }
    
    get canonicalName() {
        var me = this;
        return me.getCanonicalName(me.data.type) || me.getCanonicalName(me.data.name);
    }
    
    get displayName() {
        var me = this;
        return me.data.description || me.getDisplayName(me.canonicalName) || me.data.name || me.data.type;
    }
    
    get parsedVersion() {
        var me = this,
            version = me.data.version;
        
        if (version && !version.isVersion) {
            version = new Version(version);
        }
        
        return version;
    }
    
    set parsedVersion(value) {
        if (value && !value.isVersion) {
            value = new Version(value);
        }
        this.data.version = value;
    }
    
    get displayVersion() {
        var me = this,
            numberOfGroups = displayVersionLengths[me.canonicalName] || 2,
            parsedVersion = me.parsedVersion,
            displayVersion;
        
        if (!parsedVersion) {
            return;
        }
        
        displayVersion = parsedVersion.major;
        if (numberOfGroups > 1) {
            displayVersion += '.' + parsedVersion.minor;
        }
         
        return displayVersion;
    }
    
    get canonicalPlatform() {
        var me = this;
        return me.getCanonicalPlatform(me.data.platformName);
    }
    
    get displayPlatform() {
        var me = this,
            displayPlatform = me.data.platformName,
            platformVersion = me.data.platformVersion;
        
        
        if (displayPlatform && platformVersion && platformVersion.version != 0) {
            platformVersion = platformVersion.isVersion ? platformVersion.version : platformVersion;
            displayPlatform = displayPlatform + ' ' + platformVersion;
        }
        
        return displayPlatform;
    }

    getCanonicalName (str) {
        return Browser.getCanonicalName(str);
    }
    
    getDisplayName (canonical) {
        return Browser.getDisplayName(canonical);
    }
    
    getCanonicalPlatform (str) {
        return Browser.getCanonicalPlatform(str);
    }

    canPersist () {
        return true;
    }
    
}

module.exports = Browser;
