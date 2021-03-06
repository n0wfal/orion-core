"use strict";

var http = require('http');
var Observable = require('../Observable');
var Task = require('../tasks/Task');
var uuid = require('uuid');
var Responder = require('./Responder');

/**
 *
 */
class Server extends Task {
    static get meta () {
        return {
            prototype: {
                description: 'Server',

                portSeed: 8000
            }
        };
    }

    /**
     * @cfg {Number} port
     */

    ctor () {
        this.sockets = {};
        this.nextSocketId = 0;
    }

    start () {
        var me = this;

        if (!me.isRunning) {
            me.getServer();
            me._listen();
        }
    }

    getServer () {
        var me = this,
            server, root;

        if (!me.server) {
            root = me.getRootResponder();

            server = me.server = http.createServer(root.handleRequest.bind(root));
            // Disable socket timeout
            server.timeout = 0;
            server.on('listening', me._onListen.bind(me));
            server.on('error', me._onError.bind(me));
            server.on('connection', me._onConnection.bind(me));
        }
        return me.server;
    }

    getRootResponder () {
        var me = this;

        if (!me._root) {
            me._root = new Responder();
        }
        return me._root;
    }

    stop () {
        var me = this,
            sockets = me.sockets,
            closed, socketId;

        if (me.isRunning) {
            me.server.close(function () {
                // FIXME why are we getting me.server == null here?
                if (!closed) {
                    closed = true;
                    me.fire('closed');
                    me.server.removeAllListeners();
                    // me.server = null;
                }
            });

            setTimeout(function() {
                // After calling server.close() sockets remain open accepting new requests
                // for up to 2 minutes.  We must destroy sockets directly in order to
                // prevent this from happening.  This is slightly delayed to allow any
                // in-flight responses to existing requests to complete.
                for (socketId in sockets) {
                    sockets[socketId].destroy();
                }
            }, 50);

            me.isRunning = false;
        }
        me.done();
    }

    _listen () {
        var me = this;

        me.server.listen(me.port || me.portSeed);
    }

    _onListen () {
        var me = this;

        if (!me.port) {
            me.port = me.portSeed;
        }

        me.info(me.description + ' open on port ' + me.port);
        me.setDescription(me.description + ' @ ' + me.port);

        me.isRunning = true;
        me._set('running', true);
        me.fire('running');
        me.fire({
            type: 'started',
            port: me.port
        });
    }

    _onError (err) {
        var me = this;

        if (err.code === 'ECONNRESET') {
            // TODO what is causing it?
            //me.error((err.stack || err).toString());
        } else if (err.code !== 'EADDRINUSE' || me.port) {
            // unhandled error, or the user specified a port that was already in use -
            // reject the request to start the server
            me.error((err.stack || err).toString());
            me.fire({
                type: 'error',
                error: err,
                task: {
                    description: me.description,
                    port: me.port
                }
            });
        } else {
            // user did not specify a port so we are free to try a different port if the
            // one we picked was already in use
            me.portSeed++;
            me._listen();
        }
    }

    _onConnection (socket) {
        var sockets = this.sockets,
            socketId = ++this.nextSocketId;

        sockets[socketId] = socket;

        socket.once('close', function () {
            delete sockets[socketId];
        });
    }
}

module.exports = Server;
