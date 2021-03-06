"use strict";

const Browser = require('./Browser');
const Entity = require('orion-core/lib/model/Entity');
const Observable = require('orion-core/lib/Observable');
const Strings = require('orion-core/lib/Strings');
const Version = require('orion-core/lib/Version');

class Generic extends Browser {

    get browserName() {
        return this.data.browserName;
    }
    
    get version() {
        return this.data.version;
    }
    
    get platform() {
        return this.data.platform;
    }
    
    get canonicalName() {
        var me = this;
        return me.getCanonicalName(me.data.browserName);
    }
    
    get canonicalPlatform() {
        var me = this;
        return me.getCanonicalPlatform(me.data.platform);
    }
    
    get displayName() {
        var me = this;
        return me.getDisplayName(me.canonicalName) || me.data.browserName;
    }
    
    get displayPlatform() {
        return this.data.platform;
    }
    
}

module.exports = Generic;
