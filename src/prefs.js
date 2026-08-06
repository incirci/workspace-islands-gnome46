import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MonitorPointerLockPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-desktop-display-symbolic',
        });
        const group = new Adw.PreferencesGroup({
            title: 'Pointer lock',
            description: 'The pointer stays on its current monitor. Hold Ctrl while crossing a shared edge to move to another monitor.',
        });

        const enabled = new Adw.SwitchRow({
            title: 'Enable pointer lock',
            subtitle: 'Lock monitor crossing until Ctrl is held',
        });
        settings.bind('enabled', enabled, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(enabled);
        page.add(group);
        window.add(page);
    }
}
