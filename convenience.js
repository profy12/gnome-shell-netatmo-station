const Gdk = imports.gi.Gdk
const Gio = imports.gi.Gio
const GLib = imports.gi.GLib
const Gtk = imports.gi.Gtk

class NetatmoCredentialSettings {
  constructor(extensionPath){
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(extensionPath + '/schemas', defaultSource, false); // trusted = false
    let schemaId = 'org.gnome.shell.extensions.netatmo-station.credential';
    let schema = source.lookup(schemaId, false); // recursive = false
    if (!schema) {
      throw new Error('Schema ' + schemaId + ' could not be found in the path ' + extensionPath);
    }
    this._settings = new Gio.Settings({settings_schema: schema});
  }
  get username() { return this._settings.get_string('netatmo-username')};
  get password() { return this._settings.get_string('netatmo-password')};
  set username(username) { this._settings.set_string('netatmo-username',username)};
  set password(password) { this._settings.set_string('netatmo-password',password)};
}
class NetatmoStationSettings {
  constructor(extensionPath){
    let defaultSource = Gio.SettingsSchemaSource.get_default();
    let source = Gio.SettingsSchemaSource.new_from_directory(extensionPath + '/schemas', defaultSource, false); // trusted = false
    let schemaId = 'org.gnome.shell.extensions.netatmo-station.station';
    let schema = source.lookup(schemaId, false); // recursive = false
    if (!schema) {
      throw new Error('Schema ' + schemaId + ' could not be found in the path ' + extensionPath);
    }
    this._settings = new Gio.Settings({settings_schema: schema});
  }
  get deviceId() { return this._settings.get_string('netatmo-device-id')};
  set deviceId(deviceId) { this._settings.set_string('netatmo-device-id',deviceId)};
  get displayTempExt() { return this._settings.get_boolean('netatmo-display-temp-ext')};
  set displayTempExt(choice) { this._settings.set_boolean('netatmo-display-temp-ext',choice)};
  get displayTempInt() { return this._settings.get_boolean('netatmo-display-temp-int')};
  set displayTempInt(choice) { this._settings.set_boolean('netatmo-display-temp-int',choice)};
  get displayCO2() { return this._settings.get_boolean('netatmo-display-co2')};
  set displayCO2(choice) { this._settings.set_boolean('netatmo-display-co2',choice)};
}
