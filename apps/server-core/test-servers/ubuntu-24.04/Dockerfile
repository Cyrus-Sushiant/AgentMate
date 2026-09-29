# A disposable Ubuntu 24.04 server for installer and system tests: systemd as PID 1 and sshd, with
# a root login and a non-root user whose sudo asks for the password, like a typical VPS.
# Run it privileged with the host cgroup namespace (see the test helper); it is never shipped.
FROM ubuntu:24.04
ENV container=docker DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends systemd systemd-sysv dbus openssh-server sudo ca-certificates curl tar gzip \
 && rm -rf /var/lib/apt/lists/* \
 && systemctl mask getty.target console-getty.service systemd-logind.service \
 && mkdir -p /run/sshd \
 && echo 'root:root-test-pw' | chpasswd \
 && sed -ri 's/^#?PermitRootLogin .*/PermitRootLogin yes/; s/^#?PasswordAuthentication .*/PasswordAuthentication yes/' /etc/ssh/sshd_config \
 && sed -ri 's/^(session\s+)required(\s+pam_loginuid\.so)/\1optional\2/' /etc/pam.d/sshd \
 && useradd -m -s /bin/bash deployer \
 && echo 'deployer:deployer-test-pw' | chpasswd \
 && usermod -aG sudo deployer \
 && systemctl enable ssh
STOPSIGNAL SIGRTMIN+3
EXPOSE 22
CMD ["/sbin/init"]
