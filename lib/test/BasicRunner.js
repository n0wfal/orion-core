'use strict';

const console = require('orion-core/lib/util/console-manager').console;
const Agent = require('../model/test/Agent.js');
const AgentGroup = require('../model/test/AgentGroup.js');
const Browser = require('orion-core/lib/model/browser/Browser');
const CodeInstrumenter = require('./CodeInstrumenter');
const Html = require('orion-core/lib/Html');
const LocalBrowser = require('orion-core/lib/model/browser/Local');
const LocalBrowserPool = require('orion-core/lib/browser/LocalPool');
const MessageValidator = require('./MessageValidator');
const Observable = require('../Observable');
const RemoteAgent = require('../model/test/RemoteAgent.js');
const ProxyServer = require('orion-core/lib/web/ProxyServer');
const UserAgent = require('../model/UserAgent.js');
const Util = require('orion-core/lib/Util');
const Url = require('url');
const urlParse = Url.parse;

class BasicRunner extends Observable {
    static get meta () {
        return {
            prototype: {
                cacheBuster: true,

                orionCoreFiles: [
                    // Watch out for parked-agent.html as well
                    '/~orion/files/supports.js',
                    '/~orion/files/base.js',
                    '/~orion/files/context/Base.js',
                    '/~orion/files/context/Local.js',
                    '/~orion/files/context/WebDriver.js',
                    '/~orion/files/Version.js',
                    '/~orion/files/Browser.js',
                    '/~orion/files/OS.js',
                    '/~orion/files/Element.js',
                    '/~orion/files/Timer.js',
                    '/~orion/files/KeyMap.js',
                    '/~orion/files/Alert.js',
                    '/~orion/files/event/Event.js',

                    '/~orion/files/event/wgxpath.install.js',
                    '/~orion/files/Locator.js',
                    '/~orion/files/locator/Strategy.js',

                    '/~orion/files/event/Driver.js',
                    '/~orion/files/event/Injector.js',
                    '/~orion/files/event/Playable.js',
                    '/~orion/files/event/Player.js',
                    '/~orion/files/event/Recorder.js',
                    '/~orion/files/event/GestureQueue.js',

                    '/~orion/files/future/Element.js',
                    '/~orion/files/future/Component.js',

                    '/~orion/files/orion.js'
                ],

                orionCoreCssFiles: [
                    '/~orion/files/base.css',
                    '/~orion/files/alert.css'
                ],

                testFrameworkFiles: {
                    'jasmine': [
                        '/~orion/files/jasmine/jasmine.js',
                        '/~orion/files/jasmine-orion.js',
                        '/~orion/files/jasmine-pre-extensions.js',
                        '/~orion/files/jasmine/boot.js',
                        '/~orion/files/jasmine-post-extensions.js'
                    ]
                }
            }
        };
    }

    /**
     * @cfg {Reporter} reporter
     */

    /**
     * @cfg {Server} proxy
     */

    /**
     * @cfg {Number} port
     */

    /**
     * @cfg {WebDriverClient} wdClient
     */

    /**
     * @cfg {String} subjectPage
     * The test subject page to load when launching browsers.
     * Specified as a path relative to the proxy's base url
     */

    /**
     * @cfg {ArchiveReporter} archiver
     * Artifact archiver
     */

    /**
     * @cfg {ParkingLot} parkingLot
     */

    ctor () {
        var me = this,
            proxy, root;

        me.id = ++BasicRunner._idSeed;

        me._timeStamp = +new Date();

        me._agentIdSeed = 0;
        me._agentGroupIdSeed = 0;

        /**
         * @property {Object} agents
         * Agent cache, keyed by agent id
         */
        me.agents = {};

        /**
         * @property {Object} agentGroups
         * AgentGroup cache, keyed by id
         */
        me.agentGroups = {};

        /**
         * @property {Object} agentGroupsByBrowserId
         * A map of browser ids to agentGroups.  Agent groups that represent anonymously
         * connected agents are not contained in this map
         */
        me.agentGroupsByBrowserId = {};

        /**
         * @property {Object} agentGroupsByUserAgent
         * A map of agent groups keyed by userAgent string. Cloud-based agent groups are not
         * added to this map since they may contain agents with different userAgent strings
         * in the same agent group.
         */
        me.agentGroupsByUserAgent = {};

        /**
         * @property {Object} _sessionCount
         * Tracks the number of open sessions for each farm
         * @private
         */
        me._sessionCount = {};
        
        me._validator = new MessageValidator();

        me.currentRunId = 0;

        // chunk size of 0 means no chunking
        me.messageChunkSize = me.messageChunkSize || 0;
        me._messageQueue = [];

        me.scenario = me.scenario.descriptor || me.scenario;
        me.project = me.scenario.project;
        me.enableCodeCoverage = me.enableCodeCoverage || false;
        me.callbackAddress = me.callbackAddress || Util.getLocalIpAddress();
        me._setFiles(me.files || []);

        me.reporter = me.wrapReporters(me.reporter);

        proxy = me.proxy || (me.proxy = new ProxyServer({
            port: me.port, // if null/undefined, proxy will generate a port
            noProxy: me.noProxy,
            portSeed: me.portSeed,
            scenario: me.scenario // used by RootResponsder
        }));
        root = proxy.getRootResponder();

        // we may be reusing the proxy so we need to clear the intercepts from last time
        root.clearInterceptors();

        // register an interceptor for the root page path
        // to inject needed script elements
        var testPage = me.getInterceptablePage(); 
        if (testPage.endsWith('index.html')) {
            testPage = testPage.replace(/\/index\.html$/g, '/(index.html)?');
        }
        root.intercept('[/]?' + testPage + '[/]?$', me._interceptSubjectPage.bind(me));
        root.intercept('.*?\\.js$', me._interceptJsFile.bind(me));

        // register other sub responders for the ~orion url
        root.register({
            '~orion': {
                routes: {
                    register: {
                        get: function(ctx) {
                            return me._onAgentRegister({
                                request: ctx.request,
                                response: ctx.response,
                                agentId: parseInt(ctx.url.query.agentId, 10),
                                proxyId: ctx.url.query.proxyId,
                                sessionId: ctx.url.query.sessionId,
                                runnerId: ctx.url.query.runnerId,
                                url: ctx.url,
                                content: ctx.content,
                                // use 'this' here to call the helper methods
                                // on the responder
                                address: this.getRequestAddress(ctx.request),
                                isLocal: this.isLocalRequest(ctx.request)
                            });
                        }
                    },
                    messages: {
                        get: function(ctx) {
                            return me._onAgentMessages({
                                request: ctx.request,
                                response: ctx.response,
                                agentId: parseInt(ctx.url.query.agentId, 10),
                                proxyId: ctx.url.query.proxyId,
                                runId: parseInt(ctx.url.query.runId, 10),
                                url: ctx.url,
                                content: ctx.content
                            });
                        }
                    },
                    updates: {
                        get: function(ctx) {
                            return me._onAgentUpdates({
                                response: ctx.response,
                                agentId: parseInt(ctx.url.query.agentId, 10),
                                proxyId: ctx.url.query.proxyId,
                                runId: parseInt(ctx.url.query.runId, 10),
                                url: ctx.url,
                                content: ctx.content
                            });
                        }
                    }
                }
            }
        });

        me.instrumenter = new CodeInstrumenter({
            scenario: me.scenario
        });
    }

    cachify (url) {
        var cacheBuster = this.cacheBuster;

        if (url && cacheBuster) {
            if (url.indexOf('?') < 0) {
                url += '?';
            } else {
                url += '&';
            }

            url += '_dc=';
            url += (cacheBuster === true) ? this._timeStamp : cacheBuster;
        }

        return url;
    }

    setDefaultProxyUrl (url) {
        this.defaultProxyUrl = this.proxy.getRootResponder().defaultProxyUrl = url;
    }

    _getLibsContent () {
        var me = this,
            content = '',
            libs = [],
            testFramework = me.testFrameworkFiles[me.scenario.getTestFramework()];

        me.orionCoreCssFiles.forEach(function(file) {
            content += '<link rel="stylesheet" type="text/css" href="' + me.cachify(file) + '"/>\n'
        });

        content += '<script>ST.runnerId=' + me.id + ';</script>\n';

        libs.push.apply(libs, me.orionCoreFiles);
        if (testFramework) {
            libs.push.apply(libs, testFramework);
        }

        libs.push.apply(libs, me.scenario.getLibs('/~orion/workspace'));

        libs.filter(function (lib) {
            return !!lib;
        }).forEach(function (file) {
            content += '<script src="' + me.cachify(file) + '"></script>\n';
        });

        return content;
    }

    parseInstrument (html, beforeContent, afterContent) {
        var dom = Html.parse(html),
            after, before, head, ret, root;

        if (dom) {
            dom.forEach(function (c) {
                if (!root && c.type === 'tag' && c.name === 'html') {
                    root = c;

                    if (root.children) {
                        root.children.forEach(function (c2) {
                            if (!head && c2.type === 'tag' && c2.name === 'head') {
                                head = c2;
                            }
                        });
                    }

                    if (!head) {
                        Html.appendChild(root, head = {
                            type: 'tag',
                            name: 'head'
                        });
                    }
                }
            });

            if (head) {
                if (!head.children) {
                    head.children = [];
                }

                var elem = head.children[0];
                head.children.forEach(function(c){
                    if (c.type === 'tag' && c.name === 'base') {
                        elem = c.next;
                    }
                });

                after = Html.parse(afterContent);
                before = Html.parse(beforeContent);

                Html.insertBefore(head, before, elem);
                Html.appendChild(head, after);

                ret = Html.stringify(dom);
            }
        }

        return ret;
    }
    
    getInterceptablePage () {
        return this.scenario.getSubjectPage();
    } 

    _interceptSubjectPage (data, response) {
        var me = this,
            context = response.responderContext,
            chunkParam = context.url.query.orionChunk,
            chunkCfg = chunkParam && chunkParam.split('/'),
            chunkId = chunkCfg && chunkCfg[0],
            chunkTotal = chunkCfg && chunkCfg[1],
            libsContent = me._getLibsContent(),
            filesContent = '',
            workspaceDir = me.project.getWorkspaceMountDir().replace(/\\/g, '/'),
            scenarioDir = me.project.resolve(me.scenario.get('directory')).replace(/\\/g, '/'),
            result, workspaceRelativeFile, scenarioRelativeFile;

        // will produce: <script src="/~orion/workspace/examples/admin-dashboard/test/scenario1/..."></script>
        libsContent = '\n<script src="' + me.cachify('/~orion/files/init.js') +
                '"></script>\n' + libsContent;

        filesContent += '\n<script>ST.beforeFiles();</script>\n';
        me._getChunkFiles(chunkId, chunkTotal).forEach(function(file){
            workspaceRelativeFile = file.substring(workspaceDir.length + 1);
            scenarioRelativeFile = file.substring(scenarioDir.length + 1);
            filesContent += '<script>ST.beforeFile("' + scenarioRelativeFile + '");</script>\n';
            filesContent += '<script src="/~orion/workspace/' + me.parseFile(workspaceRelativeFile, true) +
                '"></script>\n';
            filesContent += '<script>ST.afterFile("' + scenarioRelativeFile + '");</script>\n';
        });
        filesContent += '<script>ST.afterFiles();</script>\n';

        if (!(result = me.parseInstrument(data, libsContent, filesContent))) {
            // add the libs file (se we can hook Ext) first
            result = data.replace(/<head>/, '<head>' + libsContent);
            // now append the remaining files to the end
            result = result.replace(/<\/head>/, filesContent + '</head>');
        }

        return result;
    }

    parseFile(file, cachify) {
        file = file
            .replace(/\\/g, '/')
            .split('/')
            .map(function(file) {
                return file
                    .split('.')
                    .map(function(inner) {
                        return encodeURIComponent(inner);
                    })
                    .join('.');
            })
            .join('/');

        return cachify ? this.cachify(file) : file;
    }

    _split (files, chunks) {
        var len = files.length,out = [], i = 0;
        while (i < len) {
            var size = Math.ceil((len - i) / chunks--);
            out.push(files.slice(i, i += size));
        }
        return out;
    }

    _getChunkFiles (chunk, chunks) {
        var me = this,
            files = me._getFiles();
        if (chunk) {
            files = me._split(files, chunks);
            return files[chunk - 1];
        }
        return files;
    }

    _interceptJsFile (data, response) {
        var me = this,
            instrumenter = me.instrumenter,
            context = response.responderContext,
            url = context.url;

        if (!me.enableCodeCoverage) {
            return data;
        }
        return instrumenter.instrument(data, url.pathname);
    }

    startProxy () {
        this.proxy.start();
    }

    getAgentContactUrl (params, local) {
        var me = this,
            addr = local ? '127.0.0.1' : me.callbackAddress;
        return 'http://' + addr + ':' + me.proxy.port + '/' + me.getAgentContactPage(params);
    }
    
    getAgentContactPage (params) {
        return this.parameterizePage(this.scenario.getSubjectPath(), params);
    }

    parameterizePage (page, params) {
        var me = this,
            parsed = urlParse(page, true);

        if (params) {
            for (var name in params) {
                var val = params[name];
                if (val != null) {
                    parsed.query[name] = val;
                }
            }
        }

        return Url.format({
            pathname: parsed.pathname,
            query: parsed.query,
            hash: parsed.hash
        });
    }

    /**
     * Launches a local browser instance, if one is not already running
     * @param {Browser} [browser]
     * @param {AgentGroup} [agentGroup]
     * @param {ParkedAgent} [parkedAgent]
     * @return {AgentGroup}
     */
    launchLocalBrowser (browser, agentGroup, parkedAgent) {
        var me = this,
            scenario = me.scenario,
            project = scenario.project,
            app = project.owner,
            waitTime = 1000,
            closeTime, openTime, timeElapsed, agentId, agent, userAgent, address, params, url;

        // If we already have an agent group with a connected agent we don't want to
        // launch a new instance.  Let's check first...
        if (agentGroup) {
            agent = agentGroup.firstAgent();

            if (agent) {
                closeTime = agent.lastConnectionCloseTime;
                openTime = agent.lastConnectionOpenTime;

                if (closeTime > openTime) {
                    // Lost connection with the browser, most likely because the runner
                    // just responded to the open poll, and we are waiting for the agent
                    // to re-poll.  It could also mean that we have temporarily lost
                    // connection with the browser for other reasons, for example, the
                    // user has paused in a breakpoint, or the user killed the browser
                    // and we did not receive a "close" event from the open connection.
                    // To know for sure which of these is the case, we need to check
                    // how much time has elapsed (if the agent is going to re-poll it
                    // should happen relatively quickly).
                    timeElapsed = +new Date() - closeTime;

                    if (timeElapsed > waitTime) {
                        // agent no longer has a heartbeat.  go ahead and launch a new one, or
                        // attempt to fetch one from the parking lot.  We are abandoning the
                        // existing agent so make a last-ditch effort to park the agent (also
                        // removes it from the agent group even if parking fails)
                        me.parkAgent(agent);
                        agent = null;
                    } else {
                        // lost connection with the agent only a short while ago, wait momentarily
                        // to see if the agent re-establishes contact before proceeding

                        setTimeout(function() {
                            me.launchLocalBrowser(browser, agentGroup);
                        }, waitTime - timeElapsed);

                        return agentGroup;
                    }
                }
            }
        }

        if (!agent) {
            // No connected agent.  This means we need to either fetch one from the parking
            // lot or launch a new intance if there are no available parked agents.

            if (parkedAgent) {
                userAgent = parkedAgent.userAgent;
                address = parkedAgent.address;

                if (!parkedAgent.destroyed) {
                    parkedAgent = me.unparkAgent(userAgent);
                } else if ((!agentGroup || !agentGroup.count()) && !browser) {
                    parkedAgent = me.unparkAgent(userAgent);

                    if (!parkedAgent) {
                        // nothing but a destroyed parked agent - no live agents, and no
                        // browser instance to use for launching - the best we can do is
                        // return the agentGroup, or an empty placeholder agentGroup.  It is
                        // up to the caller to warn the user that we could not launch if
                        // we return an empty agentGroup
                        agentGroup = agentGroup || me._getAgentGroup({
                            id: me._generateAgentGroupId(),
                            browserPool: browser ? browser.pool :
                                (userAgent.local ? LocalBrowserPool.instance : null),
                            browser: browser || null,
                            address: address
                        });

                        me._setAgentGroupUserAgent(agentGroup, userAgent);
                    }
                }
            }

            if (!parkedAgent) {
                userAgent = (agentGroup && agentGroup.userAgent) || browser.userAgent;
                address = (agentGroup && agentGroup.address) || 'localhost';

                if (address && userAgent) {
                    parkedAgent = me.unparkAgent(userAgent);
                }
            }

            if (parkedAgent || browser) {
                agentId = me._generateAgentId();

                if (!agentGroup) {
                    if (browser) {
                        agentGroup = me.agentGroupsByBrowserId[browser.id];
                    }

                    if (!agentGroup) {
                        agentGroup = me._getAgentGroup({
                            id: me._generateAgentGroupId(),
                            browserPool: browser ? browser.pool :
                                (parkedAgent.userAgent.local ?
                                    LocalBrowserPool.instance : null),
                            browser: browser || null
                        });

                        if (parkedAgent && parkedAgent.userAgent) {
                            me._setAgentGroupUserAgent(agentGroup, userAgent);
                        }
                    }
                }

                agent = me._getAgent({
                    id: agentId,
                    terminateOnFinish: me.terminateAgents,
                    browser: browser
                });

                agentGroup.add(agent);

                if (parkedAgent) {
                    agentGroup.address = agent.address = parkedAgent.address;
                    agentGroup.userAgent = agent.userAgent = parkedAgent.userAgent;
                }

                me._onAgentAdded(agent);
                params = {
                    orionAgentId: agentId,
                    orionRecording: me.isRecording
                }

                if (parkedAgent) {
                    parkedAgent.redirectTo({
                        port: me.proxy.port,
                        page: me.getAgentContactPage(params)
                    });
                } else if (browser) {
                    url = me.getAgentContactUrl(params, browser.isLocalBrowser);

                    var profile = scenario.get('profile'),
                        shouldRunTestBuild = false;

                    if (app) {
                        if (app.isApp) {
                            if (!scenario.get("launch")) {
                                shouldRunTestBuild = true;
                            }
                        } else {
                            shouldRunTestBuild = true;
                        }

                        shouldRunTestBuild = shouldRunTestBuild &&
                            app.needsDevBuild &&
                            app.needsDevBuild(profile);
                    }

                    if (app && app.isApp && project.get('launchAppWatch')) {
                        var buildProfile = app.getBuildProfile(profile);

                        app.launch(profile).then(function(){
                            browser.launch({
                                url: url
                            });
                        }, function(err){
                            console.error(err.stack || err);
                        });
                    }
                    else if (shouldRunTestBuild) {
                        app.runTestBuild(app.cmdClient, profile, false).then(function(){
                            browser.launch({
                                url: url
                            });
                        });
                    }
                    else {
                        browser.launch({
                            url: url
                        });
                    }
                }
            }
        }

        return agentGroup;
    }

    cleanupAgents () {
        var me = this,
            agents = me.agents,
            id, agent;

        for (id in agents) {
            agent = agents[id];

            if (agent.terminateOnFinish) {
                agent.terminate();
            } else if (!agent.isRemoteAgent) {
                me.parkAgent(agent);
            }
        }
    }

    destroy () {
        this.destroyed = true;
        this._messageQueue.length = 0;
        this.cleanupAgents();
        this.proxy.stop();
    }

    _onAgentAdded (agent) {
        var reporter = this.reporter;

        if (reporter) {
            reporter.dispatch({
                type: 'agentAdded',
                agent: agent
            });
        }
    }

    _generateAgentId() {
        return ++this._agentIdSeed;
    }

    _generateAgentGroupId() {
        return ++this._agentGroupIdSeed;
    }

    /**
     * Handles registering a new browser agent.
     * @param {Object} event
     * @param {http.IncomingMessage} event.request
     * @param {http.ServerResponse} event.response
     * @param {Object} event.url The request url.
     * @param {String} event.address The IP address of the agent
     * @param {Boolean} event.isLocal True if the request originated on this local machine
     * @private
     */
    _onAgentRegister(event) {
        var me = this,
            request = event.request,
            address = event.address,
            isLocal = event.isLocal,
            agents = me.agents,
            userAgentString = request.headers['user-agent'],
            userAgent = UserAgent.fromRequest(request),
            sessionId = event.sessionId,
            agentId = event.agentId,
            runnerId = event.runnerId,
            agent = agents[agentId],
            reporter = me.reporter,
            agentGroup, isAnonymous, error, browser, groupAgents, id;

        if (agent) {
            agent.beforeRegister();
        }

        if (runnerId != me.id) {
            // Chrome sometimes loads html pages from the cache in spite of our best efforts
            // to tell it not to via cache-control request headers.
            // To work around this we inject a script tag into the page with the id of
            // this runner instance.  If the runnerId of the registration request does
            // not match the id of this runner, then the browser must have loaded the
            // page from the cache.  A simple reload should fix the problem.
            return [{
                type: 'reload',
                forced: true
            }];
        }

        if (!event.sessionId) {
            return [{
                type: 'error',
                message: 'test agent must supply sessionId during registration'
            }];
        }

        if (agent && (!agent.sessionId || (agent.sessionId === event.sessionId))) {
            agentGroup = agent.agentGroup;
        } else {
            // If we got here it means one of two things:
            //
            // 1. No agent found in the agents map: The user may have initiated
            // the connection by opening the subject url in a browser of their choice.
            //
            // 2. An agent was found in the agents map with an id matching the agentId
            // on the request, however, the sessionId does not match.  This likely means
            // the user copied a url from another agent with orionAgentId parameter intact.
            //
            // In both scenarios we will treat this agent as a newly registered anonymous
            // agent. We must now generate an agent id and create Agent/AgentGroup instances
            // to represent the agent.
            isAnonymous = true;

            // If a local or anonymous browser with the exact same user agent string
            // connected previously we can just add this agent to the same AgentGroup.
            agentGroup = me.agentGroupsByUserAgent[userAgent.groupId];

            // But we must first kick any existing agents in the group out to the parking page
            if (agentGroup && agentGroup.count()) {
                groupAgents = agentGroup.agents;
                for (id in groupAgents) {
                    me.parkAgent(groupAgents[id]);
                }
            }

            agentId = me._generateAgentId();
            agent = me._getAgent({
                id: agentId
            });

            if (isLocal && !agentGroup) {
                // If the anonymously connected agent is running on this local machine
                // check to see if the local browser pool contains a matching browser.
                // This allows the reporter to match up the agent group with the local browser.
                browser = LocalBrowserPool.instance.lookupBrowserByUserAgent(userAgent);

                if (browser) {
                    agentGroup = me.agentGroupsByBrowserId[browser.id];
                }
            }

            if (!agentGroup) {
                agentGroup = me._getAgentGroup({
                    id: me._generateAgentGroupId(),
                    browserPool: isLocal ? LocalBrowserPool.instance : null,
                    browser: browser || null
                });
            }

            agentGroup.add(agent);
        }

        agent.userAgent = userAgent;
        browser = agentGroup.browser;
        
        if (browser) {
            // giving the browser a reference to the userAgent allows us to attempt
            // to lookup a parked agent in the parking lot before launching a new
            // browser instance.
            // (use case - run tests, then clear results, then run again - should reuse
            // the parked agent, not launch a new tab)
            browser.userAgent = userAgent;
            if (!browser.parsedVersion && userAgent.browser) {
                // Capabilities object might not specify a browser version,
                // which usually means 'latest'
                browser.parsedVersion = userAgent.browser.version;
            }
        }

        if (isAnonymous || (browser && browser.isLocalBrowser)) {
            // Local and anonymous agents are tracked by userAgent string. This servers
            // two purposes:
            // 1. For anonymous agents the userAgent serves as a means for the reporter to
            // catalog the results since anonymous agents do not have a "browser" reference.
            // 2. For both Local and anonymous browsers the agentGroupsByUserAgent map
            // allows us to group agents with identical userAgent strings in the same AgentGroup.
            me._setAgentGroupUserAgent(agentGroup, userAgent);
            agentGroup.address = agent.address = address;
        }

        if (isAnonymous) {
            me._onAgentAdded(agent);
        }

        agent.sequence = 0;
        agent.sessionId = sessionId;
        
        agent.onRegister().then(function () {
            reporter.dispatch({
                type: 'agentRegistered',
                agent: agent
            });
        }, function (err) {
            console.error(err.stack || err);
        });

        return [{
            type: 'handshake',
            agentId: agentId,
            proxyId: me.proxy.id
        }];
    }

    _onAgentMessages (event) {
        var me = this,
            agentId = event.agentId,
            proxyId = event.proxyId,
            response = event.response,
            agent = me.agents[agentId],
            result;

        if (!agent || (proxyId != me.proxy.id)) {
            // If this runner has no record of an agent matching the agentId on the request
            // or if proxy id of the agent does not match the id of this runner's proxy
            // it means we have an agent that is still open from a previous run and is
            // still attempting to send messages.  It is very unlikely that this will happen
            // because the agent contains client-side code that stops polling soon
            // after it ceases to receive responses from the proxy, however, just in case
            // maxRetries is set to a larger number and the agent is still hanging around
            // we'll redirect the agent to the current subject url
            return me._redirectUnknownAgent();
        }

        // process any inbound messages
        result = me._onAgentUpdates(event);
        if (result && (typeof result.then === 'function')) {
            result.then(function(messages){
                messages.forEach(function(message){
                    agent.sendMessage(message);
                });
            });
        }

        agent.onConnectionOpen(response);

        // return the promise for the messages array to the responder.  it'll
        // handle completing the request once messages are available
        return agent.getMessages();
    }

    /**
     * Handles update messages from the Agent
     * @param {http.IncomingMessage} request
     * @param {http.ServerResponse} response
     * @param {String} [agentId] Agent ID parsed from the request url.  Not applicable for
     * anonymously connected agents.
     * @private
     */
    _onAgentUpdates(event) {
        var me = this,
            agentId = event.agentId,
            agent = me.agents[agentId],
            proxyId = event.proxyId,
            data = event.content;

        if (!agent || (proxyId != me.proxy.id)) {
            // If this runner has no record of an agent matching the agentId on the request
            // or if proxy id of the agent does not match the id of this runner's proxy
            // it means we have an agent that is still open from a previous run and is
            // still attempting to send messages.  It is very unlikely that this will happen
            // because the agent contains client-side code that stops polling soon
            // after it ceases to receive responses from the proxy, however, just in case
            // maxRetries is set to a larger number and the agent is still hanging around
            // we'll redirect the agent to the current subject url
            return me._redirectUnknownAgent();
        }

        if (data && (!event.runId || (event.runId === me.currentRunId))) {
            this._queueMessages(JSON.parse(data), agent);
        }
    }

    _queueMessages (messages, agent) {
        var me = this;

        return new Promise(function(resolve, reject) {
            var chunkSize = me.messageChunkSize,
                messageQueue = me._messageQueue,
                queueWasEmpty = !messageQueue.length,
                ln = messages.length,
                messageChunks = [],
                i, j;

            messageChunks.push(resolve);

            if (chunkSize) {
                // In UI runner mode we need chunk up the messages and defer each chunk.
                // This prevents the UI from feeling unresponsive while large batches
                // of incoming messages are being processed.
                for (i = 0, j = Math.ceil(ln / chunkSize); i < ln; i += chunkSize, j--) {
                    messageChunks[j] = {
                        agent: agent,
                        messages: messages.slice(i, i + chunkSize)
                    };
                }
            } else {
                // Command line runs do not need to chunk messages - process all as one chunk
                messageChunks[1] = {
                    agent: agent,
                    messages: messages
                }
            }

            messageQueue.unshift.apply(messageQueue, messageChunks);

            if (queueWasEmpty) {
                me._scheduleMessageChunk();
            }
        });
    }

    _scheduleMessageChunk () {
        var me = this,
            deferFn = me.deferFn;

        if (me._messageQueue.length) {
            if (deferFn) {
                deferFn(me._nextMessageChunk, me);
            } else {
                me._nextMessageChunk();
            }
        }
    }

    _nextMessageChunk () {
        var me = this,
            messageQueue = me._messageQueue,
            messageChunk, agent;

        if (messageQueue.length) {
            messageChunk = messageQueue.pop();

            if (typeof messageChunk === 'function') {
                messageChunk();
                me._scheduleMessageChunk();
            } else {
                agent = messageChunk.agent;

                if (!agent.removed) {
                    me._processMessages(messageChunk.messages, agent).then(function (allRes) {
                        allRes.forEach(function (res) {
                            agent.sendMessage(res);
                        });
                        me._scheduleMessageChunk();
                    });
                }
            }
        }
    }

    _processMessages (messages, agent) {
        var me = this,
            len = messages.length,
            validator = me._validator,
            m, message, responses = [];

        for (m = 0; m < len; m++) {
            message = messages[m];
            if (!validator.validate(message)) {
                console.error('Invalid message received', message);
                continue;
            }
            if (me.reporter) {
                me.reporter.dispatch(Object.assign({ agent: agent }, message));
            }
            responses.push(agent.dispatch(message));
        }
        return Promise.all(responses.filter(function(item) {
            return !!item;
        }));
    }

    _getFiles () {
        var me = this,
            files = me.files;
        if (!files || files.length === 0) {
            files = me.scenario.getFiles();
        }
        return files.map (function (file) {
            return file.replace(/\\/g, '/');
        });
    }

    _setFiles(files) {
        this.files = files;
    }

    /**
     * Retrieves an Agent instance for a given id, creating one if one does not already
     * exist.
     *
     * @param {Object} options Configuration options for an Agent instance
     * @return {Agent}
     * @private
     */
    _getAgent(options) {
        var me = this,
            id = options.id,
            agents = me.agents,
            agentGroup = options.agentGroup,
            agent = agents[id];

        if (agent) {
            Object.assign(agent, options);
        } else {
            agents[id] = agent = me._createAgent(options);
        }

        agent.on({
            lostconnection: me._onAgentLostConnection,
            terminated: me._onAgentTerminated,
            scope: me
        });

        if (agentGroup) {
            agentGroup.add(agent);
        }

        agent.runner = me;
        return agent;
    }
    
    _createAgent(options) {
        var me = this,
            agent; 
        
        if (options.farm) {
            agent = new RemoteAgent(Object.assign({
                // TODO need to be able to set this later to use interactive runner
                archiver: me.archiver
            }, options));
        } else {
            agent = new Agent(options);
        }
        return agent;
    }

    /**
     * Retrieves an AgentGroup for a given id, creating one if one does not already
     * exist.
     *
     * @param {Object} options Configuration options for an Agent instance
     * @return {Agent}
     * @private
     */
    _getAgentGroup(options) {
        var id = options.id,
            agentGroups = this.agentGroups,
            agentGroup = agentGroups[id],
            userAgent = options.userAgent,
            browser = options.browser;

        if (agentGroup) {
            Object.assign(agentGroup, options);
        } else {
            agentGroup = agentGroups[id] = new AgentGroup(options);

            if (browser) {
                this.agentGroupsByBrowserId[browser.id] = agentGroup;
            }

            if (userAgent) {
                this._setAgentGroupUserAgent(agentGroup, userAgent);
            }
        }

        return agentGroup;
    }

    _setAgentGroupUserAgent(agentGroup, userAgent) {
        agentGroup.userAgent = userAgent;
        this.agentGroupsByUserAgent[userAgent.userAgent] = agentGroup;
    }

    _onAgentLostConnection (event) {
        var reporter = this.reporter;

        // When an agent loses connection we do not removeAgent() because the agent might
        // actually return later.
        // The most common scenario where this happens is when the agent is reloaded
        // due to a startTestRun message.  It will fire lostconnection because the existing
        // connection gets closed when the browser window is refreshed.
        // In either case we need to dispatch an agentLostConnection message so that
        // reporters can clean up state (just in case the connection is lost mid-run).
        if (reporter) {
            reporter.dispatch({
                type: 'agentLostConnection',
                agent: event.sender
            });
        }
    }

    _onAgentTerminated (event) {
        // Remote or embedded agent was terminated - it's never coming back so we can go ahead and
        // clean it up/remove it from the agent cache now.
        this.removeAgent(event.sender);
    }

    _redirectUnknownAgent() {
        var me = this,
            parkingLot = me.parkingLot;

        if (parkingLot) {
            return [{
                type: 'redirect',
                port: parkingLot.port
            }];
        } else {
            // Command-line runner doesn't have a parking lot
            return [{
                type: 'redirect',
                url: 'about:blank'
            }];
        }
    }
    
    wrapReporters (reporters) {
        var me = this;

        if (Array.isArray(reporters)) {
            reporters = reporters.slice(0);
        } else {
            reporters = [reporters];
        }

        var wrapper = {
            add (reporter) {
                if (reporters.indexOf(reporter) < 0) {
                    reporters.push(reporter);
                }
            },

            dispatch (message) {
                var type = message.type;

                if (!me.destroyed) {
                    reporters.forEach(function (reporter) {
                        if (reporter.supportedMessages[type]) {
                            reporter.dispatch(message);
                        }
                    });
                }
            },

            remove (reporter) {
                var i = reporters.indexOf(reporter);
                if (i >= 0) {
                    reporters.splice(i, 1);
                }
            }
        };
        
        return wrapper;
    }

    removeAgent(agent) {
        var me = this,
            agentGroup = agent.agentGroup,
            reporter = me.reporter,
            agentId = agent.id,
            agents = me.agents,
            messageQueue = me._messageQueue;

        function remove() {
            if (agents[agentId]) {
                if (reporter) {
                    reporter.dispatch({
                        type: 'agentTerminated',
                        agent: agent
                    });
                }

                // Just in case the agent still has an open poll, let's close it.
                agent.sendMessage({
                    type: 'terminated'
                });

                if (agentGroup) {
                    agentGroup.remove(agent);
                }

                delete agents[agentId];

                agent.removed = true;
            }
        }

        if (messageQueue.length) {
            // make sure not to remove the agent until after any pending messages have been
            // processed (reporters may rely on agent reference having correct agentGroup, etc.)
            messageQueue.unshift(remove);
        } else {
            remove();
        }
    }

    /**
     * Sends an agent to the parking lot.
     * Removes the agent from its agent group and from the agent cache.
     * @param {Agent} agent
     */
    parkAgent(agent) {
        var me = this,
            parkingLot = me.parkingLot;

        if (parkingLot && !agent.isRemoteAgent) {
            parkingLot.park(agent);
        } else {
            // Command-line runner doesn't have a parking lot
            agent.redirectTo('about:blank');
        }

        me.removeAgent(agent);
    }

    /**
     * Retrieves and removes a parked agent from the parking lot
     * @param {String} address
     * @param {UserAgent} userAgent
     * @return {ParkedAgent}
     */
    unparkAgent(userAgent) {
        return this.parkingLot.unpark(userAgent);
    }


    getTestOptions () {
        var me = this,
            scenario = me.scenario,
            project = scenario.project,
            testOptions = {};
        Object.assign(testOptions, project.data.options);
        Object.assign(testOptions, scenario.data.options);
        Object.assign(testOptions, me.testOptions);
        return testOptions;
    }
}

BasicRunner._idSeed = 0;
BasicRunner.parkingLot = {};

module.exports = BasicRunner;
