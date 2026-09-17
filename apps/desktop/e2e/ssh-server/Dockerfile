# A throwaway SSH server for sshTaskRunner.e2e.test.ts: bash, and a user whose sudo asks for a
# password, like a typical VPS login.
FROM ubuntu:22.04
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssh-server sudo \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /run/sshd \
 && useradd -m -s /bin/bash smartvpn \
 && echo 'smartvpn:s3cret-pw' | chpasswd \
 && usermod -aG sudo smartvpn
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D", "-e"]
