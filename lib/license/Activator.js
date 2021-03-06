'use strict';

const nodeRSA = require('node-rsa');
const Uuid    = require('uuid');

const Base    = require('orion-core/lib/Base');
const File    = require('orion-core/lib/fs/File');
const License = require('orion-core/lib/license/License');

/**
 * @class core.license.Activator
 * @extend core.Base
 */
class Activator extends Base {
    static get FILENAME () {
        return 'license-private-key';
    }

    static get meta () {
        return {
            prototype: {
                ready: false
            }
        };
    }

    /**
     *
     * @param {Object} license
     * @param {Number/String} [duration] Either the number of days or a number with
     * unit suffix of 'd', 'm' or 'y' (days, months, years). For example, '1y' is 1 year.
     * By default, '1y' is assumed if there is an `activationCode` and '1m' if not.
     * @return {Promise<Object>}
     */
    activate (license, duration) {
        var me = this,
            activationCode = license.activationCode,
            expiration = new Date(),
            units = 'd';

        return new Promise(function (resolve, reject) {
            duration = duration || (activationCode ? '1y' : '1m');

            if (typeof duration === 'string') {
                units = /^\d+([dmy])$/.exec(duration);
                if (units) {
                    units = units[1];
                    duration = parseInt(duration, 10);
                }
            }

            if (!units || typeof duration !== 'number') {
                reject({
                    success: false,
                    error: 'invalid_params',
                    msg: 'Invalid license term ' + duration
                });
            } else if (!me.ready) {
                reject({
                    success: false,
                    error: 'unknown_error',
                    msg: 'Private key not available'
                });
            }
            else if (!license.email) {
                reject({
                    success: false,
                    error: 'invalid_params',
                    msg: 'Missing email field'
                });
            }
            else if (!license.print) {
                reject({
                    success: false,
                    error: 'invalid_params',
                    msg: 'Missing print field'
                });
            }
            else if (!license.product || !license.product.code) {
                reject({
                    success: false,
                    error: 'invalid_params',
                    msg: 'Missing product/code field'
                });
            } else {
                //duration *= -1;  // TEST: force expiration
                if (units === 'y') {
                    expiration.setFullYear(expiration.getFullYear() + duration);
                } else if (units === 'm') {
                    expiration.setMonth(expiration.getMonth() + duration);
                } else {
                    expiration.setDate(expiration.getDate() + duration);
                }

                var code = license.product.code,
                    result = {
                        success: true,
                        license: {
                            email: license.email,
                            id: license.id || Uuid.v4(),
                            expiration: expiration.toISOString(),
                            print: license.print,
                            type: activationCode ? 'paid' : 'trial',
                            schema: 1,
                            product: {
                                code: code,
                                version: license.product.version,
                                name: 'Sencha ' + code[0].toUpperCase() + code.substr(1)
                            }
                        }
                    };

                if (activationCode) {
                    result.license.product.activationCode = activationCode;
                }

                result.license.signature = me.sign(License.getSignData(result.license));

                resolve(result);
            }
        });
    }

    load (path) {
        var paths = Array.isArray(path) ? path : [path],
            f, file, key, p;

        for (p of paths) {
            file = File.get(p);

            if (file.isDirectory()) {
                file = file.join(Activator.FILENAME);
            }

            if (!file.isFile()) {
                continue;
            }

            try {
                this.privateKey = key = nodeRSA(file.readSync());
                key.setOptions({
                    signingScheme: 'sha1'
                });

                this.ready = true;
                return true;
            } catch (e) {
                console.log('Skipping', file.path);
            }
        }
        
        return false;
    }

    sign (data, format) {
        return this.privateKey.sign(data, format || 'base64');
    }
}

module.exports = Activator;
