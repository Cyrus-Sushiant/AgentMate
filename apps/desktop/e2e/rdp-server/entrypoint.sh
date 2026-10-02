#!/bin/sh
# A container restarted from the same image can still hold the last run's pid files.
rm -f /var/run/xrdp/*.pid /var/run/xrdp/xrdp-sesman.pid
mkdir -p /var/run/xrdp
/usr/sbin/xrdp-sesman
exec /usr/sbin/xrdp --nodaemon
