'use strict';

class EmbeddedBrowserProcess {
    
    run () {
        const electron = require('electron');
        const app = electron.app;
        const BrowserWindow = electron.BrowserWindow;
        const argv = process.argv;
        
        var me = this;
        var mainWindow = null;
        var url = argv[argv.indexOf('--url') + 1];
        var show = argv.indexOf('--show') >= 0;
        var width = argv[argv.indexOf('--width') + 1];
        var height = argv[argv.indexOf('--height') + 1];
        var port = argv[argv.indexOf('--port') + 1];
        
        
        process.on('message', (m) => {
        //     if (m.type === 'screenshot') {
        //         mainWindow.capturePage(function (image) {
        //             process.send({
        //                 type: 'screenshot',
        //                 screenshot: image.toDataURL()  
        //             });
        //         });
        //     }
        });
        
        app.commandLine.appendSwitch('remote-debugging-port', port);
        app.on('window-all-closed', function () {
            if (process.platform != 'darwin') {
                app.quit();
            }
        });
        
        app.on('ready', function () {
            mainWindow = new BrowserWindow({
                title: 'Sencha Test - embedded browser',
                show: show,
                width: width || 1024,
                height: height || 768
            });
            me.send('windowCreated');
            
            mainWindow.loadURL(url);
            me.send('windowLoaded');
        
            mainWindow.on('closed', function () {
                me.send('windowClosed');
                mainWindow = null;
                process.exit();
            });
        });
    }
    
    send (m) {
        process.send ? process.send(m) : console.log(m);
    }
    
}

module.exports = EmbeddedBrowserProcess;


