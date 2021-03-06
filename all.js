/**
 * This module exports all the pieces of `orion-core` as a single object namespace. This
 * file also defines several commonly used `Manager` singletons that are each lazily
 * created.
 *
 * @module orion-core/all
 */
var Core = {
    Base: require('./lib/Base'),
    App: require('./lib/App'),
    Json: require('./lib/Json'),
    Html: require('./lib/Html'),
    Observable: require('./lib/Observable'),
    Platform: require('./lib/Platform'),
    Settings: require('./lib/Settings'),
    AppSettings: require('./lib/AppSettings'),
    Util: require('./lib/Util'),
    Validator: require('./lib/Validator'),
    Version: require('./lib/Version'),
    xfs: require('./lib/xfs'),

    browser: {
        Instance: require('./lib/browser/Instance'),
        LocalPool: require('./lib/browser/LocalPool')
    },

    cmd: {
        Client: require('./lib/cmd/Client'),
        Task: require('./lib/cmd/CmdTask'),
        Manager: require('./lib/cmd/Manager')
    },

    fs: {
        File: require('./lib/fs/File'),
        UnixFile: require('./lib/fs/UnixFile'),
        Zip: require('./lib/fs/Zip')
    },

    image: {
        Image: require('./lib/image/Image'),
        Comparator: require('./lib/image/Comparator')
    },

    tasks: {
        Manager: require('./lib/tasks/Manager'),
        Task: require('./lib/tasks/Task'),
        ChildProcessTask: require('./lib/tasks/ChildProcessTask')
    },

    config: {
        Configuration: require('./lib/config/Configuration')
    },

    license: {
        Activator: require('./lib/license/Activator'),
        License: require('./lib/license/License'),
        License0: require('./lib/license/License0'),
        Manager: require('./lib/license/Manager'),
        Mac: require('./lib/license/Mac')
    },

    model: {
        Entity: require('./lib/model/Entity'),
        UserAgent: require('./lib/model/UserAgent'),
        Workspace: require('./lib/model/Workspace'),
        
        browser: {
            Browser: require('./lib/model/browser/Browser'),
            BrowserStack: require('./lib/model/browser/BrowserStack'),
            Generic: require('./lib/model/browser/Generic'),
            Local: require('./lib/model/browser/Local'),
            Embedded: require('./lib/model/browser/Embedded'),
            SauceLabs: require('./lib/model/browser/SauceLabs')
        },

        cmd: {
            App: require('./lib/model/cmd/App'),
            Framework: require('./lib/model/cmd/Framework'),
            Package: require('./lib/model/cmd/Package')
        },

        farm: {
            Farm: require('./lib/model/farm/Farm'),
            Pool: require('./lib/model/farm/Pool'),
            Embedded: require('./lib/model/farm/Embedded'),
            BrowserStack: require('./lib/model/farm/BrowserStack'),
            SauceLabs: require('./lib/model/farm/SauceLabs')
        },

        test: {
            Agent: require('./lib/model/test/Agent'),
            AgentGroup: require('./lib/model/test/AgentGroup'),
            Project: require('./lib/model/test/Project'),
            Scenario: require('./lib/model/test/Scenario')
        }
    },

    process: {
        ProcessUtil: require('./lib/process/ProcessUtil'),
        EmbeddedBrowserProcess: require('./lib/process/EmbeddedBrowserProcess'),
        SandboxProcess: require('./lib/process/SandboxProcess')
    },

    reporter: {
        ArchiveReporter: require('./lib/reporter/ArchiveReporter')
    },

    test: {
        BasicRunner: require('./lib/test/BasicRunner'),
        Runner: require('./lib/test/Runner'),
        EventRecorderRunner: require('./lib/test/EventRecorderRunner'),
        SandboxRunner: require('./lib/test/SandboxRunner')
    },

    web: {
        Responder: require('./lib/web/Responder'),
        RootResponder: require('./lib/web/RootResponder'),
        Interceptor: require('./lib/web/Interceptor'),
        Server: require('./lib/web/Server'),
        ProxyServer: require('./lib/web/ProxyServer')
    },

    __dirname: __dirname
};

module.exports = Core;
