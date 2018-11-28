//import {NetatmoCredentialSettings} from './convenience';
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
        log('creating Netatmo');
        //this._settings = Convenience.getSettings(Me.path, Me.metadata.id);
        //log("settings : " + this._settings.get_string('netatmo-username'));
        this._settings = new Convenience.NetatmoCredentialSettings(Me.path);
        log(`Settings, username: ${this._settings.username}`);
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
        log(request.response_body.data);
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
        log('refreshing token');
        let authUrl = 'https://api.netatmo.com/oauth2/token';
        let params = {
            grant_type: "refresh_token",
            client_id: "53aaf27e1d77598a6755efec",
            client_secret: "0tTYiPL1rpjXGuec3pIb0GXBP",
            refresh_token: this._refresh_token,
        };
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST',authUrl);
        log(JSON.stringify(params));
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded',2,encodedParams);
        session.queue_message(request,() => {this._parseData(request);});
    }
    _parseData(request){
        log("Debut du callback connect");
        if (request.status_code !== 200){
            log("Bad return " + request.status_code);
        }
        //log(request.response_body.data);
        let connect_data = JSON.parse(request.response_body.data);
        this._access_token = connect_data.access_token;
        this._refresh_token = connect_data.refresh_token;
        this._expires_in = connect_data.expires_in;
        this._display.getNetatmoData();
        log("Fin du callback connect");
    }
    get token() {
        log('getting Token');
        return this._access_token;
    }
    set token(tok) {
        log('setting token from external');
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
        /*
        let session = Soup.Session.new();
        let request = Soup.Message.new('POST',url);
        log(JSON.stringify(params));
        let encodedParams = Soup.form_encode_hash(params);
        request.set_request('application/x-www-form-urlencoded',2,encodedParams);
        session.queue_message(request,() => {this._parseData(request);});
        */
        this.refresh();
    }
    refresh(){
        if (!this._naConnect.token){
            log('No token!');
            return;
        }
        this._menuButton._updateButtonText();
        let refreshTime = 300; // in seconds
        if (this._timeout) {
            Mainloop.source_remove(this._timeout);
            this._timeout = null;
        }
        this._timeout = Mainloop.timeout_add_seconds(refreshTime, this.refresh.bind(this));
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
        log("Debut du Callback data");
        if (request.status_code !== 200){
            if (request.status_code === 403){
                // Token has expired, possible after some network failure or on suspended computer
                this._naConnect.token = null;
            }
            log("Bad return " + request.status_code);
            log(JSON.parse(request.response_body.data).error.message);
            return;
        }
        log('return code: ' + request.status_code);
        this.na = JSON.parse(request.response_body.data);
        log(request.response_body.data);
        log(this.na);
        //this.tempExt = this.na.body.devices[0].modules[0].dashboard_data.Temperature;
        log(this.tempExt + '°C');
        this._menuButton.refresh();
        log("Fin du callback data");
    }
    get tempExt () {
        return this.na.body.devices[0].modules[0].dashboard_data.Temperature;
    }

}

class NetatmoStationMenuButton extends PanelMenu.Button {
    constructor() {
        super(0.0, "Netatmo indicator");
        log("Menu button init");
        this._button = new St.Bin({ style_class:'panel-button',
                                    reactive: true,
                                    can_focus: true,
                                    x_fill: true,
                                    y_fill: false,
                                    track_hover: true });
        this._buttonText = new St.Label({ text: '_°C',
                                            style_class: 'temp-text'});
        log('Will set button child');        
        this._button.set_child(this._buttonText);
        log('Connecting button');
        //this._button.connect('button-press-event', () => { this._updateButtonText()});
        //this._button.connect('button-press-event', this._updateButtonText.bind(this));
        this._button.connect('button-press-event', this.getNetatmoData.bind(this));
        log('Display button');
        this.actor.add_child(this._button);
        log('Menu button should be visible now');
        this.naConnect = new NetatmoConnect(this);
        this.naData = null;
        //this._getNetatmoData();
        //this.naData = new NetatmoStationData(this.naConnect);
        log('Final: ' + this.naConnect.token);
    }
    getNetatmoData() {
        this._buttonText.set_text('_°C');
        log('Refreshing Netatmo data');
        //log(this.naConnect);
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
        log('updating text button'+this);
        this._buttonText.set_text(this.naData.tempExt + '°C');
    }
    _updateButtonText() {
        log('updating text button'+this);
        this._buttonText.set_text('_°C');
    }

};

let netatmoStationMenu;
let netatmoConfig;

function init() {
    log('init');
}

function enable() {
    //Main.panel._rightBox.insert_child_at_index(button, 0);
    log('Enable the Netatmo extension');
    if (!netatmoStationMenu){
        netatmoStationMenu = new NetatmoStationMenuButton();
        log('will insert in the panel');
        //Main.panel._rightBox.insert_child_at_index(netatmoStationMenu, 1);
        Main.panel.addToStatusArea('netatmoStationMenu', netatmoStationMenu,1,'right');
        log('inserted in the panel');
    } else {
        log('Already inserted');
    }
}

function disable() {
    log('disable');
    netatmoStationMenu.stop();
}

