# VPS

Minimal VPS support is plain systemd. Keep deployment outside the app code:
copy these unit files, edit paths/user/env for the server, then let systemd run
the same terminal command an operator would run manually.

Example:

```bash
sudo cp deploy/nyc-apt-radar.service.example /etc/systemd/system/nyc-apt-radar.service
sudo cp deploy/nyc-apt-radar.timer.example /etc/systemd/system/nyc-apt-radar.timer
sudo systemctl daemon-reload
sudo systemctl enable --now nyc-apt-radar.timer
```

Useful checks:

```bash
systemctl status nyc-apt-radar.timer
journalctl -u nyc-apt-radar.service -n 80 --no-pager
```

