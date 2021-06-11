'use strict';

var Base = require('../Base'),
    Image = require('./Image');

class Comparator extends Base {

    constructor(cfg) {
        super();
        var me = this;
        Object.assign(me, {
            errorColor: {
                red: 255,
                green: 0,
                blue: 255
            },
            transparency: 0.3,
            mask: 0xff
        });
        Object.assign(me, cfg);
    }


    compare (expected, actual) {
        expected = expected.isImage ? expected : new Image(expected);
        actual = actual.isImage ? actual : new Image(actual);
        var me = this;

        return new Promise(function(resolve, reject) {
            //var t0 = new Date().getTime();
            var actualData = null,
                expectedData = null,
                expectedLoaded = false,
                actualLoaded = false,
                comparator = function(){
                    if (actualData && expectedData) {
                        try {
                            //var t1 = new Date().getTime();
                            var width = expected.width,
                                height = expected.height,
                                diff = new Image({
                                    width: width,
                                    height: height
                                }),
                                buff = diff.data;

                            var pxCount = width * height,
                                diffCount = 0,
                                diffRed = me.errorColor.red,
                                diffGreen = me.errorColor.green,
                                diffBlue = me.errorColor.blue,
                                alpha = me.transparency,
                                mask = me.mask,
                                p, offset, delta,
                                r, g, b, a,
                                er, eb, eg, ea,
                                dr, db, dg, da;

                            for (p = 0; p < pxCount; p++) {
                                offset = p * 4;
                                r = offset + 0;
                                g = offset + 1;
                                b = offset + 2;
                                a = offset + 3;

                                er = expectedData[r];
                                eg = expectedData[g];
                                eb = expectedData[b];
                                ea = expectedData[a];


                                dr = er - actualData[r];
                                dg = eg - actualData[g];
                                db = eb - actualData[b];
                                da = ea - actualData[a];

                                buff[r] = er;
                                buff[g] = eg;
                                buff[b] = eb;
                                buff[a] = ea * alpha;

                                delta = dr | dg | db | da;

                                // if any of the previous values have a bit set,
                                // then we need to verify against the current mask
                                // whether this is an actual difference.  however, if
                                // there a no bits set, then this is already a match
                                if (delta) {
                                    dr = dr < 0 ? -dr : dr;
                                    dg = dg < 0 ? -dg : dg;
                                    db = db < 0 ? -db : db;
                                    da = da < 0 ? -da : da;
                                    delta = (dr & mask) | (dg & mask) | (db & mask) | (da & mask);
                                    if (delta) {
                                        diffCount++;
                                        buff[r] = diffRed;
                                        buff[g] = diffGreen;
                                        buff[b] = diffBlue;
                                        buff[a] = 255;
                                    }
                                }
                            }

                            diff.diffCount = diffCount;
                            //var t2 = new Date().getTime();
                            //console.log('Load Time : ' + (t1 - t0) + ' msec.');
                            //console.log('Diff Time : ' + (t2 - t1) + ' msec.');
                            //console.log('Comp Time : ' + (t2 - t0) + ' msec.');
                            resolve(diff);
                        } catch (err) {
                            reject(err);
                        }
                    }
                    else if (expectedLoaded && actualLoaded) {
                        reject('Failed to load files');
                    }
                };

            expected.load().then(function () {
                expectedData = expected.data;
                expectedLoaded = true;
                comparator();
            }).catch(function(err){
                reject(err);
            });

            actual.load().then(function(){
                actualData = actual.data;
                actualLoaded = true;
                comparator();
            }).catch (function(err) {
                reject(err);
            });

        });
    }

}

module.exports = Comparator;