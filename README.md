# gnome-shell-netatmo-station
Gnome shell extension to pull and display data from station

![Screenshot](https://raw.githubusercontent.com/profy12/gnome-shell-netatmo-station/master/images/netatmo-extension-screenshot.png)

## Prerequies

Should work with Gnome-shell 3.26 and later, tested with 3.28.

## Installation

First install the extension :

```
cd .local/share/gnome-shell/extensions/
git clone https://github.com/profy12/gnome-shell-netatmo-station.git
mv gnome-shell-netatmo-station netatmo-station@aurelien.bras.gmail.com
```

And then reload gnome-shell with `alt-F2 r`

Then go to extensions preferences via gnome-tweaks, and parameter your credential with the gear button. You need to enter your login/password Netatmo account.

Now reload a last time gnome-shell, and you should have external temperature displayed at top right.

## Usage

Data is refreshed every 5 minutes. You can choose in preference which data you want to display in the menu bar, for now only 3 data (temp outdoor/indoor and co2), later more to come.

You can click to have a small dashboard with netatmo data, will be improved in net version.
