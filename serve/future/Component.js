/**
 * @class ST.future.Component
 * @extend ST.future.Element
 * This class is used to manage an Ext JS Component (`Ext.Component`) that will exist at
 * some point in the future. The inherited features of {@link ST.future.Element} all
 * operate on the component's primary element.
 *
 * The general mechanics of futures is covered in {@link ST.future.Element}.
 *
 * This class extends its base to provide additional `Ext.Component` specific action
 * and state methods.
 *
 * ### Note
 *
 * This class is not created directly by user code. Instead, it is created automatically
 * by {@link ST#component} or one of the more specific factory methods:
 *
 *  - `{@link ST#button}`
 *  - `{@link ST#checkBox}`
 *  - `{@link ST#comboBox}`
 *  - `{@link ST#dataView}`
 *  - `{@link ST#field}`
 *  - `{@link ST#grid}`
 *  - `{@link ST#panel}`
 *  - `{@link ST#picker}`
 *  - `{@link ST#textField}`
 *
 */
ST.future.define('Component', {
    extend: ST.future.Element,
    valueProperty: 'cmp',

    states: {
        // TODO - focusentered
        // TODO - focusleft

        /**
         * @method destroyed
         * Waits for this component to be destroyed.
         *
         *      ST.component('@someCmp').
         *          destroyed().
         *          and(function (cmp) {
         *              // cmp is now destroyed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Component} this
         * @chainable
         */
        destroyed: {
            available: null,
            visibility: null,

            is: function () {
                var cmp = this.cmp;
                return cmp ? (cmp.destroyed || cmp.isDestroyed) : true;
            },

            wait: 'destroy'
        },

        /**
         * @method disabled
         * Waits for this component to be disabled.
         *
         *      ST.component('@someCmp').
         *          disabled().
         *          and(function (cmp) {
         *              // cmp is now disabled
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Component} this
         * @chainable
         */
        disabled: {
            is: function () {
                return ST.isClassic ? this.cmp.disabled : this.cmp.getDisabled();
            },
            wait: ['disable', 'disabledchange']
        },

        /**
         * @method enabled
         * Waits for this component to be enabled.
         *
         *      ST.component('@someCmp').
         *          enabled().
         *          and(function (cmp) {
         *              // cmp is now enabled
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Component} this
         * @chainable
         */
        enabled: {
            is: function () {
                return ST.isClassic ? !this.cmp.disabled : !this.cmp.getDisabled();
            },
            wait: ['enable', 'disabledchange']
        },

        /**
         * @method rendered
         * Waits for this component to be rendered. This wait method only works when
         * the `ST.component` method is given an un-rendered Component instance. If a
         * locator string is used, the `ST.component` method will implicitly wait for
         * the Component's element to be present in the DOM (i.e., the component is in
         * a rendered state).
         *
         * Since this wait is normally handled by the `ST.component` method, this wait
         * method is seldom needed.
         *
         *      ST.component(comp).  // comp is an unrendered Component instance
         *          rendered().
         *          and(function () {
         *              // comp is now rendered
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Component} this
         * @chainable
         */
        rendered: {
            is: function () {
                return !ST.isClassic || this.cmp.rendered;
            },
            wait: 'afterrender'
        }
    },

    constructor: function (locator, timeout) {
        var me = this,
            comp = locator;

        ST.future.Component.superclass.constructor.call(me, locator, timeout);

        if (comp && !me.locator) {
            // If me.locator is not setup that means the component is not rendered.
            // With Sencha Touch and Ext JS 6 (Modern) this is never the case.

            if (comp.constructor === Object) {
                comp = comp.locator;
            }

            if (comp.isComponent) {
                me.cmp = comp;

                me.locator = function () {
                    return comp.el;  // no need to worry about Modern/Touch
                };
            }
        }
    },

    /**
     * @method disable
     * Schedules this component to be disabled.
     *
     *      ST.component('@someCmp').
     *          disable().
     *          and(function (cmp) {
     *              // cmp has now been disabled.
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Component} this
     * @chainable
     */
    disable: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.disable();
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method enable
     * Schedules this component to be enabled.
     *
     *      ST.component('@someCmp').
     *          enable().
     *          and(function (cmp) {
     *              // cmp has now been enabled.
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Component} this
     * @chainable
     */
    enable: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.enable();
                }
            });

        ST.play([rec]);

        return me;
    },

    /** 
     * @method down
     * Returns a descendant `{@link ST.future.Element future element}` that corresponds to the selector. 
     *
     *      ST.component('@someCmp').
     *          down('panel >> .link').
     *          and(function (element) {
     *              // element is now available
     *          });
     *
     * If the specified selector cannot be resolved, the request will timeout.
     * @param {String} selector The DOM or Composite query selector to use to search for the element
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    down: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'down', selector, timeout);
    },

    /** 
     * @method up
     * Returns an ancestor `{@link ST.future.Element future element}` that corresponds to the selector. 
     *
     *      ST.component('@someCmp').
     *          up('.wrapper').
     *          and(function (element) {
     *              // element is now available
     *          });
     *
     * If the specified selector cannot be resolved, the request will timeout.
     * @param {String} selector The DOM or Composite query selector to use to search for the element
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    up: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'up', selector, timeout);
    },

    /** 
     * @method child
     * Returns a direct child `{@link ST.future.Element future element}` that corresponds to the selector. 
     *
     *      ST.component('@someCmp').
     *          child('.x-button').
     *          and(function (element) {
     *              // element is now available
     *          });
     *
     * If the specified selector cannot be resolved, the request will timeout.
     * @param {String} selector The DOM or Composite query selector to use to search for the element
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Element}
     * @chainable
     */
    child: function (selector, timeout) {
        return this._createRelatedFuture(ST.element, 'child', selector, timeout);
    },

    /**
     * @method gotoComponent
     * Returns a `{@ST.future.Component}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          goToComponent('container').
     *          and(function (container) {
     *              // container is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Component}
     * @chainable
     */
    gotoComponent: function (direction, selector, timeout) {
        return this._goto(ST.component, direction, selector, timeout);
    },

    /**
     * @method gotoButton
     * Returns a `{@ST.future.Button}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoButton('button').
     *          and(function (button) {
     *              // button is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Button}
     * @chainable
     */
    gotoButton: function (direction, selector, timeout) {
        return this._goto(ST.button, direction, selector, timeout);
    },

    /**
     * @method gotoField
     * Returns a `{@ST.future.Field}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoField('field').
     *          and(function (field) {
     *              // field is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Field}
     * @chainable
     */
    gotoField: function (direction, selector, timeout) {
        return this._goto(ST.field, direction, selector, timeout);
    },

    /**
     * @method gotoCheckBox
     * Returns a `{@ST.future.CheckBox}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoCheckBox('checkboxfield').
     *          and(function (checkbox) {
     *              // checkbox is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.CheckBox}
     * @chainable
     */
    gotoCheckBox: function (direction, selector, timeout) {
        return this._goto(ST.checkBox, direction, selector, timeout);
    },

    /**
     * @method gotoTextField
     * Returns a `{@ST.future.TextField}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoTextField('textfield').
     *          and(function (textfield) {
     *              // textfield is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.TextField}
     * @chainable
     */
    gotoTextField: function (direction, selector, timeout) {
        return this._goto(ST.textField, direction, selector, timeout);
    },

    /**
     * @method gotoPicker
     * Returns a `{@ST.future.Picker}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoPicker('pickerfield').
     *          and(function (picker) {
     *              // picker is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Picker}
     * @chainable
     */
    gotoPicker: function (direction, selector, timeout) {
        return this._goto(ST.picker, direction, selector, timeout);
    },

    /**
     * @method gotoComboBox
     * Returns a `{@ST.future.ComboBox}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoComboBox('combobox').
     *          and(function (combobox) {
     *              // combobox is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.ComboBox}
     * @chainable
     */
    gotoComboBox: function (direction, selector, timeout) {
        return this._goto(ST.comboBox, direction, selector, timeout);
    },

    /**
     * @method gotoSelect
     * Returns a `{@ST.future.Select}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoSelect('selectfield').
     *          and(function (select) {
     *              // select is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Select}
     * @chainable
     */
    gotoSelect: function (direction, selector, timeout) {
        return this._goto(ST.select, direction, selector, timeout);
    },

    /**
     * @method gotoPanel
     * Returns a `{@ST.future.Panel}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoPanel('panel').
     *          and(function (panel) {
     *              // panel is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Panel}
     * @chainable
     */
    gotoPanel: function (direction, selector, timeout) {
        return this._goto(ST.panel, direction, selector, timeout);
    },

    /**
     * @method gotoDataView
     * Returns a `{@ST.future.Panel}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoDataView('dataview').
     *          and(function (dataview) {
     *              // dataview is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     * @chainable
     */
    gotoDataView: function (direction, selector, timeout) {
        return this._goto(ST.dataView, direction, selector, timeout);
    },

    /**
     * @method gotoGrid
     * Returns a `{@ST.future.Panel}` future component that is hierarchically-related to the current component future
     *
     *      ST.component('@someCmp').
     *          gotoGrid('grid').
     *          and(function (grid) {
     *              // grid is now available
     *          });
     *
     * @param {"down"/"up"/"child"} direction The direction of relationship.
     * @param {String} selector The Component Query selector.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     * @chainable
     */
    gotoGrid: function (direction, selector, timeout) {
        return this._goto(ST.grid, direction, selector, timeout);
    },

    _goto: function (maker, direction, selector, timeout) {
        if (direction === 'first') {
            selector = selector || '*';
        }

        if (direction === 'last') {
            selector = selector || '*';
        }
        
        return this._createRelatedFuture(maker, direction, selector, timeout);
    },

    // TODO - lookup

    /**
     * Returns the owning `ST.future.Item`. This method can be called at any time
     * to "return" to the owning future. For example:
     *
     *      ST.dataView('@someDataView').
     *          item(42).            // get a future item (ST.future.Item)
     *              asButton().      // get item as a button (ST.future.Button)
     *                  press().     // operates on the ST.future.Button
     *              asItem();        // now back to the item
     *
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     *
     * @return {ST.future.Item}
     */
    asItem: function () {
        return this._dataViewItem;
    },

    _attach: function () {
        this.cmp = this.el.getComponent();
    },

    _getFocusEl: function() {
        var cmp = this.cmp,
            el, fld;

        // if using classic toolkit, we can use getFocusEl()
        if (ST.isClassic) {
            el = cmp.getFocusEl();
        }
        // if not classic and the type is a textfield, we can retrieve the input from the component 
        else if (cmp.isXType('textfield')) {
            fld = cmp.getComponent();
            el = fld.input || fld.inputElement; // 6.2+ changed input to inputElement
        } 
        // otherwise, just fallback to the element; this will accomodate Sencha Touch, and is the default for 
        // what getFocusEl() returns in the modern toolkit
        else {
            el = cmp.el || cmp.element;
        }

        return el;
    }
});

/**
 * Returns a {@link ST.future.Component future component} used to queue operations for
 * when that component becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the component.
 * @return {ST.future.Component}
 * @method component
 * @member ST
 */

//-----------------------------------------------------------------------------
// Button

/**
 * This class provides methods specific to Ext JS Buttons (`Ext.button.Button`).
 *
 * @class ST.future.Button
 * @extend ST.future.Component
 */
ST.future.define('Button', {
    extend: ST.future.Component,

    //TODO menu, split

    states: {
        /**
         * @method pressed
         * Waits for this button to be pressed.
         * This only applies to Ext JS / Classic and Modern toolkit toggle buttons (as of version 6.0.2) and not in Sencha Touch.
         *
         *      ST.button('@someButton').
         *          pressed().
         *          and(function (button) {
         *              // button is now pressed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Button} this
         * @chainable
         */
        pressed: {
            is: function () {
                return ST.isClassic ? this.cmp.pressed : this.cmp.getPressed();
            },
            wait: ['toggle', 'pressedchange']
        },

        /**
         * @method unpressed
         * Waits for this button to be unpressed.
         * This only applies to Ext JS / Classic and Modern toolkit toggle buttons (as of version 6.0.2) and not in Sencha Touch.
         *
         *      ST.button('@someButton').
         *          unpressed().
         *          and(function (button) {
         *              // button is now unpressed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Button} this
         * @chainable
         */
        unpressed: {
            is: function () {
                return ST.isClassic ? !this.cmp.pressed : !this.cmp.getPressed();
            },
            wait: ['toggle', 'pressedchange']
        },

        /**
         * @method expanded
         * Waits for this button's menu to be shown.
         * This only applies to Ext JS / Classic toolkit buttons and not in the Modern toolkit or Sencha Touch.
         *
         *      ST.button('@someButton').
         *          expanded().
         *          and(function (button) {
         *              // button's menu is now visible
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Button} this
         * @chainable
         */
        expanded: {
            is: function () {
                return this.cmp.hasVisibleMenu();
            },
            wait: ['menushow']
        },

        /**
         * @method collapsed
         * Waits for this button's menu to be hidden.
         * This only applies to Ext JS / Classic toolkit buttons and not in the Modern toolkit or Sencha Touch.
         *
         *      ST.button('@someButton').
         *          collapsed().
         *          and(function (button) {
         *              // button's menu is now hidden
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Button} this
         * @chainable
         */
        collapsed: {
            is: function () {
                return !this.cmp.hasVisibleMenu();
            },
            wait: ['menuhide']
        }
    },

    /**
     * @method press
     * Schedules this button to be pressed.
     * This only applies to Ext JS / Classic and Modern toolkit toggle buttons (as of version 6.0.2) and not in Sencha Touch.
     *
     *      ST.button('@someButton').
     *          press().
     *          and(function (button) {
     *              // button has now been pressed.
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Button} this
     * @chainable
     */
    press: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.setPressed(true);
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method unpress
     * Schedules this button to be unpressed.
     * This only applies to Ext JS / Classic and Modern toolkit toggle buttons (as of version 6.0.2) and not in Sencha Touch.
     *
     *      ST.button('@someButton').
     *          unpress().
     *          and(function (button) {
     *              // button has now been unpressed.
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Button} this
     * @chainable
     */
    unpress: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.setPressed(false);
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method expand
     * Schedules this button's menu to be shown.
     * This only applies to Ext JS / Classic toolkit buttons and not in the Modern toolkit or Sencha Touch.
     *
     *      ST.button('@someButton').
     *          expand().
     *          and(function (button) {
     *              // button's menu is shown
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Button} this
     * @chainable
     */
    expand: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.showMenu();
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method collapse
     * Schedules this button's menu to be hidden.
     * This only applies to Ext JS / Classic toolkit buttons and not in the Modern toolkit or Sencha Touch.
     *
     *      ST.button('@someButton').
     *          collapse().
     *          and(function (button) {
     *              // button's menu is hidden
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Button} this
     * @chainable
     */
    collapse: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.hideMenu();
                }
            });

        ST.play([rec]);

        return me;
    }
});

/**
 * Returns a {@link ST.future.Button future button} used to queue operations for
 * when that button becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the button.
 * @return {ST.future.Button}
 * @method button
 * @member ST
 */

//-----------------------------------------------------------------------------
// Field

/**
 * This class provides methods specific to Ext JS Field (`Ext.form.field.Base`, `Ext.field.Field`). This
 * class can be used to wait on component states like so:
 *
 *      ST.field('@someField').
 *          value(42).
 *          and(function (field) {
 *              // field has received the value 42
 *          });
 *
 * It can also be used to manipulate the component state:
 *
 *      ST.field('@someField').
 *          setValue(42).
 *          and(function (field) {
 *              // field has now been set to the value 42
 *          });
 *
 * @class ST.future.Field
 * @extend ST.future.Component
 */
ST.future.define('Field', {
    extend: ST.future.Component,

    states: {
        /**
         * @method value
         * Waits for this Field to have the specified value.
         *
         *      ST.field('@someField').
         *          value('Something').
         *          and(function (field) {
         *              // textField has received the value "Something"
         *          });
         *
         * @param {String} value The value for which to wait.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Field} this
         * @chainable
         */
        value: {
            is: function (value) {
                var v = this.cmp.getValue();
                return v === value;
            },
            wait: 'change'
        },

        /**
         * @method valueEmpty
         * Waits for this Field to have an empty value.
         *
         *      ST.field('@someField').
         *          valueEmpty().
         *          and(function (field) {
         *              // field value is now empty
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Field} this
         * @chainable
         */
        valueEmpty: {
            is: function () {
                var v = this.cmp.getValue();
                return !(v || v === 0);
            },
            wait: 'change'
        },

        /**
         * @method valueNotEmpty
         * Waits for this Field to have a non-empty value.
         *
         *      ST.field('@someField').
         *          valueNotEmpty().
         *          and(function (field) {
         *              // field value is now non-empty
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Field} this
         * @chainable
         */
        valueNotEmpty: {
            is: function () {
                var v = this.cmp.getValue();
                return (v || v === 0);
            },
            wait: 'change'
        }
    },

    /**
     * Schedules a `setValue` call on the underlying Field.
     *
     *      ST.field('@someField').
     *          setValue('Something').
     *          and(function (field) {
     *              // field value is now "Something"
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `value` property). In this case, all
     * other arguments are ignored.
     *
     * @param {String/Object} value The new value for the text field.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @returns {ST.future.Field}
     * @chainable
     */
    setValue: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'value,timeout', {
                target: me.locator,

                fn: function () {
                    var cmp = me.cmp;
                    cmp.setValue(value);
                }
            }),
            value = rec.value;

        delete rec.value;

        ST.play([rec]);

        return me;
    }
});

/**
 * Returns a {@link ST.future.Field future field} used to queue operations for
 * when that component becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the component.
 * @return {ST.future.Field}
 * @method field
 * @member ST
 */

//-----------------------------------------------------------------------------
// Checkbox

/**
 * This class provides methods specific to Ext JS Checkbox (`Ext.form.field.Checkbox` or `Ext.field.Checkbox`).
 * In addition to `ST.future.Field` features, this class adds value `checked` and
 * `unchecked` testing. For example:
 *
 *      ST.checkBox('@someCheckBox').
 *          checked().
 *          and(function (checkbox) {
 *              // now checked
 *          }).
 *          unchecked().
 *          and(function (checkbox) {
 *              // not unchecked
 *          });
 *
 * @class ST.future.CheckBox
 * @extend ST.future.Field
 */
ST.future.define('CheckBox', {
    extend: ST.future.Field,
    states: {
        /**
         * @method value
         * Waits for this CheckBox to have the specified value.
         *
         *      ST.checkBox('@someCheckBox').
         *          value(true);
         *
         * NOTE: The `value` of the underlying checkbox component may differ from the `checked` state,
         * depending on the Ext JS toolkit being used (or Sencha Touch), which may produce unexpected results 
         * when using `value()` on the CheckBox future. 
         *
         * It is therefore recommended to use `checked()` and/or `unchecked()` when interacting with 
         * the checked state of the underlying checkbox component.
         *
         * @param {String} value The value for which to wait.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.CheckBox} this
         * @chainable
         */

        /**
         * @method valueEmpty
         * Waits for this CheckBox to have an empty value.
         *
         *      ST.checkBox('@someCheckBox').
         *          valueEmpty().
         *          and(function (checkBox) {
         *              // checkbox value is now empty
         *          });
         *
         * NOTE: The `value` of the underlying checkbox component may differ from the `checked` state,
         * depending on the Ext JS toolkit being used (or Sencha Touch), which may produce unexpected results 
         * when using `valueEmpty()` on the CheckBox future. 
         *
         * It is therefore recommended to use `checked()` and/or `unchecked()` when interacting with 
         * the checked state of the underlying checkbox component.
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.CheckBox} this
         * @chainable
         */

        /**
         * @method valueNotEmpty
         * Waits for this CheckBox to have a non-empty value.
         *
         *      ST.checkBox('@someCheckBox').
         *          valueNotEmpty().
         *          and(function (checkBox) {
         *              // checkbox value is now non-empty
         *          });
         *
         *
         * NOTE: The `value` of the underlying checkbox component may differ from the `checked` state,
         * depending on the Ext JS toolkit being used (or Sencha Touch), which may produce unexpected results 
         * when using `valueNotEmpty()` on the CheckBox future. 
         *
         * It is therefore recommended to use `checked()` and/or `unchecked()` when interacting with 
         * the checked state of the underlying checkbox component.
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.CheckBox} this
         * @chainable
         */

        /**
         * @method checked
         * Waits for the underlying CheckBox to be `checked`.
         *
         *      ST.checkBox('@someCheckBox').
         *          checked().
         *          and(function (checkBox) {
         *              // checkBox is in a checked state
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.CheckBox} this
         * @chainable
         */
        checked: {
            is: function () {
                return ST.isClassic ? this.cmp.checked : this.cmp.getChecked();
            },
            wait: 'change'
        },

        /**
         * @method unchecked
         * Waits for the underlying CheckBox to be `unchecked`.
         *
         *      ST.checkBox('@someCheckBox').
         *          unchecked().
         *          and(function (checkBox) {
         *              // checkBox is in an unchecked state
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.CheckBox} this
         * @chainable
         */
        unchecked: {
            is: function () {
                return ST.isClassic ? !this.cmp.checked : !this.cmp.getChecked();
            },
            wait: 'change'
        }
    },

    /**
     * Schedules a `setValue` call on the underlying CheckBox.
     *
     *      ST.checkBox('@someField').
     *          setValue(true);
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object (with an additional required `value` property). In this case, all
     * other arguments are ignored.
     *
     * NOTE: The `value` of the underlying checkbox component may differ from the `checked` state,
     * depending on the Ext JS toolkit being used (or Sencha Touch), which may produce unexpected results 
     * when using `setValue()` on the CheckBox future. 
     *
     * It is therefore recommended to use `check()`, `uncheck()`, and `setChecked()` 
     * when interacting with the checked state of the underlying checkbox component.
     * 
     * @param {String/Object} value The new value for the checkbox field.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @returns {ST.future.CheckBox}
     * @chainable
     */

    /**
     * Schedules the checkbox to be checked.
     *
     *      ST.checkBox('@someCheckBox').
     *          check().
     *          and(function (checkBox) {
     *              // checkBox is now checked
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @returns {ST.future.CheckBox}
     * @chainable
     */
    check: function () {
        var me = this;

        ST.play([{
            target: me.locator,
            fn: function () {
                me._setChecked(true);
            }
        }]);

        return me;
    },

    /**
     * Schedules the checkbox to be unchecked.
     *
     *      ST.checkBox('@someCheckBox').
     *          uncheck().
     *          and(function (checkBox) {
     *              // checkBox is now unchecked
     *          });
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     *
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @returns {ST.future.CheckBox}
     * @chainable
     */
    uncheck: function () {
        var me = this;

        ST.play([{
            target: me.locator,
            fn: function () {
                me._setChecked(false);
            }
        }]);

        return me;
    },

    _setChecked: function (checked) {
        var me = this,
            cmp = me.cmp;

        if (ST.isClassic) {
            // classic does not have setChecked, so we need to use setValue
            cmp.setValue(checked);
        } else {
            cmp.setChecked(checked);
        }
    }
});

/**
 * Returns a {@link ST.future.CheckBox future checkBox} used to queue operations for
 * when that component becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the component.
 * @return {ST.future.CheckBox}
 * @method checkBox
 * @member ST
 */

//-----------------------------------------------------------------------------
// TextField

/**
 * This class provides methods specific to Ext JS TextField (`Ext.form.field.Text` or `Ext.field.Text`).
 * In addition to `ST.future.Field` features, this class adds value similarity
 * checking. For example:
 *
 *      ST.textField('@someTextField').
 *          valueLike('world').
 *          and(function (textField) {
 *              // the value now contains the text "world"
 *          }).
 *          valueNotLike(/^hello/i).
 *          and(function (textField) {
 *              // the value no longer starts with "hello" (ignoring case)
 *          });
 *
 * @class ST.future.TextField
 * @extend ST.future.Field
 */
ST.future.define('TextField', {
    extend: ST.future.Field,

    states: {
        /**
         * @method valueLike
         * Waits for this TextField to have a value like the given `pattern`.
         *
         *      ST.textField('@someTextField').
         *          valueLike(/bar$/i).
         *          and(function (textField) {
         *              // textField value now ends with "bar" (ignoring case)
         *          });
         *
         * @param {RegExp/String/Object} pattern The pattern to match. If this is a String,
         * it is first promoted to a `RegExp` by called `new RegExp(pattern)`.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.TextField} this
         * @chainable
         */
        valueLike: {
            is: function (pattern) {
                var v = this.cmp.getValue(),
                    re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

                return re.test(v);
            },
            wait: 'change'
        },

        /**
         * @method valueNotLike
         * Waits for this TextField to have a value that does not match the given `pattern`.
         *
         *      ST.textField('@someTextField').
         *          valueNotLike(/bar$/i).
         *          and(function (textField) {
         *              // textField value does not end with "bar" (ignoring case)
         *          });
         *
         * @param {RegExp/String/Object} pattern The pattern to match. If this is a String,
         * it is first promoted to a `RegExp` by called `new RegExp(pattern)`.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.TextField} this
         * @chainable
         */
        valueNotLike: {
            is: function (pattern) {
                var v = this.cmp.getValue(),
                    re = (typeof pattern === 'string') ? new RegExp(pattern) : pattern;

                return !re.test(v);
            },
            wait: 'change'
        }
    }
});

/**
 * Returns a {@link ST.future.TextField future textfield} used to queue operations for
 * when that component becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the component.
 * @return {ST.future.TextField}
 * @method textField
 * @member ST
 */

//-----------------------------------------------------------------------------
// Picker

/**
 * This class provides methods specific to Ext JS Pickers (`Ext.form.field.Picker`). This only applies to Ext JS / Classic
 * and not in the Modern toolkit (as of version 6.0.1) or Sencha Touch.
 *
 * @class ST.future.Picker
 * @extend ST.future.TextField
 */
ST.future.define('Picker', {
    extend: ST.future.TextField,

    states: {
        /**
         * @method collapsed
         * Waits for this picker to be collapsed.
         *
         *      ST.picker('@somePicker').
         *          collapsed().
         *          and(function (picker) {
         *              // picker is now collapsed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Picker} this
         * @chainable
         */
        collapsed: {
            is: function () {
                return !this.cmp.isExpanded;
            },
            wait: 'collapse'
        },

        /**
         * @method expanded
         * Waits for this picker to be expanded.
         *
         *      ST.picker('@somePicker').
         *          expanded().
         *          and(function (picker) {
         *              // picker is now expanded
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Picker} this
         * @chainable
         */
        expanded: {
            is: function () {
                return this.cmp.isExpanded;
            },
            wait: 'expand'
        }
    },

    /**
     * @method collapse
     * Schedules this picker to collapse. All arguments passed to this method will be
     * forwarded to the `collapse` method of the picker at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Picker} this
     * @chainable
     */
    collapse: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.collapse();
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method expand
     * Schedules this picker to expand. All arguments passed to this method will be
     * forwarded to the `expand` method of the picker at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Picker} this
     * @chainable
     */
    expand: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function () {
                    me.cmp.expand();
                }
            });

        ST.play([rec]);

        return me;
    }
});

/**
 * Returns a {@link ST.future.Picker future picker} used to queue operations for
 * when that `Ext.form.field.Picker` becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the picker.
 * @return {ST.future.Picker}
 * @method picker
 * @member ST
 */

//-----------------------------------------------------------------------------
// ComboBox

/**
 * This class provides methods specific to Ext JS ComboBox (`Ext.form.field.ComboBox`).
 * This is only available in Ext JS / Classic, not in the Modern toolkit (as of version 6.0.1) or Sencha Touch.
 *
 * @class ST.future.ComboBox
 * @extend ST.future.Picker
 */
ST.future.define('ComboBox', {
    extend: ST.future.Picker,

    states: {
        // TODO - queried
        // TODO - loaded
        // TODO - selected
    }
});

/**
 * Returns a {@link ST.future.ComboBox future ComboBox} used to queue operations for
 * when that `Ext.form.field.ComboBox` becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the combobox.
 * @return {ST.future.ComboBox}
 * @method comboBox
 * @member ST
 */

//-----------------------------------------------------------------------------
// Select

/**
 * This class provides methods specific to Ext JS Select fields (`Ext.field.Select`). 
 * This only applies to Ext JS / Modern and Sencha Touch, and is not available in the Classic toolkit.
 *
 * @class ST.future.Select
 * @extend ST.future.TextField
 */
ST.future.define('Select', {
    extend: ST.future.TextField,

    states: {
        /**
         * @method collapsed
         * Waits for this select field to be collapsed.
         *
         *      ST.select('@someSelect').
         *          collapsed().
         *          and(function (select) {
         *              // select field is now collapsed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Select} this
         * @chainable
         */
        collapsed: {
            is: function () {
                return this.getPicker().isHidden();
            },
            wait: function (done) {
                var me = this,
                    picker = me.getPicker(),
                    listener = {
                        hide: done,
                        single: true
                    };                 

                picker.on(listener);

                return function () {
                    picker.un(listener)
                }
            }
        },

        /**
         * @method expanded
         * Waits for this select field to be expanded.
         *
         *      ST.select('@someSelect').
         *          expanded().
         *          and(function (select) {
         *              // select field is now expanded
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Select} this
         * @chainable
         */
        expanded: {
            is: function () {
                var picker = this.getPicker();
                return !picker.isHidden() && picker.isPainted();
            },
            wait: function (done) {
                var me = this,
                    picker = me.getPicker(),
                    listener = {
                        show: done,
                        single: true
                    };                 

                picker.on(listener);

                return function () {
                    picker.un(listener)
                }
            }
        }
    },

    /**
     * @method collapse
     * Schedules this select field to collapse. All arguments passed to this method will be
     * forwarded to the `collapse` method of the select field at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Select} this
     * @chainable
     */
    collapse: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function (done) {
                    var picker = me.getPicker(),
                        needsCallback = me.cmp.getUsePicker();

                    if (needsCallback) {
                        picker.on('hide', function () {
                            done();
                        }, {
                            single: true
                        });
                        picker.hide();
                    } else {
                        picker.hide();
                        done();
                    }
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @method expand
     * Schedules this select field to expand. All arguments passed to this method will be
     * forwarded to the `expand` method of the select field at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. In this case, all other arguments are ignored.
     * @param {Number/Object} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Select} this
     * @chainable
     */
    expand: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'timeout', {
                target: me.locator,

                fn: function (done) {
                    var picker = me.getPicker(),
                        needsCallback = me.cmp.getUsePicker();

                    if (needsCallback) {
                        picker.on('show', function () {
                            done();
                        }, {
                            single: true
                        });
                        me.cmp.showPicker();
                    } else {
                        me.cmp.showPicker();
                        done();
                    }
                }
            });

        ST.play([rec]);

        return me;
    },

    /**
     * @private
     */
    getPicker: function () {
        var me = this,
            cmp = me.cmp;

        return cmp.getUsePicker() ? cmp.getPhonePicker() : cmp.getTabletPicker();
    }
});

/**
 * Returns a {@link ST.future.Select future select field} used to queue operations for
 * when that `Ext.field.Select` becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the select field.
 * @return {ST.future.Select}
 * @method select
 * @member ST
 */

//-----------------------------------------------------------------------------
// Panel

/**
 * This class provides methods specific to Ext JS Panels (`Ext.panel.Panel` or
 * `Ext.Panel`).
 *
 * @class ST.future.Panel
 * @extend ST.future.Component
 */
ST.future.define('Panel', {
    extend: ST.future.Component,

    states: {
        /**
         * @method collapsed
         * Waits for this panel to be collapsed. This only applies to Ext JS / Classic
         * panels and not in the Modern toolkit (as of version 6.0.1) or Sencha Touch.
         *
         *      ST.panel('@somePanel').
         *          collapsed().
         *          and(function (panel) {
         *              // panel is now collapsed
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Panel} this
         * @chainable
         */
        collapsed: {
            is: function () {
                return this.cmp.collapsed;
            },
            wait: 'collapse'
        },

        /**
         * @method expanded
         * Waits for this panel to be expanded. This only applies to Ext JS / Classic
         * panels and not in the Modern toolkit (as of version 6.0.1) or Sencha Touch.
         *
         *      ST.panel('@somePanel').
         *          expanded().
         *          and(function (panel) {
         *              // panel is now expanded
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Panel} this
         * @chainable
         */
        expanded: {
            is: function () {
                return !this.cmp.collapsed;
            },
            wait: 'expand'
        }
    },

    /**
     * @method collapse
     * Schedules this panel to collapse. All arguments passed to this method will be
     * forwarded to the `collapse` method of the panel at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. This object can also contain the optional `direction` and `animate`
     * properties. In this case, all other arguments are ignored.
     * @param {String/Object} [direction] The direction to collapse towards. Must be one of
     *
     *   - Ext.Component.DIRECTION_TOP
     *   - Ext.Component.DIRECTION_RIGHT
     *   - Ext.Component.DIRECTION_BOTTOM
     *   - Ext.Component.DIRECTION_LEFT
     *
     * Defaults to the panel's `collapseDirection` config.
     *
     * @param {Boolean} [animate] True to animate the transition, else false
     * (defaults to the value of the `animCollapse` panel config). May also be specified
     * as the animation duration in milliseconds.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Panel} this
     * @chainable
     */
    collapse: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'direction,animate,timeout', {
                target: me.locator,

                fn: function () {
                    var cmp = me.cmp;
                    cmp.collapse.apply(cmp, args);
                }
            }),
            args = [];

        if ('direction' in rec) {
            args[0] = rec.direction;
            delete rec.direction;

            if ('animate' in rec) {
                args[1] = rec.animate;
                delete rec.animate;
            }
        }

        ST.play([rec]);

        return me;
    },

    /**
     * @method expand
     * Schedules this panel to expand. All arguments passed to this method will be
     * forwarded to the `expand` method of the panel at the appropriate time so
     * consult the documentation for the actual framework and version you are using
     * for parameter details.
     *
     * If first argument is an object, it should be a {@link ST.event.Playable playable}
     * config object. This object can also contain an optional `animate` property. In this
     * case, all other arguments are ignored.
     * @param {Boolean} [animate] True to animate the transition, else false
     * (defaults to the value of the `animCollapse` panel config).  May
     * also be specified as the animation duration in milliseconds.
     * @return {ST.future.Panel} this
     * @chainable
     */
    expand: function () {
        var me = this,
            rec = me._decodeArgs(arguments, 'direction,animate,timeout', {
                target: me.locator,

                fn: function () {
                    var cmp = me.cmp;
                    cmp.expand.apply(cmp, args);
                }
            }),
            args = [];

        if ('animate' in rec) {
            args[0] = rec.animate;
            delete rec.animate;
        }

        ST.play([rec]);

        return me;
    }
});

/**
 * Returns a {@link ST.future.Panel future panel} used to queue operations for
 * when that panel becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the panel.
 * @return {ST.future.Panel}
 * @method panel
 * @member ST
 */

/**
 * @private
 * @class ST.future.SelectionModel
 * Mixin to provide selection-related capabilities to grid and dataviews. 
 */
ST.future.define('SelectionModel', {
    factoryable: false,
    valueProperty: false,
    states: {
        /**
         * @method selected
         * Waits for the given records (by id) to be selected
         *
         *      ST.dataView('@someDataView').
         *          selected([1, 3]).
         *          and(function (dataView) {
         *              // 2 records are now selected
         *          });
         *
         * @param {Number/Number[]} id The ids of the records to select.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        selected: {
            is: function (id) {
                var config = {
                    ids: ST.isArray(id) ? id : [id],
                    type: 'id',
                    mode: 'select'
                };

                return this._validateSelections(config);
            },
            wait: ['select']
        },

        /**
         * @method selectedAt
         * Waits for the given records (by index) to be selected
         *
         *      ST.dataView('@someDataView').
         *          selectedAt([1, 3]).
         *          and(function (dataView) {
         *              // 2 records are now selected
         *          });
         *
         * @param {Number/Number[]} index The indexes of the records to select.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        selectedAt: {
            is: function (index) {
                var config = {
                    indexes: ST.isArray(index) ? index : [index],
                    type: 'index',
                    mode: 'select'
                };

                return this._validateSelections(config);
            },
            wait: ['select']
        },

        /**
         * @method selectedRange
         * Waits for the given records (by range of indexes) to be selected
         *
         *      ST.dataView('@someDataView').
         *          selectedRange(15, 45).
         *          and(function (dataView) {
         *              // range of records are now selected
         *          });
         *
         * @param {Number} start The starting index of the records to select.
         * @param {Number} [end] The ending index of the records to select. 
         * If not specified, the remainder of the available records will be selected
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        selectedRange: {
            is: function (start, end) {
                var config = {
                    start: start,
                    end: end,
                    type: 'range',
                    mode: 'select'
                };

                return this._validateSelections(config);
            },
            wait: ['select']
        },

        /**
         * @method selectedWith
         * Waits for the given records (by simple query) to be selected
         *
         *      ST.dataView('@someDataView').
         *          selectedWith('name', 'Doug').
         *          and(function (dataView) {
         *              // matching records are now selected
         *          });
         *
         * @param {String} propertyName The name of the property in the record against which to query.
         * @param {String} propertyValue The value against which to query.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        selectedWith: {
            is: function (propertyName, propertyValue) {
                var config = {
                    propertyName: propertyName,
                    propertyValue: propertyValue,
                    type: 'query',
                    mode: 'select'
                };

                return this._validateSelections(config);
            },
            wait: ['select']
        },

        /**
         * @method deselected
         * Waits for the given records (by id) to be deselected
         *
         *      ST.dataView('@someDataView').
         *          ... select records ...
         *          deselected([1, 3]).
         *          and(function (dataView) {
         *              // 2 records are now deselected
         *          });
         *
         * @param {Number/Number[]} id The ids of the records to deselect.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        deselected: {
            is: function (id) {
                var config = {
                    ids: ST.isArray(id) ? id : [id],
                    type: 'id',
                    mode: 'deselect'
                };

                return this._validateSelections(config);
            },
            wait: ['deselect']
        },

        /**
         * @method deselectedAt
         * Waits for the given records (by index) to be deselected
         *
         *      ST.dataView('@someDataView').
         *          ... select records ...
         *          deselectedAt([1, 3]).
         *          and(function (dataView) {
         *              // 2 records are now deselected
         *          });
         *
         * @param {Number/Number[]} index The indexes of the records to deselect.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        deselectedAt: {
            is: function (index) {
                var config = {
                    indexes: ST.isArray(index) ? index : [index],
                    type: 'index',
                    mode: 'deselect'
                };

                return this._validateSelections(config);
            },
            wait: ['deselect']
        },

        /**
         * @method deselectedRange
         * Waits for the given records (by range of indexes) to be deselected
         *
         *      ST.dataView('@someDataView').
         *          ... select records ...
         *          deselectedRange(15, 45).
         *          and(function (dataView) {
         *              // range of records are now deselected
         *          });
         *
         * @param {Number} start The starting index of the records to deselect.
         * @param {Number} [end] The ending index of the records to deselect. 
         * If not specified, the remainder of the available records will be deselected
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        deselectedRange: {
            is: function (start, end) {
                var config = {
                    start: start,
                    end: end,
                    type: 'range',
                    mode: 'deselect'
                };

                return this._validateSelections(config);
            },
            wait: ['deselect']
        },

        /**
         * @method deselectedWith
         * Waits for the given records (by simple query) to be deselected
         *
         *      ST.dataView('@someDataView').
         *          ... select records ...
         *          deselectedWith('name', 'Doug').
         *          and(function (dataView) {
         *              // matching records are now deselected
         *          });
         *
         * @param {String} propertyName The name of the property in the record against which to query.
         * @param {String} propertyValue The value against which to query.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        deselectedWith: {
            is: function (propertyName, propertyValue) {
                var config = {
                    propertyName: propertyName,
                    propertyValue: propertyValue,
                    type: 'query',
                    mode: 'deselect'
                };

                return this._validateSelections(config);
            },
            wait: ['deselect']
        }
    },

    /**
     * Selects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    select: function (id, keepExisting, timeout) {
        return this.selectBy({
            ids: ST.isArray(id) ? id : [id],
            keepExisting: keepExisting,
            type: 'id'
        }, timeout);
    },

    /**
     * Selects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    selectAt: function (index, keepExisting, timeout) {
        return this.selectBy({
            indexes: ST.isArray(index) ? index : [index],
            keepExisting: keepExisting,
            type: 'index'
        }, timeout);
    },

    /**
     * Selects the requested record(s) by index range.
     * @param {Number} start The starting index for the selection.
     * @param {Number} [end] The ending index for the selection. 
     * If not specified, the full range from the starting index will be included
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    selectRange: function (start, end, keepExisting, timeout) {
        return this.selectBy({
            start: start,
            end: end,
            keepExisting: keepExisting,
            type: 'range'
        }, timeout);
    },

    /**
     * Selects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    selectWith: function (propertyName, propertyValue, keepExisting, timeout) {
        return this.selectBy({
            propertyName: propertyName,
            propertyValue: propertyValue,
            keepExisting: keepExisting,
            type: 'query'
        }, timeout);
    },

    /**
     * Selects all available records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    selectAll: function (timeout) {
        return this.selectBy({
            type: 'all'
        }, timeout);
    },

    /**
     * Deselects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselect: function (id, timeout) {
        return this.deselectBy({
            ids: ST.isArray(id) ? id : [id],
            type: 'id'
        }, timeout);
    },

    /**
     * Deselects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselectAt: function (index, keepExisting, timeout) {
        return this.deselectBy({
            indexes: ST.isArray(index) ? index : [index],
            type: 'index'
        }, timeout);
    },

    /**
     * Deselects the requested record(s) by index range.
     * @param {Number} start The starting index for the deselection.
     * @param {Number} [end] The ending index for the deselection. 
     * If not specified, the full range from the starting index will be included.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselectRange: function (start, end, timeout) {
        return this.deselectBy({
            start: start,
            end: end,
            type: 'range'
        }, timeout);
    },

    /**
     * Deselects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselectWith: function (propertyName, propertyValue, timeout) {
        return this.deselectBy({
            propertyName: propertyName,
            propertyValue: propertyValue,
            type: 'query'
        }, timeout);
    },

    /**
     * Deselects all selected records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselectAll: function (timeout) {
        return this.deselectBy({
            type: 'all'
        }, timeout);
    },

    /**
     * Selects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the selection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    selectBy: function (config, timeout) {
        config.mode = 'select';

        this._doSelect(config, timeout);

        return this;
    },

    /**
     * Deselects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the deselection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselectBy: function (config, timeout) {
        config.mode = 'deselect';

        this._doSelect(config, timeout);

        return this;
    },

    /**
     * @private
     * Validates current selections against the passed configuration options
     * @param {Object} config Configuration for validation of selections
     * @return {Boolean}
     */
    _validateSelections: function (config) {
        var me = this,
            cmp = me.cmp,
            selections = ST.isClassic ? cmp.getSelection() : cmp.getSelections(),
            store = cmp.getStore(),
            records = me._getRecords(config),
            expectedLength = (config.ids && config.ids.length) || (config.indexes && config.indexes.length),
            matchCount = 0,
            useLength = config.mode === 'select' ? true : false,
            len = records.length,
            i, x, record, index;  

        // if we have an expected number of records (id, index searches), but the length of those
        // is not the same as the number of found records, this is a failure and we can abort
        if (ST.isNumber(expectedLength) && expectedLength !== len) {
            return false;
        }

        for (i=0; i<len; i++) {
            if (selections.indexOf(records[i]) !== -1) {
                matchCount++;
            }
        }

        return matchCount === (useLength ? len : 0);        
    },

    /**
     * @private
     * When the target is ready, this will execute the appropriate selection method based on the passed configuration
     * @param {Object} config The configuration object that will provide the necessary information to influence the selection
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     */
    _doSelect: function (config, timeout) {
        var me = this,
            rec = me._decodeArgs(arguments, 'config,timeout', {
                target: me.locator,

                fn: function () {
                    var cmp = me.cmp,
                        selModel = ST.isClassic ? cmp.getSelectionModel() : cmp,
                        store = cmp.getStore(),
                        records = me._getRecords(config);

                    if (config.mode === 'select') {
                        selModel.select(records, config.keepExisting);
                    } else {
                        selModel.deselect(records);
                    }
                    
                }
            }),
            // get all the config values
            config = rec.config;
        
        delete rec.config;

        ST.play([rec]);
    },

    /**
     * @private
     * Utility to retrieve collection of records based on various criteria
     * @param {Object} options Configuration options to influence how records are retrieved
     * @return {Array}
     */
    _getRecords: function (options) {
        var store = this.cmp.getStore(),
            type = options.type,
            ids = options.ids,
            indexes = options.indexes,
            start = options.start,
            end = options.end,
            propertyName = options.propertyName,
            propertyValue = options.propertyValue,
            records = [],
            fn, items, len, value, record, i;

        switch (type) {
            case 'all': 
                records = store.getRange();
                break;
            case 'id':
            case 'index':
                fn = type === 'id' ? 'getById' : 'getAt';
                items = type === 'id' ? ids : indexes;
                len = items.length;
                // for id/index based searches, loop over options and use appropriate
                // method in store to retrieve record
                for (i=0; i<len; i++) {
                    record = store[fn](items[i]);

                    if (record) {
                        records.push(record);
                    }
                }

                break;
            case 'range': 
                records = store.getRange(start, end); 
                break;
            case 'query':
                // TODO: maybe filter instead?
                store.each(function (record) {
                    value = record.get(propertyName);

                    if (value !== undefined && value === propertyValue) {
                        records.push(record);
                    }
                });
                break;
        }
        
        return records;
    }
});

/**
 * @private
 * @class ST.future.Selection
 * Mixin to provide selection-related capabilities to rows and data view items. 
 */
ST.future.define('Selection', {
    factoryable: false,
    valueProperty: false,
    states: {
        /**
         * @method selected
         * Waits for the record to be selected
         *
         *      ST.dataView('@someDataView').
         *          itemAt(1).
         *          selected().
         *          and(function (item) {
         *              // item is now selected
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        selected: {
            is: function () {
                var config = {
                    indexes: [this.recordIndex],
                    type: 'index',
                    mode: 'select'
                };

                return this._viewRoot._validateSelections(config);
            },
            wait: function (done) {
                var me = this,
                    cmp = me.ownerCmp,
                    listener = {
                        select: function (view, record) {
                            var selections = ST.isClassic ? view.getSelection() : view.getSelections(),
                                store = view.getStore(),
                                record = store.getAt(me.recordIndex);

                            if (ST.Array.indexOf(selections, record) !== -1) {
                                cmp.un(listener);
                                done();
                            }
                        }
                    };                 

                cmp.on(listener);

                return function () {
                    cmp.un(listener)
                }
            }
        },

        /**
         * @method deselected
         * Waits for the record to be deselected
         *
         *      ST.dataView('@someDataView').
         *          itemAt(150).
         *          selected().
         *          reveal().
         *          deselected().
         *          and(function (item) {
         *              // item is now deselected
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @chainable
         */
        deselected: {
            is: function () {
                var config = {
                    indexes: [this.recordIndex],
                    type: 'index',
                    mode: 'deselect'
                };

                return this._viewRoot._validateSelections(config);
            },
            wait: function (done) {
                var me = this,
                    cmp = me.ownerCmp,
                    listener = {
                        deselect: function (view, record) {
                            var selections = ST.isClassic ? view.getSelection() : view.getSelections(),
                                store = view.getStore(),
                                record = store.getAt(me.recordIndex);

                            if (ST.Array.indexOf(selections, record) === -1) {
                                cmp.un(listener);
                                done();
                            }
                        }
                    };                 

                cmp.on(listener);

                return function () {
                    cmp.un(listener)
                }
            }
        }
    },

    /**
     * Selects the item's record
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    select: function (keepExisting, timeout) {
        var me = this;

        ST.play([{
            timeout: timeout,
            ready: function () {
                return me.recordIndex !== undefined;
            },
            fn: function () {
                me._viewRoot.selectBy({
                    indexes: [me.recordIndex],
                    keepExisting: keepExisting,
                    type: 'index'
                }, timeout);
            }
        }]);

        return me;
    },

    /**
     * Deselects the item's record
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @chainable
     */
    deselect: function (timeout) {
        var me = this;

        ST.play([{
            timeout: timeout,
            ready: function () {
                return me.recordIndex !== undefined;
            },
            fn: function () {
                me._viewRoot.deselectBy({
                    indexes: [me.recordIndex],
                    type: 'index'
                }, timeout);
            }
        }]);

        return me;
    }
});

//-----------------------------------------------------------------------------
// DataView / Item

/**
 * @class ST.future.Item
 * This class provides methods to interact with a `DataView` item when it becomes
 * available. Instances of this class are returned by the following methods:
 *
 *  * {@link ST.future.DataView#item}
 *  * {@link ST.future.DataView#itemAt}
 *  * {@link ST.future.DataView#itemBy}
 *  * {@link ST.future.DataView#itemWith}
 */
ST.future.define('Item', {
    extend: ST.future.Element,
    mixins: [ST.future.Selection],
    factoryable: false,
    valueProperty: null,

    /**
     * @property {Ext.view.View} ownerCmp
     * @readonly
     * The associated Ext JS DataView. This property will not be available immediately
     * and is intended for use in `{@link ST.future.Element#and and}` methods since these
     * are run after the component has been located.
     */

    /**
     * @cfg {Number} at
     * The item index in the component's `store`. This property is set when calling the
     * {@link ST.future.DataView#itemAt} method.
     *
     * If specified the `itemId`, `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg itemId
     * The value of the `idProperty` of the item's record. This property is set when
     * calling the {@link ST.future.DataView#item} method.
     *
     * If specified the `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg {String} propertyName
     * The name of the property for which to search. The first record that matches the
     * desired `propertyValue` is used as returned by the store's `find()` method.
     *
     * This property is set when calling the {@link ST.future.DataView#itemWith} method.
     *
     * If specified the `propertyValue` must also be specified.
     */

    /**
     * @cfg {Object/RegExp} propertyValue
     * The value that must exactly match that of the `propertyName` unless this is a
     * `RegExp`.  This and the `propertyName` are passed to the store's `find()` method
     * to find the matching record.
     *
     *  This property is set when calling the {@link ST.future.DataView#itemWith} method.
     */

    /**
     * @method selected
     * Waits for the item's record to be selected
     *
     *      ST.dataView('@someDataView').
     *          itemAt(1).
     *          selected().
     *          and(function (item) {
     *              // item is now selected
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item} this
     * @chainable
     */

    /**
     * @method deselected
     * Waits for the item's record to be deselected
     *
     *      ST.dataView('@someDataView').
     *          itemAt(150).
     *          selected().
     *          reveal().
     *          deselected().
     *          and(function (item) {
     *              // item is now deselected
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item} this
     * @chainable
     */

    /**
     * @method select
     * Selects the item's corresonding record
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */

    /**
     * @method deselect
     * Deselects the item's corresonding record
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */

    constructor: function (config, timeout) {
        var me = this;

        ST.future.Item.superclass.constructor.call(me, null, timeout);

        ST.apply(me, config);

        me.locator = ST.play([{
            target: function () {
                var ownerCmp = me.ownerCmp || (me.ownerCmp = me._dataView.cmp),
                    rec = me.findRecord(),
                    node, idx;

                if (rec) {
                    idx = me.recordIndex = ownerCmp.getStore().indexOf(rec);

                    if (ST.isClassic) {
                        node = ownerCmp.getNode(rec);
                    } else {
                        node = ownerCmp.getItemAt(idx);

                        if (ownerCmp.getUseComponents && ownerCmp.getUseComponents()) {
                            node = node.el.dom;
                        }
                    }                    
                }

                return node;
            },

            visible: null,  // don't worry about visibility...
            animation: false, // ...or animations at this stage

            fn: function () {
                me.el = this.targetEl;  // an ST.Element (this is the Playable)

                if (me._attach) {
                    me._attach();
                }
            }
        }])[0];
    },

    /**
     * Returns the owning `ST.future.DataView`. This method can be called at any time
     * to "return" to the owning future. For example:
     *
     *      ST.dataView('@someView').
     *          item(42).           // get a future item (ST.future.Item)
     *              reveal().       //    operates on the ST.future.Item
     *          dataView().         // now back to the dataView
     *          click(10, 10);      // click on the dataView
     *
     * @return {ST.future.DataView}
     */
    dataView: function () {
        return this._dataView;
    },

    /**
     * Scrolls this item into view.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     * @chainable
     */
    reveal: function (timeout) {
        var me = this;

        ST.play([{
            timeout: timeout,

            fn: function (done) {
                var view = me.ownerCmp,
                    node = me.el.dom,
                    duration = ST.options.eventDelay,
                    anim = false,
                    isTouchScroller = false,
                    doneOnScrollEnd = false,
                    scroller;

                if (view.getScrollable) {
                    scroller = view.getScrollable();
                    isTouchScroller = scroller.isTouchScroller;
                    // 5.x+
                    if (duration) {
                        anim = {
                            duration: duration,
                            callback: function () {
                                done();
                            }
                        };
                    }

                    if (!ST.isClassic && !isTouchScroller) {
                        // need to wait for scrollend
                        scroller.on('scrollend', function() {
                            done();
                        }, view, {
                            single: true
                        });
                        // clear out anim for dom scroller
                        anim = false;
                        doneOnScrollEnd = true;
                    }

                    scroller.scrollIntoView(node, false, anim);                    
                } else {
                    // 4.x, 5.0.x

                    // need to wait for scroll
                    view.on('scroll', function () {
                        done();
                    }, view, {
                        single: true
                    });
                    
                    anim = false;
                    doneOnScrollEnd = true;

                    Ext.fly(node).scrollIntoView(view.getOverflowEl(), false);
                }

                if (!anim && !doneOnScrollEnd) {
                    done();
                }
            }
        }]);

        return me;
    },

    /**
     * @method asComponent
     * Returns an `ST.future.Component` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Component}
     */
    asComponent: function (timeout) {
        return this._asFutureComponent(ST.future.Component, timeout);
    },

    /**
     * @method asButton
     * Returns an `ST.future.Button` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Button}
     */
    asButton: function (timeout) {
        return this._asFutureComponent(ST.future.Button, timeout);
    },

    /**
     * @method asPanel
     * Returns an `ST.future.Panel` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Panel}
     */
    asPanel: function (timeout) {
        return this._asFutureComponent(ST.future.Panel, timeout);
    },

    /**
     * @method asField
     * Returns an `ST.future.Field` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Field}
     */
    asField: function (timeout) {
        return this._asFutureComponent(ST.future.Field, timeout);
    },

    /**
     * @method asTextField
     * Returns an `ST.future.TextField` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.TextField}
     */
    asTextField: function (timeout) {
        return this._asFutureComponent(ST.future.TextField, timeout);
    },

    /**
     * @method asCheckBox
     * Returns an `ST.future.CheckBox` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.CheckBox}
     */
    asCheckBox: function (timeout) {
        return this._asFutureComponent(ST.future.CheckBox, timeout);
    },

    /**
     * @method asSelect
     * Returns an `ST.future.Select` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Select}
     */
    asSelect: function (timeout) {
        return this._asFutureComponent(ST.future.Select, timeout);
    },

    /**
     * @method asDataView
     * Returns an `ST.future.DataView` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.DataView}
     */
    asDataView: function (timeout) {
        return this._asFutureComponent(ST.future.DataView, timeout);
    },

    /**
     * @method asGrid
     * Returns an `ST.future.Grid` future
     * This method is *only* applicable in conjuction with Ext JS Modern Toolkit (or Sencha Touch) when 
     * using an Ext.dataview.DataView that is configured with `useComponents:true`.
     * @chainable
     * @return {ST.future.Grid}
     */
    asGrid: function (timeout) {
        return this._asFutureComponent(ST.future.Grid, timeout);
    },

    //-------------------------------------------------------------
    // Private

    /**
     * Common endpoint for creating component futures from an item.
     * @param {Object} maker The class to use to construct the future.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Component}
     */
    _asFutureComponent: function (maker, timeout) {
        var future = this._futureCmp;

        if (!future) {
            // cache this future on the item so we don't have to keep re-creating it
            this._futureCmp = future = new maker(this.locator, timeout);

            // poke on _dataViewItem so we can return to item when needed
            future._dataViewItem = this;
        }        

        return future;
    },
    /**
     * @private
     */
    findRecord: function () {
        var me = this,
            dataView = me.ownerCmp,
            store = dataView.store || dataView.getStore(),
            index = me.at,
            id = me.itemId,
            rec = null;

        if (index != null) {
            rec = store.getAt(index);
        } else if (id != null) {
            rec = store.getById(id);
        } else {
            rec = store.findRecord(me.propertyName, me.propertyValue);
        }

        return rec;
    }
});

/**
 * This class provides methods specific to Ext JS DataView (`Ext.view.View`).
 *
 * @class ST.future.DataView
 * @extend ST.future.Component
 */
ST.future.define('DataView', {
    extend: ST.future.Component,
    mixins: [ST.future.SelectionModel],
    states: {
        /**
         * @method viewReady
         * Waits for this initial set of items to be rendered.
         *
         *      ST.dataView('@someView').
         *          viewReady().
         *          and(function (view) {
         *              // view items are now rendered
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.DataView} this
         * @chainable
         */
        viewReady: {
            is: function () {
                return ST.isClassic ? this.cmp.viewReady : this.cmp.getViewItems().length;
            },
            wait: ['viewready', 'resize']
        }
    },

    /**
     * @method selected
     * Waits for the given item records (by id) to be selected
     *
     *      ST.dataView('@someDataView').
     *          selected([1, 3]).
     *          and(function (dataView) {
     *              // 2 item records are now selected
     *          });
     *
     * @param {Number/Number[]} id The ids of the item records to select.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method selectedAt
     * Waits for the given item records (by index) to be selected
     *
     *      ST.dataView('@someDataView').
     *          selectedAt([1, 3]).
     *          and(function (dataView) {
     *              // 2 item records are now selected
     *          });
     *
     * @param {Number/Number[]} index The indexes of the item records to select.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method selectedRange
     * Waits for the given item records (by range of indexes) to be selected
     *
     *      ST.dataView('@someDataView').
     *          selectedRange(15, 45).
     *          and(function (dataView) {
     *              // range of item records are now selected
     *          });
     *
     * @param {Number} start The starting index of the item records to select.
     * @param {Number} [end] The ending index of the item records to select. 
     * If not specified, the remainder of the available records will be selected
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method selectedWith
     * Waits for the given item records (by simple query) to be selected
     *
     *      ST.dataView('@someDataView').
     *          selectedWith('name', 'Doug').
     *          and(function (dataView) {
     *              // matching item records are now selected
     *          });
     *
     * @param {String} propertyName The name of the property in the record against which to query.
     * @param {String} propertyValue The value against which to query.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method deselected
     * Waits for the given item records (by id) to be deselected
     *
     *      ST.dataView('@someDataView').
     *          ... select records ...
     *          deselected([1, 3]).
     *          and(function (dataView) {
     *              // 2 item records are now deselected
     *          });
     *
     * @param {Number/Number[]} id The ids of the item records to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method deselectedAt
     * Waits for the given item records (by index) to be deselected
     *
     *      ST.dataView('@someDataView').
     *          ... select records ...
     *          deselectedAt([1, 3]).
     *          and(function (dataView) {
     *              // 2 item records are now deselected
     *          });
     *
     * @param {Number/Number[]} index The indexes of the item records to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method deselectedRange
     * Waits for the given item records (by range of indexes) to be deselected
     *
     *      ST.dataView('@someDataView').
     *          ... select records ...
     *          deselectedRange(15, 45).
     *          and(function (dataView) {
     *              // range of item records are now deselected
     *          });
     *
     * @param {Number} start The starting index of the item records to deselect.
     * @param {Number} [end] The ending index of the item records to deselect. 
     * If not specified, the remainder of the available records will be deselected
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method deselectedWith
     * Waits for the given item records (by simple query) to be deselected
     *
     *      ST.dataView('@someDataView').
     *          ... select records ...
     *          deselectedWith('name', 'Doug').
     *          and(function (dataView) {
     *              // matching item records are now deselected
     *          });
     *
     * @param {String} propertyName The name of the property in the record against which to query.
     * @param {String} propertyValue The value against which to query.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView} this
     * @chainable
     */

    /**
     * @method select
     * Selects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method selectAt
     * Selects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method selectRange
     * Selects the requested record(s) by index range.
     * @param {Number} start The starting index for the selection.
     * @param {Number} [end] The ending index for the selection. If not specified, the full range from the starting index will be included
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method selectWith
     * Selects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method selectAll
     * Selects all available records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselect
     * Deselects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselectAt
     * Deselects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselectRange
     * Deselects the requested record(s) by index range.
     * @param {Number} start The starting index for the deselection.
     * @param {Number} [end] The ending index for the deselection. If not specified, the full range from the starting index will be included.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselectWith
     * Deselects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselect
     * Deselects all selected records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method selectBy
     * Selects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the selection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    /**
     * @method deselectBy
     * Deselects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the deselection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.DataView}
     */

    _itemCalls: 0,

    /**
     * Returns the `{@link ST.future.Item future item}` given the record's `idProperty`.
     * See {@link ST.future.Item#itemId}.
     * @param id The `idProperty` of the item's record.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */
    item: function (id, timeout) {
        return this.itemBy({
            itemId: id
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Item future item}` given the record index.
     * See {@link ST.future.Item#at}.
     * @param {Number} index The index of the item in the` component's `store`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */
    itemAt: function (index, timeout) {
        return this.itemBy({
            at: index
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Item future item}` given a config object that
     * specified the match criteria.
     * @param {Object} config Configuration options for the `ST.future.Item`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */
    itemBy: function (config, timeout) {
        // First time ensure that viewReady is scheduled
        if (!this._itemCalls++) {
            this.viewReady();
        }

        return new ST.future.Item(ST.apply({
            _dataView: this,
            _viewRoot: this
        }, config), timeout);
    },

    /**
     * Returns the `{@link ST.future.Item future item}` given the name of the property/field
     * and the match value.
     * See {@link ST.future.Item#propertyName} and {@link ST.future.Item#propertyValue}.
     * @param {String} property
     * @param {Object/RegExp} value
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     */
    itemWith: function (property, value, timeout) {
        return this.itemBy({
            propertyName: property,
            propertyValue: value
        }, timeout);
    }
});

/**
 * Returns a {@link ST.future.DataView future DataView} used to queue operations for
 * when that `Ext.view.View` becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the dataview.
 * @return {ST.future.DataView}
 * @method dataView
 * @member ST
 */

//-----------------------------------------------------------------------------
// Grid / Row / Cell

/**
 * @class ST.future.Cell
 * This class provides methods to interact with a `Grid` cell when it becomes
 * available. Instances of this class are returned by the following methods:
 *
 *  * {@link ST.future.Row#cell}
 *  * {@link ST.future.Row#cellAt}
 *  * {@link ST.future.Row#cellBy}
 *  * {@link ST.future.Row#cellWith}
 */
ST.future.define('Cell', {
    extend: ST.future.Element,
    factoryable: false,
    valueProperty: null,

    /**
     * @property {Ext.grid.Panel} ownerCmp
     * @readonly
     * The associated Ext JS Grid. This property will not be available immediately
     * and is intended for use in `{@link ST.future.Element#and and}` methods since these
     * are run after the component has been located.
     */

    /**
     * @cfg {Number} at
     * The column index in the grid's `columns`. This property is set when calling the
     * {@link ST.future.Row#cellAt} method.
     *
     * If specified the `cellId`, `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg cellId
     * The value of the `idProperty` of the row's record. This property is set when
     * calling the {@link ST.future.Grid#row} method.
     *
     * If specified the `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg {String} propertyName
     * The name of the property for which to search. The first record that matches the
     * desired `propertyValue` is used. This property is set when calling the
     * {@link ST.future.Grid#rowWith} method.
     *
     * If specified the `propertyValue` must also be specified.
     */

    /**
     * @cfg {Object/RegExp} propertyValue
     * The value that must exactly match that of the `propertyName` unless this is a
     * `RegExp`. In this case, the `test()` method is used to compare the field values.
     *  This property is set when calling the {@link ST.future.Grid#rowWith} method.
     */

    constructor: function (config, timeout) {
        var me = this;

        ST.future.Cell.superclass.constructor.call(me, null, timeout);

        ST.apply(me, config);

        me.locator = ST.play([{
            ready: function () {
                var ownerCmp = me.ownerCmp || (me.ownerCmp = me._grid.cmp),
                    index = me.findColIndex();

                if (index < 0) {
                    return false;
                }

                me.columnIndex = index;
                return true;
            },

            fn: function () {
                var el = me._grid.getCellInfo(me.columnIndex, me._row.recordIndex);

                el = el && el.cell;
                el = el && el.dom;

                me.updateEl(el);
            }
        }])[0];
    },

    /**
     * Returns the owning `ST.future.Grid`. This method can be called at any time
     * to "return" to the owning future. For example:
     *
     *      ST.grid('@someGrid').
     *          row(42).            // get a future row (ST.future.Row)
     *              cellAt(3).      // cell index 3 (0-based)
     *                  reveal().   //    operates on the ST.future.Cell
     *          grid().             // now back to the grid
     *          click(10, 10);      // click on the grid
     *
     * @return {ST.future.Grid}
     */
    grid: function () {
        return this._grid;
    },

    /**
     * Scrolls this item into view.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Item}
     * @chainable
     */
    reveal: function (timeout) {
        var me = this;

        ST.play([{
            timeout: timeout,

            fn: function (done) {
                me._grid.scrollTo(me._row.recordIndex, me.columnIndex, function (cellEl) {
                    me.updateEl(cellEl);
                    done();
                });
            }
        }]);

        return me;
    },

    /**
     * Returns the owning `ST.future.Row`. This method can be called at any time
     * to "return" to the owning row future. For example:
     *
     *      ST.grid('@someGrid').
     *          row(42).                // get a future row (ST.future.Row)
     *              cellAt(3).          // cell index 3 (0-based)
     *                  reveal().       //    operates on the ST.future.Cell
     *          row().                  // now back to the row
     *              cellAt(7).
     *                  click(10, 10);  // click on the cell index 7
     *
     * @return {ST.future.Row}
     */
    row: function () {
        return this._row;
    },

    //-------------------------------------------------------------
    // Private

    toolkitConfig: {
        classic: {
            findColIndex: function () {
                var me = this,
                    grid = me.ownerCmp,
                    index = me.at,
                    id = me.cellId,
                    propertyValue = me.propertyValue,
                    isRegex = ST.typeOf(propertyValue) === 'regexp',
                    ret = null,
                    col, columns, i, v;

                if (grid.getVisibleColumnManager) {
                    // This appeared in later 4.x
                    columns = grid.getVisibleColumnManager().getColumns();
                } else {
                    // Top level view has getGridColumns
                    columns = grid.getView().getGridColumns();
                }

                if (index != null) {  // cellAt(n)
                    if (index < 0) {
                        // map index -1 to last cell
                        index += columns.length;
                    }
                    if (0 <= index && index < columns.length) {
                        ret = index;
                    }
                } else if (id != null) {  // cell(id)
                    for (i = 0; i < columns.length; ++i) {
                        col = columns[i];

                        if (id === col.id || id === col.itemId || id === col.reference) {
                            ret = i;
                            break;
                        }
                    }
                } else {  // cellWith(prop, val)
                    for (i = 0; i < columns.length; ++i) {
                        v = columns[i][me.propertyName];

                        if (isRegex ? propertyValue.test(v) : (v === propertyValue)) {
                            ret = i;
                            break;
                        }
                    }
                }

                return ret;
            }
        },

        modern: {
            findColIndex: function () {
                var me = this,
                    grid = me.ownerCmp,
                    index = me.at,
                    id = me.cellId,
                    propertyValue = me.propertyValue,
                    isRegex = ST.typeOf(propertyValue) === 'regexp',
                    columns = grid.getHeaderContainer().getColumns(),
                    ret = null,
                    col, i, v, getter;

                if (index != null) {  // cellAt(n)
                    if (index < 0) {
                        // map index -1 to last cell
                        index += columns.length;
                    }
                    if (0 <= index && index < columns.length) {
                        ret = index;
                    }
                } else if (id != null) {  // cell(id)
                    for (i = 0; i < columns.length; ++i) {
                        col = columns[i];

                        if (id === col.id || id === col.getItemId() || id === col.getReference()) {
                            ret = i;
                            break;
                        }
                    }
                } else {  // cellWith(prop, val)
                    for (i = 0; i < columns.length; ++i) {
                        col = columns[i];
                        getter = col['get' + Ext.String.capitalize(me.propertyName)];
                        v = getter ? getter.call(col) : col[me.propertyName];

                        if (isRegex ? propertyValue.test(v) : (v === propertyValue)) {
                            ret = i;
                            break;
                        }
                    }
                }

                return ret;
            }
        }
    },

    updateEl: function (dom) {
        var me = this,
            el = me.el;

        if (!dom) {
            me.el = null;
        } else if (!el || el.dom !== dom) {
            me.el = ST.get(dom);
        }

        me.locator.targetEl = me.el;
    }
}); // Cell

/**
 * @class ST.future.Row
 * This class provides methods to interact with a `Grid` row when it becomes
 * available. Instances of this class are returned by the following methods:
 *
 *  * {@link ST.future.Grid#row}
 *  * {@link ST.future.Grid#rowAt}
 *  * {@link ST.future.Grid#rowBy}
 *  * {@link ST.future.Grid#rowWith}
 */
ST.future.define('Row', {
    extend: ST.future.Element,
    mixins: [ST.future.Selection],
    factoryable: false,
    valueProperty: null,

    /**
     * @property {Ext.grid.Panel} ownerCmp
     * @readonly
     * The associated Ext JS Grid. This property will not be available immediately
     * and is intended for use in `{@link ST.future.Element#and and}` methods since these
     * are run after the component has been located.
     */

    /**
     * @cfg {Number} at
     * The row index in the grid's `store`.
     *
     * This property is set when calling the {@link ST.future.Grid#rowAt} method.
     *
     * If specified the `rowId`, `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg rowId
     * The value of the `idProperty` of the row's record.
     *
     * This property is set when calling the {@link ST.future.Grid#row} method.
     *
     * If specified the `propertyName` and `propertyValue` configs are ignored.
     */

    /**
     * @cfg {String} propertyName
     * The name of the property for which to search. The first record that matches the
     * desired `propertyValue` is used as returned by the store's `find()` method.
     *
     * This property is set when calling the {@link ST.future.Grid#rowWith} method.
     *
     * If specified the `propertyValue` must also be specified.
     */

    /**
     * @cfg {Object/RegExp} propertyValue
     * The value that must exactly match that of the `propertyName` unless this is a
     * `RegExp`. This and the `propertyName` are passed to the store's `find()` method
     * to find the matching record.
     *
     *  This property is set when calling the {@link ST.future.Grid#rowWith} method.
     */

    /**
     * @method selected
     * Waits for the row's record to be selected
     *
     *      ST.grid('@someGrid').
     *          rowAt(1).
     *          selected().
     *          and(function (row) {
     *              // row is now selected
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row} this
     * @chainable
     */

    /**
     * @method deselected
     * Waits for the row's record to be deselected
     *
     *      ST.grid('@someGrid').
     *          rowAt(150).
     *          selected().
     *          reveal().
     *          deselected().
     *          and(function (row) {
     *              // row is now deselected
     *          });
     *
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row} this
     * @chainable
     */

    constructor: function (config, timeout) {
        var me = this;

        ST.future.Row.superclass.constructor.call(me, null, timeout);

        ST.apply(me, config);

        me.locator = ST.play([{
            ready: function () {
                var ownerCmp = me.ownerCmp || (me.ownerCmp = me._grid.cmp),
                    index = me.findRowIndex(),
                    node;

                if (index < 0) {
                    return false;
                }

                me.recordIndex = index;
                return true;
            },

            fn: function () {
                // buffered rendering means we may have a record index but no el exists
                var view = me.ownerCmp,
                    node;

                if (ST.isClassic) {
                    view = (view.normalGrid || view).view;
                    node = view.getNode(me.recordIndex);                    
                } else {
                    node = view.getItemAt(me.recordIndex);

                    if (node) {
                        node = node.el;
                    }
                }

                me.updateEl(node);
            }
        }])[0];
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given the record's `idProperty`.
     * See {@link ST.future.Row#rowId}.
     * @param id The `idProperty` of the item's record.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    cell: function (id, timeout) {
        return this.cellBy({
            cellId: id
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given the record index.
     * See {@link ST.future.Row#at}.
     * @param {Number} index The index of the item in the grid's `store`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    cellAt: function (index, timeout) {
        return this.cellBy({
            at: index
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given a config object that
     * specified the match criteria.
     * @param {Object} config Configuration options for the `ST.future.Row`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    cellBy: function (config, timeout) {
        return new ST.future.Cell(ST.apply({
            _grid: this._grid,
            _row: this
        }, config), timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given the name of the property/field
     * and the match value.
     * See {@link ST.future.Row#propertyName} and {@link ST.future.Row#propertyValue}.
     * @param {String} property
     * @param {Object/RegExp} value
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    cellWith: function (property, value, timeout) {
        return this.cellBy({
            propertyName: property,
            propertyValue: value
        }, timeout);
    },

    /**
     * Returns the owning `ST.future.Grid`. This method can be called at any time
     * to "return" to the owning future. For example:
     *
     *      ST.grid('@someGrid').
     *          row(42).            // get a future row (ST.future.Row)
     *              reveal().       //    operates on the ST.future.Row
     *          grid().             // now back to the grid
     *          click(10, 10);      // click on the grid
     *
     * @return {ST.future.Grid}
     */
    grid: function () {
        return this._grid;
    },

    /**
     * @method select
     * Selects the row's corresonding record
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */

    /**
     * @method deselect
     * Deselects the row's corresonding record
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */

    /**
     * Scrolls this row into view.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     * @chainable
     */
    reveal: function (timeout) {
        var me = this;

        ST.play([{
            timeout: timeout,

            fn: function (done) {
                me._grid.scrollTo(me.recordIndex, null, function (rowEl) {
                    me.updateEl(rowEl);
                    done();
                });
            }
        }]);

        return me;
    },

    //-------------------------------------------------------------
    // Private

    /**
     * @private
     */
    findRowIndex: function () {
        var me = this,
            grid = me.ownerCmp,
            store = grid.store || grid.getStore(),
            count = store.getCount(),
            index = me.at,
            id = me.itemId,
            ret = -1;

        if (index != null) {
            if (index < 0) {
                // map -1 to last record
                index += count;
            }
            if (0 <= index && index < count) {
                ret = index;
            }
        } else if (id != null) {
            ret = store.indexOfId(id);
        } else {
            ret = store.find(me.propertyName, me.propertyValue);
        }

        if (ret >= 0) {
            me.record = store.getAt(ret);
        }

        return ret;
    },

    updateEl: function (dom) {
        var me = this,
            el = me.el;

        if (!dom) {
            me.el = null;
        } else if (!el || el.dom !== dom) {
            me.el = ST.get(dom);
        }

        me.locator.targetEl = me.el;
    }
}); // Row

/**
 * This class provides methods specific to Ext JS Grid (`Ext.grid.Panel`, `Ext.grid.Grid`).
 *
 * @class ST.future.Grid
 * @extend ST.future.Panel
 */
ST.future.define('Grid', {
    extend: ST.future.Panel,
    mixins: [ST.future.SelectionModel],
    states: {
        /**
         * @method viewReady
         * Waits for this initial set of rows to be rendered.
         *
         *      ST.grid('@someGrid').
         *          viewReady().
         *          and(function (grid) {
         *              // grid rows are now rendered
         *          });
         *
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */
        viewReady: {
            is: function () {
                var cmp = this.cmp;
                cmp = cmp && (cmp.normalGrid || cmp);
                cmp = cmp && cmp.view;

                return ST.isClassic ? (cmp && cmp.viewReady) : this.cmp.getViewItems().length; // since at least Ext JS 4.1.1+
            },
            wait: ['viewready', 'resize']
        }

        /**
         * @method selected
         * Waits for the given row records (by id) to be selected
         *
         *      ST.grid('@someGrid').
         *          selected([1, 3]).
         *          and(function (grid) {
         *              // 2 row records are now selected
         *          });
         *
         * @param {Number/Number[]} id The ids of the row records to select.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method selectedAt
         * Waits for the given row records (by index) to be selected
         *
         *      ST.grid('@someGrid').
         *          selectedAt([1, 3]).
         *          and(function (grid) {
         *              // 2 row records are now selected
         *          });
         *
         * @param {Number/Number[]} index The indexes of the row records to select.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method selectedRange
         * Waits for the given row records (by range of indexes) to be selected
         *
         *      ST.grid('@someGrid').
         *          selectedRange(15, 45).
         *          and(function (grid) {
         *              // range of row records are now selected
         *          });
         *
         * @param {Number} start The starting index of the row records to select.
         * @param {Number} [end] The ending index of the row records to select. 
         * If not specified, the remainder of the available records will be selected
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method selectedWith
         * Waits for the given row records (by simple query) to be selected
         *
         *      ST.grid('@someGrid').
         *          selectedWith('name', 'Doug').
         *          and(function (grid) {
         *              // matching row records are now selected
         *          });
         *
         * @param {String} propertyName The name of the property in the record against which to query.
         * @param {String} propertyValue The value against which to query.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method deselected
         * Waits for the given row records (by id) to be deselected
         *
         *      ST.grid('@someGrid').
         *          ... select records ...
         *          deselected([1, 3]).
         *          and(function (grid) {
         *              // 2 row records are now deselected
         *          });
         *
         * @param {Number/Number[]} id The ids of the row records to deselect.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method deselectedAt
         * Waits for the given row records (by index) to be deselected
         *
         *      ST.grid('@someGrid').
         *          ... select records ...
         *          deselectedAt([1, 3]).
         *          and(function (grid) {
         *              // 2 row records are now deselected
         *          });
         *
         * @param {Number/Number[]} index The indexes of the row records to deselect.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method deselectedRange
         * Waits for the given row records (by range of indexes) to be deselected
         *
         *      ST.grid('@someGrid').
         *          ... select records ...
         *          deselectedRange(15, 45).
         *          and(function (grid) {
         *              // range of row records are now deselected
         *          });
         *
         * @param {Number} start The starting index of the row records to deselect.
         * @param {Number} [end] The ending index of the row records to deselect. 
         * If not specified, the remainder of the available records will be deselected
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */

        /**
         * @method deselectedWith
         * Waits for the given row records (by simple query) to be deselected
         *
         *      ST.grid('@someGrid').
         *          ... select records ...
         *          deselectedWith('name', 'Doug').
         *          and(function (grid) {
         *              // matching row records are now deselected
         *          });
         *
         * @param {String} propertyName The name of the property in the record against which to query.
         * @param {String} propertyValue The value against which to query.
         * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
         * @return {ST.future.Grid} this
         * @chainable
         */
    },

    _itemCalls: 0,

    /**
     * @method select
     * Selects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method selectAt
     * Selects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to select.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method selectRange
     * Selects the requested record(s) by index range.
     * @param {Number} start The starting index for the selection.
     * @param {Number} [end] The ending index for the selection. If not specified, the full range from the starting index will be included
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method selectWith
     * Selects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Boolean} [keepExisting] `true` to preserve existing selections (default: `false`)
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method selectAll
     * Selects all available records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselect
     * Deselects the requested record(s) given the record's `idProperty`.
     * @param {String/String[]} id The `idProperty` of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselectAt
     * Deselects the requested record(s) by index.
     * @param {String/String[]} index The index of the record(s) to deselect.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselectRange
     * Deselects the requested record(s) by index range.
     * @param {Number} start The starting index for the deselection.
     * @param {Number} [end] The ending index for the deselection. If not specified, the full range from the starting index will be included.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselectWith
     * Deselects the requested record(s) by a simple property/value query.
     * @param {String} propertyName The name of the property by which to query.
     * @param {String} value The value by which to query.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselectAll
     * Deselects all selected records
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method selectBy
     * Selects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the selection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * @method deselectBy
     * Deselects records given a config object that specified the match criteria.
     * @param {Object} config Configuration options for the deselection.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Grid}
     */

    /**
     * Returns the `{@link ST.future.Row future row}` given the record's `idProperty`.
     * See {@link ST.future.Row#rowId}.
     * @param id The `idProperty` of the item's record.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    row: function (id, timeout) {
        return this.rowBy({
            itemId: id
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given the record index.
     * See {@link ST.future.Row#at}.
     * @param {Number} index The index of the item in the grid's `store`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    rowAt: function (index, timeout) {
        return this.rowBy({
            at: index
        }, timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given a config object that
     * specified the match criteria.
     * @param {Object} config Configuration options for the `ST.future.Row`.
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    rowBy: function (config, timeout) {
        // First time ensure that viewReady is scheduled
        if (!this._itemCalls++) {
            this.viewReady();
        }

        return new ST.future.Row(ST.apply({
            _grid: this,
            _viewRoot: this
        }, config), timeout);
    },

    /**
     * Returns the `{@link ST.future.Row future row}` given the name of the property/field
     * and the match value.
     * See {@link ST.future.Row#propertyName} and {@link ST.future.Row#propertyValue}.
     * @param {String} property
     * @param {Object/RegExp} value
     * @param {Number} [timeout] The maximum time (in milliseconds) to wait.
     * @return {ST.future.Row}
     */
    rowWith: function (property, value, timeout) {
        return this.rowBy({
            propertyName: property,
            propertyValue: value
        }, timeout);
    },

    //------------------------------------

    getCellInfo: function (colIndex, row) {
        return ST.future.Grid.getCellInfo(this.cmp, colIndex, row);
    },

    scrollTo: function (rowIndex, colIndex, callback) {
        ST.future.Grid.scrollTo(this.cmp, rowIndex, colIndex, callback);
    },

    statics: {
        toolkitConfig: {
            classic: {
                getCellInfo: function (grid, colIndex, row) {
                    var cell, column, columns, context, info, view;

                    if (grid.getVisibleColumnManager) {
                        // This appeared in later 4.x
                        columns = grid.getVisibleColumnManager().getColumns();
                    } else {
                        // Top level view has getGridColumns
                        columns = grid.getView().getGridColumns();
                    }

                    column = columns[colIndex];
                    view = column.getView ? column.getView() : column.up('tablepanel').getView();

                    info = {
                        column: column,
                        view: view
                    };

                    if (row != null) {
                        if (Ext.grid.CellContext) {
                            // CellContext appeared in later 4.x
                            info.context = context = new Ext.grid.CellContext(view);
                            context.setPosition(row, column);

                            // 6+ has a getCell method
                            if (context.getCell) {
                                cell = context.getCell();
                            } else {
                                cell = view.getCellByPosition(context);
                            }

                            cell = view.getCellByPosition(context);
                        } else {
                            // Use the view
                            cell = view.getCellByPosition({
                                row: row,
                                column: colIndex
                            });
                        }

                        info.cell = cell;
                    }

                    return info;
                },
                scrollTo: function (grid, rowIndex, colIndex, callback) {
                    var view, column, viewItem, cellContext, cell, bufferedRenderer;

                    // A non-null col index was typed in. We're going to a cell
                    if (colIndex != null) {
                        if (grid.getVisibleColumnManager) {
                            // This appeared in later 4.x
                            column = grid.getVisibleColumnManager().getColumns()[colIndex];
                        } else {
                            // Top level view has getGridColumns
                            column = grid.getView().getGridColumns()[colIndex];
                        }

                        // Might be a lockable so get the view which owns the column.
                        view = column.getView ? column.getView() : column.up('tablepanel').getView();

                        // 5.1+ with ensureVisible API
                        // Use the grid that owns the column. Calling from the lockable does *two*
                        // calls, one for each side which may not be desired.
                        if (grid.ensureVisible) {
                            view.grid.ensureVisible(rowIndex, {
                                // 6.x scrolls this into view. 5.x does not use this option
                                column: column,

                                callback: function (success, record, viewItem) {
                                    // CellContext.setPosition(rec/recIdx, col/colIdx); rec,col is
                                    // best rather than indices
                                    cellContext = new Ext.grid.CellContext(column.getView());
                                    cellContext.setPosition(record, column);

                                    // 6+ has a getCell method
                                    if (cellContext.getCell) {
                                        cell = cellContext.getCell();
                                    } else {
                                        // 5.x need the view's intervention to scroll the cell
                                        // into view
                                        cell = view.getCellByPosition(cellContext);
                                    }

                                    view.getScrollable().scrollIntoView(cell);
                                    callback(cell);
                                }
                            });
                        } else { // 4.x/5.0
                            // 4.x algorithm scrolls requested record to the *top* of the grid
                            if (view.bufferedRenderer) {
                                view.bufferedRenderer.scrollTo(rowIndex, false, function (recIndex, record) {
                                    //viewItem = view.getNode(record);

                                    // CellContext appeared in later 4.x
                                    if (Ext.grid.CellContext) {
                                        cellContext = new Ext.grid.CellContext(view);
                                        cellContext.setPosition(record, column);

                                        cell = view.getCellByPosition(cellContext);
                                    } else {
                                        // Use the view
                                        cell = view.getCellByPosition({
                                            row: record,
                                            column: colIndex
                                        });
                                    }

                                    // Scroller appeared in later 4.x
                                    if (view.getScrollable) {
                                        view.getScrollable().scrollIntoView(cell);
                                    } else {
                                        Ext.fly(cell).scrollIntoView(view.getOverflowEl());
                                        //view.getOverflowEl().scrollChildIntoView(cell);
                                    }

                                    callback(cell);
                                });
                            } else {
                                // Element based scrolling scrolls target el just into view
                                viewItem = view.getNode(rowIndex);
                                Ext.fly(viewItem).scrollIntoView(view.getOverflowEl(), false);
                                //view.getOverflowEl().scrollChildIntoView(viewItem, false);

                                // CellContext appeared in later 4.x
                                if (Ext.grid.CellContext) {
                                    cellContext = new Ext.grid.CellContext(view).setPosition(rowIndex, column);
                                    cell = view.getCellByPosition(cellContext);
                                } else {
                                    // Use the view
                                    cell = view.getCellByPosition({row: rowIndex, column: colIndex});
                                }

                                // Scroller appeared in later 4.x
                                if (view.getScrollable) {
                                    view.getScrollable().scrollIntoView(cell);
                                } else {
                                    Ext.fly(cell).scrollIntoView(view.getOverflowEl());
                                    //view.getOverflowEl().scrollChildIntoView(cell);
                                }

                                callback(cell);
                            }
                        }
                    } else { // Row only
                        // 5.1+ with ensureVisible API
                        // Use the grid that owns the column. Calling from the lockable does *two*
                        // calls, one for each side which may not be desired.
                        if (grid.ensureVisible) {
                            grid.ensureVisible(rowIndex, {
                                callback: function (success, record, viewItem) {
                                    callback(viewItem);
                                }
                            });
                        } else {
                            view = grid.normalGrid || grid;
                            view = grid.view;

                            bufferedRenderer = view.bufferedRenderer || (grid.normalGrid && grid.normalGrid.bufferedRenderer);
                            // 4.x algorithm scrolls requested record to the *top* of the grid
                            if (bufferedRenderer) {
                                bufferedRenderer.scrollTo(rowIndex, false, function (recIndex, record) {
                                    var viewItem = view.getNode(record);
                                    callback(viewItem);
                                });
                            } else {
                                // Element based scrolling scrolls target el just into view
                                var viewItem = view.getNode(rowIndex);

                                Ext.fly(viewItem).scrollIntoView(view.getOverflowEl(), false);
                                //view.getOverflowEl().scrollChildIntoView(viewItem, false);

                                callback(viewItem);
                            }
                        }
                    }
                }
            },
            modern: {
                getCellInfo: function (grid, colIndex, row) {
                    var cell, column, columns, context, info;

                    columns = grid.getColumns();

                    column = columns[colIndex];

                    info = {
                        column: column,
                        view: grid,
                        cell: false
                    };

                    if (row = grid.getItemAt(row)) {
                        info.cell = row.cells[colIndex].el;
                    }

                    return info;
                },

                scrollTo: function (grid, rowIndex, colIndex, callback) {
                    var me = this,
                        scroller = grid.getScrollable(),
                        record = grid.getStore().getAt(rowIndex),
                        row = grid.getItem(record),
                        scrollCell = colIndex !== null,
                        cell, cellReady, rowReady;

                    cellReady = function (cell) {
                        scroller.on('scrollend', function () {
                            callback(cell);
                        }, me, {
                            single: true
                        });
                        // scroll the cell into view, and make sure to allow horizontal scrolling!!!
                        scroller.scrollIntoView(cell, true, false);
                    }

                    rowReady = function (row) {
                        if (scrollCell) {
                            cell = row.cells[colIndex].el;
                            // if the cell isn't in view, we need to scroll it before anything else can occur
                            if (!scroller.isInView(cell).x) {
                                cellReady(cell);
                            } else {
                                callback(cell);
                            }          
                        } else { // scrolling a row
                            callback(row.el);
                        }
                    }
                    // if row is in view, we know that both the row and cell are available, 
                    // there's no need to scroll and we can execute the callback immediately
                    if (row && scroller.isInView(row.el).y) {
                        rowReady(row);  
                    } 
                    // if row isn't in view, we need to wait for scrollend to fire
                    else {
                        scroller.on('scrollend', function() {
                            rowReady(grid.getItem(record));
                        }, me, {
                            single: true
                        });
                        // will scroll record into view
                        grid.scrollToRecord(record, false, true);
                    }            
                }
            }
        }
    }
}); // Ext.future.Grid

/**
 * Returns a {@link ST.future.Grid future Grid} used to queue operations for
 * when that `Ext.grid.Panel` becomes available.
 * @param {String} locator See {@link ST.Locator} for supported syntax.
 * @param {Number} [timeout] The maximum time (in milliseconds) to wait for the dataview.
 * @return {ST.future.Grid}
 * @method grid
 * @member ST
 */

ST.future.resolveToolkitMethods = function () {
    var target = ST.isClassic ? 'classic' : (ST.isTouch ? 'touch' : 'modern'),
        classes = ST.future.classes,
        len = classes.length,
        owner, i, cls, proto, config, targetConfig, name;

    for (i=0; i<len; i++) {
        config = null;
        owner = null;
        cls = classes[i];
        proto = cls.prototype;

        if (cls.toolkitConfig) {
            owner = cls;
            config = cls.toolkitConfig;
        }

        if (proto.toolkitConfig) {
            owner = proto;
            config = proto.toolkitConfig;
        }
        // we found the config
        if (config) {
            // retrieve the items we want to apply by target (e.g., 'classic', 'modern', 'touch')
            targetConfig = config[target];
            // if touch doesn't have an object defined, use modern
            if (!targetConfig && target==='touch') {
                targetConfig = config['modern'];
            }
            // sanity check
            if (typeof targetConfig === 'object') {
                // we got our object of items to apply; loop over it and apply away
                for (name in targetConfig) {
                    owner[name] = targetConfig[name];
                }
            }
            // we're done, let's cleanup
            delete owner.toolkitConfig;
        }
    }
};

// add callback to ST.ready.on to run any logic needed before everything else gets going
ST.ready.on(ST.future.resolveToolkitMethods);