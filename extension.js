const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const PolicyType = imports.gi.Gtk.PolicyType;
const Util = imports.misc.util;
const MessageTray = imports.ui.messageTray;
const Soup = imports.gi.Soup;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const CheckBox = imports.ui.checkBox.CheckBox;
const Tweener = imports.tweener.tweener;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

class NetatmoConnect {
    constructor(display) {
        this._settings = new Convenience.NetatmoCredentialSettings(Me.path);
        this._display = display;
        this._authUrl = 'https://api.netatmo.com/oauth2/token';
        this._params = {
            grant_type: "password",
            client_id: "53aaf27e1d77598a6755efec",
            client_secret: "0tTYiPL1rpjXGuec3pIb0GXBP",
            username: this._settings.username,
            password: this._settings.password,
            scope: "read_station"
        };
        this._access_token = null;
        this._refresh_token = null;
        this._expires_in = null;
        this._initToken();
        this._timeout = Mainloop.timeout_add_seconds(20, this._refresh.bind(this));
    }
    _initToken() {
        let refreshTime = 15; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this._initToken.bind(this));
        if (this.token) {
            //log("Token already here");
            return;
        }
        if (this._settings.password === 'undefined' || this._settings.password === '****************') {
            log('password not setted, skipping');
            return;
        }
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST', this._authUrl);
        let encodedParams = Soup.form_encode_hash(this._params);
        request.set_request('application/x-www-form-urlencoded', 2, encodedParams);
        session.queue_message(request, () => {
            this._parseData(request);
        });
    }
    _refresh() {
        let refreshTime = 3600; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this._refresh.bind(this));
        if (!this.token) {
            log("No token, will refresh later");
            return;
        }
        let authUrl = 'https://api.netatmo.com/oauth2/token';
        let params = {
            grant_type: "refresh_token",
            client_id: "53aaf27e1d77598a6755efec",
            client_secret: "0tTYiPL1rpjXGuec3pIb0GXBP",
            refresh_token: this._refresh_token,
        };
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST', authUrl);
        //log(JSON.stringify(params));
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded', 2, encodedParams);
        session.queue_message(request, () => {
            this._parseData(request);
        });
    }
    destroy() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }
    _parseData(request) {
        if (request.status_code !== 200) {
            log("Bad return " + request.status_code);
        }
        //log(request.response_body.data);
        let connect_data = JSON.parse(request.response_body.data);
        this._access_token = connect_data.access_token;
        this._refresh_token = connect_data.refresh_token;
        this._expires_in = connect_data.expires_in;
        this._display.getNetatmoData();
    }
    get token() {
        return this._access_token;
    }
    set token(tok) {
        this._access_token = tok;
    }

}
class NetatmoStationData {
    constructor(naConnect, menuButton) {
        this._settings = new Convenience.NetatmoStationSettings(Me.path);
        this._menuButton = menuButton;
        this._naConnect = naConnect;
        this._token = naConnect.token;
        //this._device_id = this._settings.deviceId;
        this._url = `https://api.netatmo.com/api/getstationsdata`;
        //log("Token naconnect: " + naConnect.token);
        this.na = null;
        this.refresh();
    }
    destroy() {
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }
    refresh() {
        this._menuButton._updateButtonText();
        let refreshTime = 300; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this.refresh.bind(this));
        if (!this._naConnect.token) {
            log('No token!');
            return;
        }
        let params = {
            access_token: this._naConnect.token
                //device_id: this._device_id
        };
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST', this._url);
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded', 2, encodedParams);
        session.queue_message(request, () => {
            this._parseData(request);
        });
    }
    _parseData(request) {
        if (request.status_code !== 200) {
            if (request.status_code === 403) {
                // Token has expired, possible after some network failure or on suspended computer
                this._naConnect.token = null;
            }
            log("Bad return " + request.status_code);
            log(JSON.parse(request.response_body.data).error.message);
            return;
        }
        this.na = JSON.parse(request.response_body.data);
        //log(request.response_body.data);
        this._menuButton.refresh();
    }
    get devices() {
        return this.na.body.devices;
    }
    get userPreferences() {
        return this.na.body.user.administrative;
    }
    get tempExt() {
        const data = this.na.body.devices[0].modules[0].dashboard_data;
        return data && data.Temperature || 'n/a';
    }
    get tempInt() {
        return this.na.body.devices[0].dashboard_data.Temperature;
    }
    get CO2() {
        return this.na.body.devices[0].dashboard_data.CO2;
    }
    get timeInt() {
        let date = new Date(this.na.body.devices[0].dashboard_data.time_utc * 1000);
        return date.toLocaleTimeString();
    }
    get timeExt() {
        const data = this.na.body.devices[0].modules[0].dashboard_data;
        if (data) {
            let date = new Date(this.na.body.devices[0].dashboard_data.time_utc * 1000);
            return date.toLocaleTimeString();
        }
        return 'n/a';
    }
}

/**
 * Convert a value to a human readable string.
 * 
 * @param {string} type type of the data
 * @param {string} dashboard_data
 * @param {user.administrative} userPrefs user prefs}
 * 
 * @returns human readable value
 */
function formatValue(type, dashboard_data, userPrefs) {
    const value = dashboard_data[type];
    return formatVal(type, value, userPrefs)
}

/**
 * a data type is related to many item in dashboard_data.
 * This function returns all measrures related to a given type.
 * It also returns some info to display them well (label, extra measure to add on the same line)
 * 
 * @param {'Temperature' | 'Pressure' | 'Raine' | 'Wind' } type kind of measure
 * @returns {Array} list of object = {name: dashbord_data key, label: text to display right before the value, extra: another dashboard_data key}
 */
function getRelatedMeasures(type) {
    switch (type) {
        case 'Temperature':
            return [
                {name: 'Temperature', label: 'Temperature: ', extra: [
                    {name: 'temp_trend', label : ' '},
                    {name: 'max_temp', label: '⭱ '},
                    {name: 'min_temp', label: '⭳ '}
                ]},
                //{name: 'max_temp', label: '↥ ', extra: 'date_max_temp'},
                //{name: 'min_temp', label: '↧ ', extra: 'date_min_temp'}
            ];
        case 'Pressure':
            return [
                {name: 'Pressure', label: 'Pressure: ', extra: [{name: 'pressure_trend'}]},
                //{name: 'AbsolutePressure', label: 'abs: '}
            ];
        case 'Rain':
            return [
                {name: 'Rain', label: 'Rain: ', extra: [
                    {name: 'sum_rain_1', label: 'last hour/day: '}, 
                    {name: 'sum_rain_24'}]
                }
            ];
        case 'Wind':
            return [
                {name: 'WindStrength', label: 'Wind: ', extra: [{name: 'WindAngle'}]},
                {name: 'max_wind_str', label: 'max: ', extra: [{name: 'max_wind_angle'}]},
                {name: 'GustStrength', label: 'Gust: ', extra: [{name: 'GustAngle'}]}
            ];
        default:
            return [{name: type, label: type + ': '}];
    }
}

/**
 * format value, according to its type and user preferences
 * @param {string} type key of the measure in dashboard_data
 * @param {any} value vale value
 * @param {{unit: string, pressureUnit: string, }} userPrefs
 * @returns {Array|String}
 */
function formatVal(type, value, userPrefs) {
    switch (type) {
        case 'Temperature':
        case 'min_temp':
        case 'max_temp':
            if (userPrefs.unit === 0) {
                return value + ' °C';
            } else if (userPrefs.unit === 0) {
                return value + ' °F';
            } else {
                return value + ' [?]';
            }
        case 'CO2':
            return value + ' ppm';
        case 'Humidity':
            return value + ' %';
        case 'Noise':
            return value + ' db';
        case 'Pressure':
        case 'AbsolutePressure':
        switch (userPrefs.pressureunit) {
            case 0:
                return value + ' mbar';
            case 1:
                return value + ' inHg';
            case 2:
                return value + ' mmHg';
            default:
                return value + ' [?]';
        }
        case 'date_min_temp':
        case 'date_max_temp':
        case 'time_utc':
        case 'date_max_wind_str':
            return new Date(value * 1000).toLocaleTimeString();
        case 'temp_trend':
        case 'pressure_trend':
        switch (value) {
            case 'stable':
                return '→';
            case 'up':
                return '↗';
            case 'down':
                return '↘';
            default:
                return value + ' [?]';
        }
        case 'Rain':
        case 'sum_rain_24':
        case 'sum_rain_1':
            if (userPrefs.unit === 0) {
                return value + ' mm';
            } else if (userPrefs.unit === 0) {
                return value + ' inch';
            } else {
                return value + ' [?]';
            }
        case 'WindStrength':
        case 'GustStrength':
        case 'max_wind_str':
        switch (userPrefs.windunit) {
            case 0:
                return value + ' kph';
            case 1:
                return value + ' mph';
            case 2:
                return value + ' ms';
            case 3:
                return value + ' beaufort';
            case 4:
                return value + ' knot';
            default:
                return value + ' [?]';

        }
        case 'WindAngle':
        case 'GustAngle':
        case 'max_wind_angle':
            return [
                'N', 'NNE', 'NE', 'ENE',
                'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW',
                'W', 'WNW', 'NW', 'NNW',
                'N'
            ][
                Math.round(value / 22.5)
            ];
    }
}

let NetatmoStationMenuButton = GObject.registerClass(
    class NetatmoStationMenuButton extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Netatmo indicator'));
        this._settings = new Convenience.NetatmoStationSettings(Me.path);
        this.naData = null;
        this._menuLayout = {};
        /*
         * Display menu bar items
         */
        this._box = new St.BoxLayout();
        this._tempExtText = new St.Label({text: '_°C',
            style_class: 'panel-menu-data'});
        this._tempIntText = new St.Label({text: '_°C',
            style_class: 'panel-menu-data'});
        this._tempExtText = new St.Label({text: '_°C',
            style_class: 'panel-menu-data'});
        this._tempIntText = new St.Label({text: '_°C',
            style_class: 'panel-menu-data'});
        this._CO2Text = new St.Label({text: '_ ppm',
            style_class: 'panel-menu-data'});
        let i = 0;
        if (this._settings.displayTempExt) {
            i++;
            this._box.add(this._tempExtText)
        }
        ;
        if (this._settings.displayTempInt) {
            i++;
            this._box.add(this._tempIntText)
        }
        ;
        if (this._settings.displayCO2) {
            i++;
            this._box.add(this._CO2Text)
        }
        ;
        if (i === 0) {
            this._box.add(this._tempExtText)
        }
        ;
        this._box.add(PopupMenu.arrowIcon(St.Side.BOTTOM));
        this.actor.add_child(this._box);
        this.naConnect = new NetatmoConnect(this);
        //log('Final: ' + this.naConnect.token);
    }
    getNetatmoData() {
        this._tempExtText.set_text('_°C');
        log('Refreshing Netatmo data');
        if (!this.naConnect) {
            log('token not ready');
            return;
        }
        if (!this.naData) {
            this.naData = new NetatmoStationData(this.naConnect, this);
        } else {
            this.naData.refresh();
        }
    }

    /**
     * 
     * @param {object} layout {data_type:{}, dashboard_data}
     * @param {object} data
     * @param {string} title section title
     * @param {type} prefs
     * @returns {undefined}
     */
    refreshMeasures(layout, data, title, prefs) {
        //log(JSON.stringify(data));
        layout.title.title.set_text(title);

        if (data.reachable) {
            layout.title.date.set_text(formatValue('time_utc', data.dashboard_data, prefs));
            layout.title.icon.icon_name = this.getBatteryIconName(data);
            layout.title.rfIcon.icon_name = this.getRfIconName(data);

            const mLayout = layout.measures;
            for (const measureType of data.data_type) {
                // A kind of measurs is related to nany effective ones in the dashboard data
                // e.g Temperature means Temperature, temp_trend, min_temp, max_temp, etc
                const relatedMeasures = getRelatedMeasures(measureType);
                let first = true;

                for (let relatedMeasure of relatedMeasures) {
                    if (typeof relatedMeasure === 'string') {
                        relatedMeasure = {
                            name: relatedMeasure
                        }
                    }
                    const type = relatedMeasure.name;
                    // Build text to display := label + measure value + extra 
                    const text = (relatedMeasure.label || type)
                        + formatValue(type, data.dashboard_data, prefs)
                        + (relatedMeasure.extra ? 
                            ' (' + relatedMeasure.extra.map(extra => 
                                (extra.label || '') + formatValue(extra.name, data.dashboard_data, prefs)
                            ).join(", ") + ')'
                            : '');

                    if (mLayout[type]) {
                        // update existing menu item
                        mLayout[type].label.set_text(text);
                    } else {
                        // create new menu item
                        mLayout[type] = new PopupMenu.PopupMenuItem(text);

                        /**
                         * As submenu item
                         */
                        //layout.menuItem.menu.addMenuItem(mLayout[type]);

                        /**
                         * no sub menus
                         */
                        this.menu.addMenuItem(mLayout[type]);
                    }

                    //mLayout[type].setOrnament(first ? 0 : 1);

                    mLayout[type].style_class = 'popup-menu-item ' + (first ?
                        'popup-netatmo-item' :
                        'popup-netatmo-subitem');

                    first = false;
                }
            }
        } else {
            layout.title.date.set_text('n/a');
            layout.title.icon.icon_name = 'battery-missing-symbolic';
            layout.title.rfIcon.icon_name = this.getRfIconName(data);
        }
    }

    buildNewLayout(title, type) {
        const layout = {
            menuItem: new PopupMenu.PopupBaseMenuItem({
                style_class: 'popup-menu-item popup-netatmo-' + type
            }),
            title: {
                box: new St.BoxLayout({
                }),
                title: new St.Label({
                    text: title,
                    style_class: 'popup-netatmo-title'
                }),
                date: new St.Label({
                    text: 'n/a',
                    style_class: 'popup-netatmo-title-date'
                }),
                icon: new St.Icon({
                    icon_name: 'battery-missing-symbolic',
                    style_class: 'popup-netatmo-title-icon',
                    icon_size: '16'
                }),
                rfIcon: new St.Icon({
                    icon_name: 'network-cellular-signal-none-symbolic',
                    style_class: 'popup-netatmo-title-icon',
                    icon_size: '16'
                })
            },
            measures: {
            }
        };
        // setup device title
        layout.title.box.add(layout.title.title);
        if (type === 'module') {
            layout.title.box.add(layout.title.date);
            layout.title.box.add(layout.title.icon);
            layout.title.box.add(layout.title.rfIcon);
        }
        layout.menuItem.add(layout.title.box);
        this.menu.addMenuItem(layout.menuItem);

        return layout;
    }

    getRfIconName(data) {
        let icons;
        let offlineIcon;
        let value;
        let min;
        let max;

        if (data.type === 'NAMain') {
            //Main Station shows wifi status
            value = data.wifi_status;
            /*
             * "wifi_status": {
             *   "type": "number",
             *   "example": 55,
             *   "description": "wifi status per Base station. (86=bad, 56=good)"
             }*/

            min = 56; // good
            max = 86; // bad
            icons = [
                'network-wireless-signal-excellent-symbolic',
                'network-wireless-signal-good-symbolic',
                'network-wireless-signal-ok-symbolic',
                'network-wireless-signal-weak-symbolic'
            ];
            offlineIcon = 'network-wireless-signal-none-symbolic';
        } else {
            // Modules shoes radio status
            /*
             "rf_status": {
             "  type": "number",
             "  example": 31,
             "  description": "Current radio status per module. (90=low, 60=highest)"
             },
             */
            value = data.rf_status;
            min = 60; // highest
            max = 90; // low

            icons = [
                'network-cellular-signal-excellent-symbolic',
                'network-cellular-signal-good-symbolic',
                'network-cellular-signal-ok-symbolic',
                'network-cellular-signal-weak-symbolic'
            ];
            offlineIcon = 'network-cellular-signal-none-symbolic';
        }

        max -= min;
        value -= min;
        value += 3; // arbitrary delta

        min = 0;
        if (!data.reachable) {
            return offlineIcon;
        } else {
            const width = max / icons.length;

            const index =
                Math.max(
                    0,
                    Math.min(
                        icons.length - 1,
                        Math.floor(value / width)
                        )
                    );
            return icons[index ];
        }
    }

    getBatteryIconName(data) {
        if (data.type === 'NAMain') {
            // Station / main module is always plugged
            return `battery-full-charging-symbolic`;
        } else if (data.battery_percent) {
            // convert percent to 0, 10, 20, ..., 100
            return `battery-level-${Math.floor(data.battery_percent / 10) * 10}-symbolic`;
        } else {
            return `battery-level-0-symbolic`;
        }
    }

    refresh() {
        const devices = this.naData.devices;
        const prefs = this.naData.userPreferences;
        for (const device of devices) {
            const dId = device._id;
            let dLayout = this._menuLayout[dId];
            if (!dLayout) {
                // device does not have any layout yet, create it
                dLayout = this._menuLayout[dId] = this.buildNewLayout(device.station_name || device.type, 'device');
                dLayout.mainModule = this.buildNewLayout(device.module_name || device.type, 'module');
                // add entry for station modules
                dLayout.modules = [];
            }

            // refresh main modules measures
            this.refreshMeasures(dLayout.mainModule, device, device.module_name, prefs);
            // refresh addotional modules
            for (const module of device.modules) {
                const mId = module._id;
                let mLayout = dLayout.modules[mId];
                if (!mLayout) {

                    /* adding a seperator take a lot of spaces */
                    //this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

                    mLayout = dLayout.modules[mId] = this.buildNewLayout(module.module_name || module.type, 'module');
                }

                this.refreshMeasures(mLayout, module, module.module_name, prefs);
            }
        }

        // toolbar button
        this._tempExtText.set_text('Out: ' + this.naData.tempExt + '°C');
        this._tempIntText.set_text('In: ' + this.naData.tempInt + '°C');
        this._CO2Text.set_text(this.naData.CO2 + 'ppm');
    }
    _updateButtonText() {
        this._tempExtText.set_text('_°C ');
        this._tempIntText.set_text('_°C ');
        this._CO2Text.set_text('_°C ');
    }
    stop() {
        this.naConnect.destroy();
        this.naData.destroy();
    }
});

let netatmoStationMenu;
let netatmoConfig;

function init() {
    log('init');
}

function enable() {
    log('Enable the Netatmo extension');
    if (!netatmoStationMenu) {
        netatmoStationMenu = new NetatmoStationMenuButton();
        Main.panel.addToStatusArea('netatmoStationMenu', netatmoStationMenu, 1, 'right');
    } else {
        log('Already inserted');
    }
}

function disable() {
    log('Disable netatmo extension');
    netatmoStationMenu.stop();
    netatmoStationMenu.destroy();
    netatmoStationMenu = null;
}

