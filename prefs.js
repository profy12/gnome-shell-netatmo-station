const Gtk = imports.gi.Gtk;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
//const Convenience = Me.imports.convenience;

class NetatmoStationSettingsWidget extends Gtk.Box {
    constructor(params){
        super(params);
        log('hopppppppppppppp');
        this._settingsConnect = new Convenience.NetatmoCredentialSettings(Me.path);
        this._settingsStation = new Convenience.NetatmoStationSettings(Me.path);
        log('loading preferences');
        let uiFilePath = Me.path + "/preferences.glade";
        let builder = new Gtk.Builder();
        if (builder.add_from_file(uiFilePath) == 0) {
            log('Could not load load the preference gui file %s'.format(uiFilePath));
            let label = new Gtk.Label({
                label: 'Could not load the preferences UI file',
                vexpand: true
            });
            this.pack_start(label, true, true, 0);
        } else {
            let mainWindows = builder.get_object('netatmo-credential');
            let netatmoUsername = builder.get_object('netatmo-username');
            let netatmoPassword = builder.get_object('netatmo-password');
            let netatmoDeviceId = builder.get_object('netatmo-device-id');
            netatmoUsername.text = this._settingsConnect.username;
            netatmoPassword.text = '****************';
            netatmoDeviceId.text = this._settingsStation.deviceId;
            netatmoUsername.connect('changed',()=>{this._settingsConnect.username = netatmoUsername.text});
            netatmoPassword.connect('changed',()=>{this._settingsConnect.password = netatmoPassword.text});
            netatmoDeviceId.connect('changed',()=>{this._settingsStation.deviceId = netatmoDeviceId.text});
            this.pack_start(mainWindows, true, true, 0);
        }
    }
}

function init(){
    log('init');
}

function buildPrefsWidget () {
    let widget = new NetatmoStationSettingsWidget();
    widget.show_all();
    return widget;
}
