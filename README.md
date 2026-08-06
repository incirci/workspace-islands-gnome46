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

## Configuration

Open the extension’s preferences to change **Edge inset**, the distance inside
each monitor where crossing is blocked. The default is 12 logical pixels and
the valid range is 1–64. Changes take effect immediately.

You can also change it from a terminal:

```bash
gsettings --schemadir src/schemas set org.gnome.shell.extensions.monitor-pointer-lock edge-inset 12
```

The enabled/disabled state is available in the same preferences window.
The **Keep pointer visible at outer edges** option also prevents the cursor
image from disappearing beyond bottom and right physical display edges. It is
enabled by default and uses the same inset distance.

## Install from source

```bash
git clone https://github.com/incirci/gnome-monitor-pointer-lock
cd gnome-monitor-pointer-lock
make install
```

Log out and back in, then run `make enable`.

## How it works

The extension builds a closed set of directional Mutter barriers around every
monitor. Sections shared with another monitor are released only when Ctrl is
down; physical outside edges remain closed. Perpendicular corner barriers stop
diagonal or high-speed motion from bypassing an endpoint. Unplugging,
reconnecting, or rearranging monitors rebuilds the geometry automatically.

The geometry is isolated from GNOME Shell and covered by deterministic and
seeded randomized tests for side-by-side, stacked, staggered, and multi-monitor
layouts. Run them with `make test`.

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
