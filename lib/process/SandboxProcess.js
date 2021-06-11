'use strict';

const util = require('util');

class SandboxProcess {
    
    run () {
        const electron = require('electron');
        const app = electron.app;
        const BrowserWindow = electron.BrowserWindow;
        const argv = process.argv;
        
        var me = this;
        var mainWindow = null;
        var devtoolsPort = argv[argv.indexOf('--devtoolsPort') + 1];
        var proxyPort = argv[argv.indexOf('--proxyPort') + 1];
        var url = argv[argv.indexOf('--url') + 1];
        var baseDir = me.getBaseDir();
        var preload = baseDir + '/sandbox/preload.js'
        
        
        process.on('message', (m) => {
            var type = m.type;
            me[type](m);
        //     if (m.type === 'screenshot') {
        //         mainWindow.capturePage(function (image) {
        //             process.send({
        //                 type: 'screenshot',
        //                 screenshot: image.toDataURL()  
        //             });
        //         });
        //     }
        });
        
        app.commandLine.appendSwitch('remote-debugging-port', devtoolsPort);
        app.on('window-all-closed', function () {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
        
        app.on('ready', function () {
            mainWindow = new BrowserWindow({
                title: 'Sencha Test Sandbox',
                show: true,
                // show: false, // FIXME don't show the sandbox in production
                webPreferences: {
                    preload: preload,
                    nodeIntegration: true
                }
            });
            mainWindow.openDevTools();
            me.send('windowCreated');
            me.send(url);
            
            mainWindow.loadURL(url);
            me.send('windowLoaded');
        
            mainWindow.on('closed', function () {
                me.send('windowClosed');
                electron.app.quit();
            });
        });
    }
    
    getBaseDir() {
        var File = require('orion-core/lib/fs/File'),
            Util = require('orion-core/lib/util'),
            dir = __dirname,
            production = dir.includes('app.asar'),
            name, stu;

        dir = new File(dir);
    
        if (production) {
            // Finding binDir, we expect app.js in resources.
            // (app.js is this file and thus __dirname)
            do {
                name = dir.name;
                dir = dir.parent;
            } while (name !== 'app.asar');
    
            if (Util.isMac) {
                dir = dir.parent.parent.parent; // <binDir>/Sencha Studio.app/Contents/Resources/app.asar
            } else {
                dir = dir.parent; // <binDir>/resources/app.asar/app.js
            }
        } else {
            dir = dir.parent.parent; // orion-core
        }
        
        return dir;
    } 
    
    terminate () {
        require('electron').app.quit();
    }
    
    send (m) {
        process.send ? process.send(m) : console.log(m);
    }
    
}

module.exports = SandboxProcess;


