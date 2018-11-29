const Clutter       = imports.gi.Clutter;
const Gio           = imports.gi.Gio;
const Mainloop      = imports.mainloop;
const Meta          = imports.gi.Meta;
const Shell         = imports.gi.Shell;
const St            = imports.gi.St;
const PolicyType    = imports.gi.Gtk.PolicyType;
const Util          = imports.misc.util;
const MessageTray   = imports.ui.messageTray;
const Soup          = imports.gi.Soup;
const Main          = imports.ui.main;
const PanelMenu     = imports.ui.panelMenu;
const PopupMenu     = imports.ui.popupMenu;
const CheckBox      = imports.ui.checkBox.CheckBox;
const Tweener = imports.ui.tweener;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

class NetatmoConnect {
    constructor (display) {
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
    _initToken(){
        let refreshTime = 15; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this._initToken.bind(this));
        if (this.token){
            //log("Token already here");
            return;
        }
        if (this._settings.password === 'undefined' || this._settings.password === '****************'){
            log('password not setted, skipping');
            return;
        }
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST',this._authUrl);
        let encodedParams = Soup.form_encode_hash(this._params);
        request.set_request('application/x-www-form-urlencoded',2,encodedParams);
        session.queue_message(request,() => {this._parseData(request);});
    }
    _refresh(){
        let refreshTime = 3600; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this._refresh.bind(this));
        if (!this.token){
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
        let request = Soup.Message.new('POST',authUrl);
        //log(JSON.stringify(params));
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded',2,encodedParams);
        session.queue_message(request,() => {this._parseData(request);});
    }
    destroy(){
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }
    _parseData(request){
        if (request.status_code !== 200){
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
    constructor(naConnect,menuButton){
        this._settings = new Convenience.NetatmoStationSettings(Me.path);
        this._menuButton = menuButton;
        this._naConnect = naConnect;
        this._token = naConnect.token;
        this._device_id = this._settings.deviceId;
        this._url = `https://api.netatmo.com/api/getstationsdata`;
        log("Token naconnect: " + naConnect.token);
        this.na = null;
        this.refresh();
    }
    destroy(){
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
    }
    refresh(){
        this._menuButton._updateButtonText();
        let refreshTime = 300; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this.refresh.bind(this));
        if (!this._naConnect.token){
            log('No token!');
            return;
        }
        let params = {
            access_token: this._naConnect.token,
            device_id: this._device_id
        };
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST',this._url);
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded',2,encodedParams);
        session.queue_message(request,() => {this._parseData(request);});
    }
    _parseData(request){
        if (request.status_code !== 200){
            if (request.status_code === 403){
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
    get tempExt () {
        return this.na.body.devices[0].modules[0].dashboard_data.Temperature;
    }

}

class NetatmoStationMenuButton extends PanelMenu.Button {
    constructor() {
        super(0.0, "Netatmo indicator");
        this._button = new St.Bin({ style_class:'panel-button',
                                    reactive: true,
                                    can_focus: true,
                                    x_fill: true,
                                    y_fill: false,
                                    track_hover: true });
        this._buttonText = new St.Label({ text: '_°C',
                                            style_class: 'temp-text'});
        this._button.set_child(this._buttonText);
        this._button.connect('button-press-event', this.getNetatmoData.bind(this));
        this.actor.add_child(this._button);
        this.naConnect = new NetatmoConnect(this);
        this.naData = null;
        //log('Final: ' + this.naConnect.token);
    }
    getNetatmoData() {
        this._buttonText.set_text('_°C');
        log('Refreshing Netatmo data');
        if (!this.naConnect){
            log("token not ready");
            return;
        }
        if (!this.naData){
            this.naData = new NetatmoStationData(this.naConnect,this);
        } else {
            this.naData.refresh();
        }
    }
    refresh() {
        this._buttonText.set_text(this.naData.tempExt + '°C');
    }
    _updateButtonText() {
        this._buttonText.set_text('_°C');
    }
    stop() {
        this.naConnect.destroy();
        this.naData.destroy();
    }

};

let netatmoStationMenu;
let netatmoConfig;

function init() {
    log('init');
}

function enable() {
    log('Enable the Netatmo extension');
    if (!netatmoStationMenu){
        netatmoStationMenu = new NetatmoStationMenuButton();
        Main.panel.addToStatusArea('netatmoStationMenu', netatmoStationMenu,1,'right');
    } else {
        log('Already inserted');
    }
}

function disable() {
    log('Disable netatmo extension');
    netatmoStationMenu.stop();
    netatmoStationMenu.destroy();
    netatmoStationMenu=null;
}

