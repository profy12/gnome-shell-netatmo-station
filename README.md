# gnome-shell-netatmo-station
Gnome shell extension to pull and display data from station

## Prerequies

Should work with Gnome-shell 3.26 and later, tested with 3.28.

## Installation

First install the extension :

```
cd .local/share/gnome-shell/extensions/
git clone git@github.com:profy12/gnome-shell-netatmo-station.git
mv gnome-shell-netatmo-station netatmo-station@aurelien.bras.gmail.com
```

And then reload gnome-shell with `alt-F2 r`

Then go to extensions preferences via gnome-tweaks, and parameter your credential with the gear button. You need to enter your login/password Netatmo account and your station device_id (mac address).

Now reload a last time gnome-shell, and you should have external temperature displayed at top right.

## Usage

Temperature is refreshed every 5 minutes, you can click on temperature to perform a demand refresh.

Note that Netatmo station send data every 10 minutes only so it's useless to refresh more often.

