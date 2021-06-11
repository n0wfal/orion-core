'use strict';

const Path  = require('path');
const Shell = require('electron').shell;
const IpcMain = require('electron').ipcMain;


const Base        = require('./Base');
const Platform    = require('./Platform');
const AppSettings = require('./AppSettings');
const Util        = require('./Util');
const fs          = require('fs');
const xfs         = require('./xfs');
const os          = require('os');


class App extends Base {
    static init (config) {
        return this.instance = new this(config);
    }

    ctor () {
        let me = this,
            settings = me.settings;

        me.quit = me.quit.bind(me);
        me.captureWindowBox = me.captureWindowBox.bind(me);

        me.platform = new Platform(Object.assign({
            app: me,
            asar: Path.resolve(me.root, 'app.asar')
        }, me.platform));

        me.settings = new AppSettings(Object.assign({
            logger: me.platform,
            filePath: me.platform.appRoot
        }, me.settingsConfig = me.settings));

        me.license.log = me.log.bind(me);

        me.electron.app.on('ready', me.start.bind(me));

        IpcMain.on('set-proxy-auth', function(event, arg) {
            me.proxyAuthCallback(arg.username, arg.password);
        });

        me.electron.app.on('login', function(event, webContents, request, authInfo, callback) {
            event.preventDefault();
            if(authInfo.isProxy) {
                me.mainWindow.webContents.send('get-proxy-auth','yeah!');
                me.proxyAuthCallback = callback;
            }
        });
    }

    log (msg) {
        (this.platform || console).log(msg);
    }

    error (msg) {
        (this.platform || console).error(msg);
    }

    captureWindowBox () {
        var mainWindow = this.mainWindow,
            bounds;

        if (mainWindow.isMaximized()) {
            bounds = { maximized: true };
        } else {
            bounds = this.mainWindow.getBounds();
            bounds.maximized = false;
        }

        this.windowBox = bounds;
    }

    quit () {
        console.log('===> Quitting Electron because main window has closed.\n');

        // Reload the settings file since the UI/App may have made changes as well
        //
        var me = this,
            settings = new AppSettings(Object.assign({
                logger: me.platform,
                filePath: me.settings.filePath
            }, me.settingsConfig));

        settings.set(this.windowBox);
        settings.save();

        this.electron.app.quit();
    }

    start () {
        let me = this,
            urlRegEx = /localhost/i,
            settings = me.settings.get(),

            mainWindow = me.mainWindow = new me.browserWindow(Object.assign({
                /**
                 * `icon` is for linux only. Mac/Windows icon comes from the
                 * icon setting in the electron build in `Gruntfile.js`
                 */
                icon: Path.resolve(me.indexPath, 'resources', 'sencha.png'),
                x: settings.x,
                y: settings.y,
                width: settings.width,
                height: settings.height,
                'min-width': 1000,
                'min-height': 600
            }, me.windowCfg || {}));

            console.log('icon', Path.resolve(me.indexPath, 'resources', 'sencha.png'),  me.windowCfg.icon);

        if (settings.maximized) {
            mainWindow.maximize();
        }

        mainWindow.on('move',   me.captureWindowBox);
        mainWindow.on('resize', me.captureWindowBox);
        mainWindow.on('closed', me.quit);

        //open links in the browser, not in an electron new window
        mainWindow.webContents.on('new-window', function (e, url) {
            if (!urlRegEx.test(url)) {
                e.preventDefault();
                Shell.openExternal(url);
            }
        });

        me.licenseCheck();
    }

    licenseCheck () {
        var me = this,
            pingEventType = 'UNLICENSED',
            triggerTimeBomb = false,
            mainWindow = me.mainWindow,
            // pingFailureFlag is true when smart flow ping fails
            pingFailureFlag = false;
        if (me.license.expired) {
            pingEventType = 'UNLICENSED';
            triggerTimeBomb = true;
        } else {
            pingEventType = 'LEGAL';
        }
        
        /*
          * TODO: The iteration below needs to be reviewed regarding what would
          * cause multiple licenses to be present in a single license file.
          * Please refer https://sencha.jira.com/browse/CAT-938 for more detail
        */
        me.license._licenses.forEach(function(license) {
            pingEventType = license.data.type === 'Trial' ? 'EVALUATION': pingEventType;

            if (me.ping(license, pingEventType)) {
                // possible reason - missing smartflow ping utils.jar file
                pingFailureFlag = true;
            } else {
                pingFailureFlag = false;
            }
        });

        if (pingFailureFlag) {
            mainWindow.loadURL('file://' + Path.resolve(me.indexPath, 'error.html'));
        } else {
            if (triggerTimeBomb) {
                me.onTimeBomb();
            } else {
                if (me.onLaunch) me.onLaunch(mainWindow, me.settings);
            }
        }
    }

    
    onTimeBomb () {
        var me = this,
            mainWindow = me.mainWindow;

        //don't want to save size/position when showing timebomb
        mainWindow.removeListener('move',   me.captureWindowBox);
        mainWindow.removeListener('resize', me.captureWindowBox);

        mainWindow.setMinimumSize(400, 200);
        mainWindow.setSize(400, 200);
        mainWindow.setResizable(false);

        mainWindow.loadURL('file://' + Path.resolve(me.indexPath, 'expired.html'));
    }


    ping (license, eventType) {
        license = license.data;
        // Fetch the directory where the settings are stored
        var fileSettingsDirectoryPath = this.platform.appRoot;
        // Fetch the utils.jar path
        var jarUtilsPath = Path.resolve(this.indexPath, "util/utils.jar");
        
        if (this.indexPath.indexOf("app.asar") !== -1) {
            var utildir = Path.resolve(os.tmpdir(),'utils/')
            var utilspath = Path.resolve(utildir, 'utils.jar');

            if (fs.existsSync(utildir)) {
                
                if (fs.existsSync(utilspath)) {
                    fs.unlinkSync(utilspath);
                }

                fs.rmdirSync(utildir);
            }

            fs.mkdirSync(utildir);
            fs.writeFileSync(utilspath, fs.readFileSync(jarUtilsPath));

            jarUtilsPath = utilspath;
        }
        
        // Ensure the jar still exists in the packaging!!!
        if (!fs.existsSync(jarUtilsPath)) {
            // Provide some logging to figure out what's going on. 
            console.log('Error, exiting to welcome screen. The Sencha utils.jar is missing. path=' + jarUtilsPath);
            // Since the jar is missing, show the exit application.
            return true;
        } 
        
        if (jarUtilsPath.indexOf(":") === 1) { 
            // Windows, spaces go in quotes
            jarUtilsPath = '"' + jarUtilsPath + '"';
            fileSettingsDirectoryPath = '"' + fileSettingsDirectoryPath + '"';
        } else { // Mac, Linux
            // Make path Java friendly, spaces in path have to fixed, with '\ ', this happens when installed
            jarUtilsPath = jarUtilsPath.replace(/ /g, '\\ ');
        }

        // wrap up the valid license info in base64
        var validLicenseInfo = '';
        if (license != null) {
            validLicenseInfo = JSON.stringify(license);
            validLicenseInfo = Buffer.from(validLicenseInfo).toString('base64');  
        }
        
        // Define the ping trigger type
        var trigger = "loading";
        // Build the ping Command
        var command = "java -jar " + jarUtilsPath + " ";
        command += "-directory " + fileSettingsDirectoryPath + " ";
        command += "-product " + license.product.name + " "; 
        command += "-productVersion " + this.license.appVer + " ";
        command += "-eventType " + eventType + " ";
        command += "-trigger " + trigger + " ";
        command += "-licenseSerialNumber " + license.id + " ";
        command += "-licensedTo " + license.email + " ";
        command += "-licenseExpiryDate " + license.expiration + " ";
        command += "-custom1 licenseType=" + license.type + " ";
        command += "-validLicenseInfo \"" + validLicenseInfo + "\" "; 
        command += "-mode production "; //for testing ping change mode from production to testing

        // Configure the command in the terminal or command line (CLI).
        var commands = [ command ];
        xfs.runCommands(commands, function(err, cmdOutput) {
        }, this);

        return false;
    }

}

module.exports = App;
