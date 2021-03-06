"use strict";

var UserAgent = require('orion-core/lib/model/UserAgent');
var Version = require('orion-core/lib/Version');

describe ("UserAgent", function() {
    describe ("Chrome", function() {
        describe ("on OS X Capitan", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Studio/1.0.0 Chrome/51.0.2704.63 Electron/1.2.0 Safari/537.36");
            it ("should have userAgent value Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Studio/1.0.0 Chrome/51.0.2704.63 Electron/1.2.0 Safari/537.36", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) Studio/1.0.0 Chrome/51.0.2704.63 Electron/1.2.0 Safari/537.36");
            });
            it ("should have name value Chrome 51.0.2704.63 / Mac OS X 10.11.5", function() {
                expect(testUserAgent.name).toEqual("Chrome 51.0.2704.63 / Mac OS X 10.11.5");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Chrome");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('51.0.2704.63'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Chrome 51.0.2704.63');
            });
        });
        describe ("on Ubuntu 15 64-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36");
            it ("should have userAgent value Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36");
            });
            it ("should have name value Chrome 51.0.2704.103 / Linux 64", function() {
                expect(testUserAgent.name).toEqual("Chrome 51.0.2704.103 / Linux 64");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Chrome");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('51.0.2704.103'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Chrome 51.0.2704.103');
            });
        });
    });
    describe ("Edge", function() {
        describe ("on Windows 10 - 64-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586");
            it ("should have userAgent value Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10586");
            });
            it ("should have name value Edge 13.10586 / Windows 10.0", function() {
                expect(testUserAgent.name).toEqual("Edge 13.10586 / Windows 10.0");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Edge");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('13.10586'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Edge 13.10586');
            });
        });
    });
    describe ("Internet Explorer 8", function() {
        describe ("on Windows 7 - 32bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C)");
            it ("should have userAgent value Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C)", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C)");
            });
            it ("should have name value IE 8.0 / Windows 7", function() {
                expect(testUserAgent.name).toEqual("IE 8.0 / Windows 7");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("IE");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('8.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('IE 8.0');
            });
        });
    });
    describe ("Internet Explorer 9", function() {
        describe ("on Windows 7 32-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)");
            it ("should have userAgent value Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)");
            });
            it ("should have name value IE 9.0 / Windows 7", function() {
                expect(testUserAgent.name).toEqual("IE 9.0 / Windows 7");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("IE");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('9.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('IE 9.0');
            });
        });
    });
    describe ("Internet Explorer 10", function() {
        describe ("on Windows 7 32-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)");
            it ("should have userAgent value Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)");
            });
            it ("should have name value IE 10.0 / Windows 7", function() {
                expect(testUserAgent.name).toEqual("IE 10.0 / Windows 7");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("IE");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('10.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('IE 10.0');
            });
        });
    });
    describe ("Internet Explorer 11", function() {
        describe ("on Windows 7 32-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko");
            it ("should have userAgent value Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko");
            });
            it ("should have name value IE 11.0 / Windows 7", function() {
                expect(testUserAgent.name).toEqual("IE 11.0 / Windows 7");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("IE");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('11.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('IE 11.0');
            });
        });
    });
    describe ("Firefox", function() {
        describe ("on OS X Capitan", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:47.0) Gecko/20100101 Firefox/47.0");
            it ("should have userAgent value Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:47.0) Gecko/20100101 Firefox/47.0", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.11; rv:47.0) Gecko/20100101 Firefox/47.0");
            });
            it ("should have name value Firefox 47.0 / Mac OS X 10.11", function() {
                expect(testUserAgent.name).toEqual("Firefox 47.0 / Mac OS X 10.11");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Firefox");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('47.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Firefox 47.0');
            });
        });
        describe ("on Windows 7 32-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Windows NT 6.1; rv:47.0) Gecko/20100101 Firefox/47.0");
            it ("should have userAgent value Mozilla/5.0 (Windows NT 6.1; rv:47.0) Gecko/20100101 Firefox/47.0", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Windows NT 6.1; rv:47.0) Gecko/20100101 Firefox/47.0");
            });
            it ("should have name value Firefox 47.0 / Windows 7", function() {
                expect(testUserAgent.name).toEqual("Firefox 47.0 / Windows 7");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Firefox");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('47.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Firefox 47.0');
            });
        });
        describe ("on Ubuntu 15 64-bit", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:47.0) Gecko/20100101 Firefox/47.0");
            it ("should have userAgent value Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:47.0) Gecko/20100101 Firefox/47.0", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:47.0) Gecko/20100101 Firefox/47.0");
            });
            it ("should have name value Firefox 47.0 / Ubuntu 64", function() {
                expect(testUserAgent.name).toEqual("Firefox 47.0 / Ubuntu 64");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Firefox");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('47.0'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Firefox 47.0');
            });
        });
    });
    describe ("Safari", function() {
        describe ("on OS X Capitan", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/601.6.17 (KHTML, like Gecko) Version/9.1.1 Safari/601.6.17");
            it ("should have userAgent value Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/601.6.17 (KHTML, like Gecko) Version/9.1.1 Safari/601.6.17", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/601.6.17 (KHTML, like Gecko) Version/9.1.1 Safari/601.6.17");
            });
            it ("should have name value Safari 9.1.1 / Mac OS X 10.11.5", function() {
                expect(testUserAgent.name).toEqual("Safari 9.1.1 / Mac OS X 10.11.5");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("Safari");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('9.1.1'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('Safari 9.1.1');
            });
        });
    });
    describe ("Cordova", function() {
        describe ("on iOS 9.3", function() {
            var testUserAgent = UserAgent.getInstance("Mozilla/5.0 (iPhone; CPU iPhone OS 9_3 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/13E230 (2097626544)");
            it ("should have userAgent value Mozilla/5.0 (iPhone; CPU iPhone OS 9_3 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/13E230 (2097626544)", function() {
                expect(testUserAgent.userAgent).toEqual("Mozilla/5.0 (iPhone; CPU iPhone OS 9_3 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/13E230 (2097626544)");
            });
            it ("should have name value WebKit 601.1.46 / iOS 9.3", function() {
                expect(testUserAgent.name).toEqual("WebKit 601.1.46 / iOS 9.3");
            });
            it ("should have browser name", function() {
                expect(testUserAgent.browser.name).toEqual("WebKit");
            });
            it ("should have browser version", function() {
                expect(testUserAgent.browser.version).toEqual(new Version('601.1.46'));
            });
            it ("should have browser full name", function() {
                expect(testUserAgent.browser.fullName).toEqual('WebKit 601.1.46');
            });
        });
    });
});
