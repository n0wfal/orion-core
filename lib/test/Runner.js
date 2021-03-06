"use strict";

var BasicRunner = require('./BasicRunner');
var LocalBrowser = require('orion-core/lib/model/browser/Local');
var Embedded = require('orion-core/lib/model/browser/Embedded');

/**
 * Responsible for launching Agent browsers and instructing agents to run tests
 */
class Runner extends BasicRunner {
    ctor () {
        // TODO - restore when tunnel launcher works
        this.autoStartTunnel = false;
    }

    /**
     * Starts a test run
     * @param {Object} options
     * @param {String[]} options.files An array of file names containing the tests to run
     * @param {Browser[]} [options.browsers] Browsers to run the tests in.
     * @param {AgentGroup[]} [options.agentGroups] AgentGroups to run the tests in.
     * @param {String[]} [options.testIds] Ids of suites and/or specs to run.  If omitted, all
     * suites and specs will run.
     */
    startTestRun(options) {
        options = options || {};

        var me = this,
            browsers = options.browsers,
            agentGroups = options.agentGroups || [],
            files = options.files,
            reporter = me.reporter,
            testIds = options.testIds,
            coverageWas = me.enableCodeCoverage,
            farm, agentGroup, agentId, agent, agents, concurrency, chunks, i, resetNeeded;

        if (me.currentRunId) {
            // On 2nd+ runs we reset the timestamp to be sure caches are busted
            me._timeStamp = +new Date();
        }

        me._messageQueue.length = 0;
        me._runningAgents = 0;
        me._queuedAgents = 0;
        me.currentRunId++;
        me.enableCodeCoverage = !!options.enableCodeCoverage;
        me.testOptions = options.testOptions;
        resetNeeded = me.enableCodeCoverage != coverageWas;

        if (!files) {
            throw new Error("No test files to run.");
        }

        me._runTestBuild().then(function(){
            me._setFiles(files);

            reporter.dispatch({
                type: 'runStarted',
                files: files,
                testIds: testIds,
                browsers: browsers,
                agentGroups: agentGroups
            });

            if (agentGroups) {
                // make a copy to avoid mutating the caller's array
                agentGroups = agentGroups.slice();

                agentGroups.forEach(function(agentGroup) {
                    var browser = agentGroup.browser;
                    if (!browser || browser.isLocalBrowser) {
                        // attempt to "launch" all the local agent groups - this ensures that
                        // we retrieve a parked agent for each one that exists.
                        me.launchLocalBrowser(browser, agentGroup);
                    }
                });
            }

            if (browsers) {
                browsers.forEach(function(browser) {
                    agentGroup = me.agentGroupsByBrowserId[browser.id];

                    if (browser instanceof LocalBrowser && !browser instanceof Embedded) {
                        if (!agentGroup) {
                            agentGroup = me.launchLocalBrowser(browser);
                        }
                        agentGroups.push(agentGroup);
                        return;
                    }

                    farm = browser.pool.farm;

                    if (!agentGroup) {
                        agentGroup = me._getAgentGroup({
                            id: me._generateAgentGroupId(),
                            browser: browser,
                            browserPool: browser.pool
                        });
                    }

                    concurrency = browser.get('sencha').concurrency;
                    chunks = browser.get('chunks'); // FIXME deprecated - remove in the next major version (1.1)
                    if (!concurrency && chunks) {
                        console.log('Use of chunks is deprecated. Use sencha.concurrency instead.');
                    }
                    concurrency = Math.min(concurrency || chunks, files.length);

                    for (i = 1; i <= concurrency; i++) {
                        agentId = me._generateAgentId();

                        agent = me._getAgent({
                            id: agentId,
                            farm: farm,
                            agentGroup: agentGroup,
                            testIds: testIds,
                            chunk: i,
                            chunks: concurrency,
                            timeout: me.timeout,
                            remoteTimeout: me.remoteTimeout,
                            url: me.getAgentContactUrl({
                                orionAgentId: agentId,
                                orionChunk: i + '/' + concurrency
                            }, !farm)
                        });

                        agent.on('terminated', function (event) {
                            me.onRemoteAgentTerminated(event.agent);
                        });

                        agent.on('failed', function (event) {
                            var error = event.error,
                                failedAgent = event.agent,
                                farm = failedAgent.farm,
                                browser = failedAgent.browser;
                                

                            reporter.dispatch({
                                type: 'agentFailed',
                                error: error,
                                willRetry: failedAgent.retries > 0,
                                agent: failedAgent
                            });

                            if (failedAgent.retries--) {
                                me._launchAgent(failedAgent, resetNeeded);
                            } else {
                                reporter.dispatch({
                                    type: 'systemError',
                                    error: error,
                                    agent: failedAgent
                                });
                                me.onRemoteAgentTerminated(event.agent);
                            }
                        });

                        reporter.dispatch({
                            type: 'agentAdded',
                            agent: agent
                        });

                        me._scheduleAgent(agent, resetNeeded);
                    }
                });
            }

            if (agentGroups) {
                // local agents and anonymous agents
                agentGroups.forEach(function(agentGroup) {
                    agents = agentGroup.agents;
                    for (agentId in agents) {
                        agent = agents[agentId];
                        reporter.dispatch({
                            type:   'agentAdded',
                            agent:  agent
                        });
                        agent.startTestRun(me.currentRunId, testIds, resetNeeded);
                    }
                });
            }
        }, function(err){
            console.error(err.stack || err);
            me.stopTestRun();
        });
    }
    
    onRemoteAgentTerminated(agent) {
        var me = this,
            farm = agent.farm;

        me._runningAgents--;

        if (farm) {
            farm.sessionCount--;
            if (farm.agentQueue.length) {
                me._queuedAgents--;
                me._scheduleAgent(farm.agentQueue.shift());
            }
        }
        
        if (!me._runningAgents && !me._queuedAgents) {
            me.fire('terminated');
        }
    }

    /**
     * Terminates a test run by reloading all local agents, and killing remote ones
     */
    stopTestRun() {
        this._messageQueue.length = 0;

        this.cleanupAgents();
    }

    /**
     * Schedules a remote agent to run.  If the farm has has not yet reached sessionLimit
     * the agent will be launched immediately, otherwise it will be queued.
     * @param {Agent} agent
     * @private
     */
    _scheduleAgent(agent, reset) {
        var me = this,
            farm = agent.farm;

        if (!farm) {
            agent.startTestRun(me.currentRunId, null, reset);
            me._runningAgents++;
        } else {
            // TODO check browserstack/saucelabs APIs to list active/available tunnels
            var sessionLimit = Math.max(farm.sessionLimit || 0, 1);
            if (farm.sessionCount < sessionLimit) {
                me._runningAgents++;
                farm.sessionCount++;
                
                // if tunnel is already open, startTunnel resolves immediately
                var autoStartTunnel = me.autoStartTunnel != null ? me.autoStartTunnel : !!farm.autoStartTunnel;
                var promise = (autoStartTunnel && farm.start) ? farm.start() : Promise.resolve();
                promise.then(function () {
                    me._launchAgent(agent);
                });
            } else {
                me._queuedAgents++;
                farm.agentQueue.push(agent);
            } 
        }
    }
    
    _launchAgent(agent, reset) {
        var me = this;
        
        me.reporter.dispatch({
            type: 'agentLaunched',
            agent: agent
        });
        agent.launch().then(function () {
            agent.startTestRun(me.currentRunId, null, reset);
        });
    }

    _runTestBuild () {
        var me = this,
            scenario = me.scenario,
            project = scenario.project,
            profile = scenario.get('profile'),
            owner = project.owner,
            shouldRunTestBuild = false;

        return new Promise(function(resolve, reject) {
            if (owner) {
                if (owner.isApp) {
                    if (!scenario.get("launch")) {
                        shouldRunTestBuild = true;
                    }
                }
                else {
                    shouldRunTestBuild = true;
                }
                shouldRunTestBuild = shouldRunTestBuild &&
                    owner.needsDevBuild &&
                    owner.needsDevBuild(profile);
            }

            if (shouldRunTestBuild) {
                var cmdClient = me.cmdClient;
                if (cmdClient) {
                    owner.appWatchInProcess = true;
                    owner.runTestBuild(cmdClient, profile, false, function(logEvent){
                        var msg = logEvent.message.message;
                        console.log(msg);
                    }).then(resolve, reject);
                }
                else {
                    reject("Test Build needed, but Cmd installation not detected");
                }
            }
            else {
                resolve(me);
            }
        });

    }
}

module.exports = Runner;
