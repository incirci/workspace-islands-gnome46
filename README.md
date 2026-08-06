# Monitor Pointer Lock

A small GNOME Shell 46 extension for people who use extended displays but do
not want the mouse to drift onto another monitor by accident.

The pointer remains on its current monitor. To cross a shared edge, hold
**Ctrl** and move the pointer across it. It works in both directions and with
side-by-side or vertically stacked monitors.

This extension only controls pointer movement. It does not change GNOME
workspaces, window placement, display configuration, or keyboard shortcuts.

## Requirements

- GNOME Shell 46
- Wayland
- At least two displays in **Join Displays** / extended-display mode

## Install from a release

Download `monitor-pointer-lock@incirci.github.io.shell-extension.zip` from the
[latest release](../../releases/latest), then run:

```bash
gnome-extensions install --force monitor-pointer-lock@incirci.github.io.shell-extension.zip
```

Log out and back in, then enable it:

```bash
gnome-extensions enable monitor-pointer-lock@incirci.github.io
```

You can turn it off temporarily in the extension’s preferences window.

## Install from source

```bash
git clone https://github.com/incirci/gnome-monitor-pointer-lock
cd gnome-monitor-pointer-lock
make install
```

Log out and back in, then run `make enable`.

## How it works

The extension places Mutter pointer barriers only along the edges actually
shared by two monitors. On reaching one, Mutter holds the cursor at that edge.
If Ctrl is down at that moment, the extension releases that barrier event and
the cursor crosses normally. Unplugging, reconnecting, or rearranging monitors
rebuilds the barriers automatically.

## Troubleshooting

Check whether GNOME loaded the extension:

```bash
gnome-extensions info monitor-pointer-lock@incirci.github.io
```

Follow Shell errors while reproducing a problem:

```bash
journalctl -f -o cat /usr/bin/gnome-shell | grep -Ei 'monitor-pointer-lock|JS ERROR'
```

To immediately stop it, disable the extension:

```bash
gnome-extensions disable monitor-pointer-lock@incirci.github.io
```
