'use strict';

const console = require('orion-core/lib/util/console-manager').console;
const Runner = require('orion-core/lib/test/Runner');
const SandboxAgent = require('orion-core/lib/model/test/SandboxAgent.js');

class SandboxRunner extends Runner {
    
    static get meta () {
        return {
            prototype: {
                sandboxPage: '~orion/sandbox/sandbox.html'
            }
        }
    }
    
    _createAgent(options) {
        var agent = new SandboxAgent(Object.assign({
                // TODO need to be able to set this later to use interactive runner
                archiver: this.archiver
            }, options));
        return agent;
    }
    
    getAgentContactPage (params) {
        return this.parameterizePage(this.sandboxPage, params);
    }
    
    getInterceptablePage () {
        return this.sandboxPage;
    }
    
    getSubjectUrl () {
        var me = this,
            addr = me.callbackAddress || '127.0.0.1';
        return 'http://' + addr + ':' + me.proxy.port + '/' + me.scenario.getSubjectPage();
    }

}

module.exports = SandboxRunner;
