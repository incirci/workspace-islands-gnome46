# Contributing

Please keep contributions focused on pointer locking between GNOME monitors.
For a bug, include your GNOME Shell version, session type, monitor layout, and
relevant `journalctl -f -o cat /usr/bin/gnome-shell` output.

To develop locally:

```bash
make install
```

Log out and back in before testing changed extension code on Wayland. Use
`make test` to run the barrier geometry suite and `make pack` to create the
installable archive.

Unless explicitly stated otherwise, contributions submitted to this project
are licensed under the Apache License 2.0 under its contribution terms.
