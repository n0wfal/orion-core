"use strict";

var co = require('co');
var util = require('util');
var Agent = require('./Agent');
var SandboxBrowser = require('orion-core/lib/model/browser/Sandbox');

/**
 * This class represents a remote browser launched by a Sandbox
 */
class SandboxAgent extends Agent {
    
    static get meta () {
        return {
            prototype: {
                isSandboxAgent: true,
                terminateOnFinish: true
            }
        };
    }
    
    launch() {
        var me = this,
            browser = me.agentGroup.browser,
            sandboxBrowser;
        
        sandboxBrowser = me.sandboxBrowser = new SandboxBrowser({
            browser: browser,
            proxyPort: me.runner.proxy.port,
            url: me.url
        });
        return sandboxBrowser.launch();
        
        // TODO watchdogs - see RemoteAgent

    }
    
    terminate() {
        var sandboxBrowser = this.sandboxBrowser; 
        sandboxBrowser && sandboxBrowser.terminate();
    }
    
    getTestOptions () {
        var testOptions = super.getTestOptions();
        testOptions.driverConfig = this.sandboxBrowser.getDriverConfig();
        testOptions.subjectUrl = this.runner.getSubjectUrl();
        return testOptions;
    }

}

module.exports = SandboxAgent;
