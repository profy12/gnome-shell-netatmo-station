const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;


var NetatmoStationSettingsWidget = GObject.registerClass({
	GtypeName: 'netatmosetting'
}, class NetatmoStationSettingsWidget extends Gtk.Box {
    _init(params){
        super._init(params);
        this._settingsConnect = new Convenience.NetatmoCredentialSettings(Me.path);
        this._settingsStation = new Convenience.NetatmoStationSettings(Me.path);
        let uiFilePath = Me.path + "/preferences.glade";
        let builder = new Gtk.Builder();
        if (builder.add_from_file(uiFilePath) == 0) {
            log('Could not load load the preference gui file %s'.format(uiFilePath));
            let label = new Gtk.Label({
                label: 'Could not load the preferences UI file',
                vexpand: true
            });
            this.prepend(label, true, true, 0);
        } else {
            let mainWindows = builder.get_object('netatmo-main-settings');
            let netatmoUsername = builder.get_object('netatmo-username');
            let netatmoPassword = builder.get_object('netatmo-password');
            let netatmoDisplayTempExt = builder.get_object('netatmo-display-temp-ext');
            let netatmoDisplayTempInt = builder.get_object('netatmo-display-temp-int');
            let netatmoDisplayCO2 = builder.get_object('netatmo-display-co2');
            netatmoUsername.text = this._settingsConnect.username;
            netatmoPassword.text = '****************';
            netatmoDisplayTempExt.active = this._settingsStation.displayTempExt;
            netatmoDisplayTempInt.active = this._settingsStation.displayTempInt;
            netatmoDisplayCO2.active = this._settingsStation.displayCO2;
            netatmoUsername.connect('changed',()=>{this._settingsConnect.username = netatmoUsername.text});
            netatmoPassword.connect('changed',()=>{this._settingsConnect.password = netatmoPassword.text});
            netatmoDisplayTempExt.connect('state-set',()=>{this._settingsStation.displayTempExt = netatmoDisplayTempExt.active});
            netatmoDisplayTempInt.connect('state-set',()=>{this._settingsStation.displayTempInt = netatmoDisplayTempInt.active});
            netatmoDisplayCO2.connect('state-set',()=>{this._settingsStation.displayCO2 = netatmoDisplayCO2.active});
            this.prepend(mainWindows, true, true, 0);
        }
    }
}
);

function init(){
    log('Load Netatmo preference');
}

function buildPrefsWidget () {
    let widget = new NetatmoStationSettingsWidget();
    //widget.show_all();
    return widget;
}
