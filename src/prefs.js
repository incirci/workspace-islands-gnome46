import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

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

        const edgeInset = new Adw.SpinRow({
            title: 'Edge inset',
            subtitle: 'Distance inside each monitor where crossing is blocked',
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 64,
                step_increment: 1,
                page_increment: 4,
            }),
        });
        settings.bind('edge-inset', edgeInset, 'value', Gio.SettingsBindFlags.DEFAULT);
        group.add(edgeInset);
        page.add(group);
        window.add(page);
    }
}
