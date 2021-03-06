'use strict';

const Crypto = require('crypto');
const Path   = require('path');
const Uuid   = require('uuid');

const Entity     = require('orion-core/lib/model/Entity');
const Observable = require('orion-core/lib/Observable');
const File       = require('orion-core/lib/fs/File');
const Mac        = require('orion-core/lib/license/Mac');

const PUBLIC_KEY = Path.resolve(__dirname, '..', '..', 'keys', 'publickey.pem');

const trialRe = /trial/i;
const typeRe = /^(trial|paid)$/i;

/**
 * @class core.license.License
 * @extend core.model.Entity
 * 
 * This class is both the definition of the current License entity and the base class
 * for old formats of this type (see `License0`).
 * 
 * Format:
 *
 *      {
 *          "id": "8cb38ea8-9187-4c2a-90a8-6aec7b451f3d",
 *          "schema": 1,
 *          "email": "user@sencha.com",
 *          "expiration": "2035-01-07T11:40:38",
 *          "print": "132jeA2kI5ZEnJAFxYYiXDJ+zQs=|9kU9b4RQGz4gnP2KL/HqtE7uc8Q=|",
 *          "signature": "kbPrKyl0q6jCRgqjWtoK5HxelddPT7z65qwRo9Kbr...",
 *          "type": "Trial",
 *          "product": {
 *              "activationCode": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *              "code": "sts",
 *              "name": "Sencha Test",
 *              "version": 1
 *          }
 *      }
 */
class License extends Entity {
    static get meta () {
        return {
            mixins: [
                Observable
            ],

            prototype: {
                isLicense: true,

                mac: new Mac(),
                pubKey: new File(PUBLIC_KEY).readSync(),

                /**
                 * @property {Object} validity
                 * An object describing the validity state of this license. The current
                 * value is cached on the `License` entity and is refreshed by calling
                 * the `verify` method. When this property changes (due to `verify`), a
                 * `validitychange` event is fired.
                 *
                 * @property {String} validity.problems A string with one letter for each
                 * validity problem. The problems are "E" (expired), "F" (wrong machine
                 * fingerprint) and "S" (invalid signature).
                 *
                 * @property {Boolean} validity.expired `true` if this license has
                 * expired.
                 *
                 * @property {Boolean/String} validity.fingerprint `true` if this license
                 * is _invalid_ for this machine or a string holding an error message if
                 * an error occurred determining this result.
                 *
                 * @property {Boolean} validity.signature `true` if the signature for this
                 * license is _invalid_.
                 *
                 * @readonly
                 */
                validity: null
            },

            statics: {
                /**
                 * @property {Number} schemaVersion
                 * The license schema version.
                 * @readonly
                 * @static
                 */
                schemaVersion: 1,

                signFields: [
                    'id',
                    'email',
                    'expiration',
                    [ 'fingerprint', 'print' ],
                    {
                        name: 'product',
                        fields: [
                            'activationCode',
                            'code',
                            'version'
                        ]
                    },
                    'type'
                ]
            }
        };
    }
    
    static grok (data) {
        return data.email || data.schema === this.schemaVersion;
    }

    /**
     * @property {core.license.Manager} manager
     * @readonly
     */

    ctor () {
        var data = this.data,
            fingerprint = data.print;

        data.id = data.id || Uuid.v4();

        if (fingerprint) {
            delete data.print;
            data.fingerprint = fingerprint;
        }
    }

    //--------------------------------------------------------------
    // Properties - These properties provide an abstract interface
    // to the underlying license. Different (older) license schema
    // classes will provide the same property getters but backed by
    // different properties in the "data" object.

    /**
     * @property {String} email
     * The user's email address (formerly the "Username" field).
     * @readonly
     */
    get email () {
        return this.data.email;
    }

    /**
     * @property {Number} expiration
     * The expiration date as the number of milliseconds since the Unix epoch
     * (Jan 1 1970).
     * @readonly
     */
    get expiration () {
        // return new Date().getTime() - 1; // test: uncomment to simulate an expired license
        var expiration = this.data.expiration || null;

        return expiration && Date.parse(expiration);
    }

    /**
     * @property {Date} expirationDate
     * The `expiration` property wrapped in a `Date` object.
     * @readonly
     */
    get expirationDate () {
        var expiration = this.expiration;

        return expiration && new Date(expiration);
    }

    /**
     * @property {Boolean} expired
     * This property is `true` if this license has expired.
     * @readonly
     */
    get expired () {
        var expiration = this.expiration || false;

        return expiration && (Date.now() >= expiration);
    }

    /**
     * @property {String} id
     * The unique ID for this license.
     * @readonly
     */
    get id () {
        return this.data.id;
    }

    /**
     * @property {String} fingerprint
     * The machine fingerprint (formerly "Print"). This is a set of SHA1 hashes of
     * MAC addresses separated by "|". See the `Mac` class.
     * @readonly
     */
    get fingerprint () {
        return this.data.fingerprint;
    }

    /**
     * @property {Object} product
     * @readonly
     */
    get product () {
        return this.data.product;
    }

    /**
     * @property {String} problem
     * A string describing the most significant problem with this license or `null` if
     * the license is valid. This is a simplified accessor for the `validity` object.
     * @readonly
     */
    get problem () {
        var validity = this.validity,
            problem = null,
            fingerprint = validity && validity.fingerprint;

        // The text from these problems here is matched and edited to be descriptive
        // at higher levels. In particular, startsWith('License') is required.
        //
        if (!validity) {
            problem = 'License has not been verified';
        }
        else if (validity.signature) {
            problem = 'License is corrupted';
        }
        else if (fingerprint === true) {
            problem = 'License is not valid for this machine';
        }
        else if (fingerprint) {
            problem = 'License failed verification: ' + fingerprint;
        }
        else if (validity.expired) {
            problem = !this.trial ? 'The trial period has ended' : 'License has expired';
        }

        return problem;
    }

    /**
     * @property {Number} schemaVersion
     * The version of business logic behind this license. The original schema was 0.
     * @readonly
     */
    get schemaVersion () {
        return this.constructor.schemaVersion;
    }

    /**
     * @property {String} signature
     * The signature used to validate those fields that were signed.
     * @readonly
     */
    get signature () {
        return this.data.signature;
    }

    /**
     * @property {Boolean} trial
     * This field is `true` if this license is a trial and `false` if a purchase.
     * @readonly
     */
    get trial () {
        return trialRe.test(this.data.type);
    }

    //------------------------------------------------------
    // Methods

    /**
     * Returns a Promise that will resolve to this `License` or reject with an `Error`
     * object describing the problem. The Promise can also be rejected if a network issue
     * prevents communication with the license server. For details on the `Error` object
     * and its `errorCode` property, see {@link core.license.Manager#request}.
     *
     * Usage:
     *
     *      var activationCode = null; // null for Trial, not null for Paid
     *
     *      var license = manager.add({
     *          email: 'foo@bar.com',
     *          product: 'test'  // just the product code
     *      });
     *
     *      function success (lic) {
     *          // do stuff
     *      }
     *
     *      function failure (err) {
     *          if (err.errorCode === 'email_validation') {
     *              // get validation code
     *
     *              license.activate(activationCode, validationCode).then(success, failure);
     *          }
     *      }
     *
     *      license.activate(activationCode).then(success, failure);
     *
     * @param {String} [activationCode] Required to activate a purchased license.
     * @param {String} [validationCode] Required if email validation code is needed.
     * @return {Promise<License>}
     */
    activate (activationCode, validationCode) {
        var me = this;

        return me.activationRequest(activationCode, validationCode).then(request => {
            return me.manager.request(request).then(response => {
                return me.activateWith(response.license);
            });
        });
    }

    /**
     * Delivers the activation request object that should be sent to the license
     * server. This is also used by itself to handle offline activation.
     * @param {String} [activationCode] Required to activate a purchased license.
     * @param {String} [validationCode] Required if email validation code is needed.
     * @return {Promise<Object>}
     */
    activationRequest (activationCode, validationCode) {
        var me = this,
            data = me.data,
            product = data.product,
            request = {
                email: data.email,
                id: me.id,
                product: {
                    code: product.code,
                    version: product.version
                }
            };

        if (activationCode) {
            request.activationCode = activationCode;
        }
        if (validationCode) {
            request.validation = validationCode;
        }

        return me.mac.getFingerprint().then(fingerprint => {
            request.print = fingerprint;

            return request;
        });
    }

    /**
     * Processes the activation response from the license server. This is called by
     * `activate` for online mode but directly when performing offline activation.
     * @param {Object} licenseData
     * @return {Promise<License>}
     */
    activateWith (licenseData) {
        var me = this,
            data = me.data,
            old = Object.assign({}, data),
            sig = licenseData.signature,
            fingerprint = licenseData.print || licenseData.fingerprint,
            ver = licenseData.schema || licenseData.version;

        if (old.product && typeof old.product === 'object') {
            old.product = Object.assign({}, old.product);
        }

        if (licenseData.email !== data.email) {
            return Promise.reject(new Error('License email does not match'));
        }
        if (!licenseData.id) {
            return Promise.reject(new Error('License does not contain an id'));
        }
        if (ver !== 1) {
            return Promise.reject(new Error('License format not recognized'));
        }
        if (!fingerprint) {
            return Promise.reject(new Error('License is missing machine fingerprint'));
        }
        if (!typeRe.test(licenseData.type)) {
            return Promise.reject(new Error('License is not of a recognized type'));
        }
        if (typeof sig !== 'string' || sig.length < 20) {
            return Promise.reject(new Error('License does not have a valid signature'));
        }
        
        data.id = licenseData.id;
        data.schema = ver;
        data.expiration = licenseData.expiration;
        data.fingerprint = fingerprint;
        data.signature = licenseData.signature;
        data.type = licenseData.type;

        Object.assign(data.product, licenseData.product);

        return me.verify().then(result => {
            var msg = me.problem;

            if (msg) {
                me.data = old;
                throw new Error('Cannot activate license: ' + msg);
            }

            /**
             * @event activate
             * @param {Object} info
             * @param {core.license.License} sender
             */
            me.fire('activate');
    
            me.manager.onActivate(me);
            return me;
        });
    }

    remove (save) {
        this.manager.remove(this, save);
    }
    
    serialize () {
        var data = this.data;

        return {
            id: data.id,
            schema: this.schemaVersion,
            email: data.email,
            expiration: data.expiration,
            fingerprint: data.fingerprint,
            product: data.product,
            signature: data.signature,
            type: data.type
        };
    }

    setValidity (val) {
        var me = this,
            was = me.validity;

        if (!was || was.problems !== val.problems || was.fingerprint !== val.fingerprint) {
            me.validity = val;

            /**
             * @event validitychange
             * @param {Object} info
             * @param {core.license.License} sender
             * @param {Object} previous The previous `validity` state.
             */
            me.fire('validitychange', {
                previous: was
            });
        }
    }

    /**
     * Returns an object (via promise) describing the `validity` of this license. This
     * method re-evaluates the validity of this License and will store the result (and
     * fire the `validitychange` event as appropriate).
     * @return {Promise<Object>}
     */
    verify () {
        var me = this,
            validity = {
                problems: ''
            },
            signedData, verifier;

        if (me.expired) {
            validity.problems += 'E';
            validity.expired = true;
        }

        if (me.manager.timeBomb) {
            me.setValidity(validity);
            return Promise.resolve(validity);
        }

        validity.signature = true;

        if (me.signature) {
            signedData = me.getSignData();
            verifier = Crypto.createVerify('RSA-SHA1');
            verifier.update(signedData);

            if (verifier.verify(me.pubKey, me.signature, 'base64')) {
                delete validity.signature;
            }
        }

        if (validity.signature) {
            validity.problems += 'S';
        }

        return me.mac.verify(me.fingerprint).then(match => {
            if (!match) {
                validity.problems += 'F';
                validity.fingerprint = true;
            }
            
            me.setValidity(validity);
            return validity;
        },
        e => {
            validity.problems += 'F';
            validity.fingerprint = e.message;

            me.setValidity(validity);
            return validity;
        });
    }
    
    //-------------------------------------------------------------------
    // Internals

    static concatFields (data, fields) {
        var ret = [];

        fields.forEach(entry => {
            var v;

            if (typeof entry === 'string') {
                v = data[entry];
            }
            else if (Array.isArray(entry)) {
                for (let key of entry) {
                    if ((v = data[key]) !== undefined) {
                        break;
                    }
                }
            } else {
                v = this.concatFields(data[entry.name], entry.fields);
            }

            if (v instanceof Date) {
                v = v.toISOString();
            }

            if (v == null) {
                ret.push('*');
            } else {
                ret.push(v);
            }
        });

        return '{' + ret.join('}{') + '}';
    }

    static getSignData (data) {
        return this.concatFields(data, this.signFields);
    }

    getSignData () {
        return this.constructor.getSignData(this.data);
    }
}

module.exports = License;
