# A stand-in app for the nginx -t harness (E10): it answers HTTP and HTTPS with what it received,
# upgrades WebSocket requests and echoes UDP datagrams, so tests can see what nginx passed on.
# Only Node's own modules are used. Never shipped.
FROM node:22-alpine
COPY upstream.mjs /srv/upstream.mjs
USER node
CMD ["node", "/srv/upstream.mjs"]
