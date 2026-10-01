// A stand-in for an app behind nginx in the nginx -t harness. Every answer lists what arrived, so
// tests can check the path, the Host and the forwarded headers nginx sent. Set through:
//   LISTEN_HOST  the address to listen on (127.0.0.1 next to nginx, 0.0.0.0 elsewhere)
//   HTTP_PORT    plain HTTP, which also upgrades WebSocket requests
//   HTTPS_PORT   HTTPS, with TLS_CERT_B64 and TLS_KEY_B64 holding base64-encoded PEM
//   UDP_PORT     answers each datagram with "echo:" and the datagram
import { createHash } from 'node:crypto';
import dgram from 'node:dgram';
import http from 'node:http';
import https from 'node:https';

const host = process.env.LISTEN_HOST ?? '127.0.0.1';
const webSocketGuid = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function answer(scheme) {
  return (request, response) => {
    let bytes = 0;
    request.on('data', (chunk) => {
      bytes += chunk.length;
    });
    request.on('end', () => {
      const lines = [`upstream: ${scheme}`, `${request.method} ${request.url} HTTP/${request.httpVersion}`];
      for (let i = 0; i < request.rawHeaders.length; i += 2) {
        lines.push(`${request.rawHeaders[i]}: ${request.rawHeaders[i + 1]}`);
      }
      lines.push(`body-bytes: ${bytes}`);
      let body = `${lines.join('\n')}\n`;
      // Big enough for gzip to bother.
      if (request.url.startsWith('/big')) {
        body += `${'0123456789abcdef'.repeat(512)}\n`;
      }
      response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(body);
    });
  };
}

function upgrade(request, socket) {
  const key = request.headers['sec-websocket-key'];
  if (!key || request.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }
  const accept = createHash('sha1').update(key + webSocketGuid).digest('base64');
  socket.write(
    ['HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade', `Sec-WebSocket-Accept: ${accept}`, '', ''].join('\r\n'),
  );
  setTimeout(() => socket.end(), 500);
}

if (process.env.HTTP_PORT) {
  const server = http.createServer(answer('http'));
  server.on('upgrade', upgrade);
  server.listen(Number(process.env.HTTP_PORT), host, () => console.log(`http on ${host}:${process.env.HTTP_PORT}`));
}

if (process.env.HTTPS_PORT) {
  const pem = (name) => Buffer.from(process.env[name] ?? '', 'base64');
  const server = https.createServer({ cert: pem('TLS_CERT_B64'), key: pem('TLS_KEY_B64') }, answer('https'));
  server.listen(Number(process.env.HTTPS_PORT), host, () => console.log(`https on ${host}:${process.env.HTTPS_PORT}`));
}

if (process.env.UDP_PORT) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (message, from) => {
    socket.send(Buffer.concat([Buffer.from('echo:'), message]), from.port, from.address);
  });
  socket.bind(Number(process.env.UDP_PORT), host, () => console.log(`udp on ${host}:${process.env.UDP_PORT}`));
}
