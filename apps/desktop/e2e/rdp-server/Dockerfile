# A throwaway Remote Desktop server for rdpAiTask.e2e.ts: xrdp with an XFCE desktop, a user with a
# known password, and a terminal that opens by itself so the AI has somewhere to type. The panel's
# default config is copied in place because its first-start dialog would otherwise take the focus.
# xdotool lets the test ask the X server where the pointer ended up.
FROM ubuntu:24.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    xrdp xorgxrdp xfce4 xfce4-terminal dbus-x11 xdotool ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && useradd -m -s /bin/bash rdpuser \
 && echo 'rdpuser:rdp-pass-123' | chpasswd \
 && echo 'xfce4-session' > /home/rdpuser/.xsession \
 && chown rdpuser:rdpuser /home/rdpuser/.xsession \
 && adduser xrdp ssl-cert \
 && cp /etc/xdg/xfce4/panel/default.xml /etc/xdg/xfce4/xfconf/xfce-perchannel-xml/xfce4-panel.xml
COPY e2e-terminal.desktop /etc/xdg/autostart/e2e-terminal.desktop
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 3389
CMD ["/entrypoint.sh"]
