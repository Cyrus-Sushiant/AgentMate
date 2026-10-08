// Run by Electron's own binary in "run as Node" mode, which brings Electron's TLS stack
// (BoringSSL) rather than the OpenSSL of the Node that runs the tests. It connects to a TLS
// server with the options it is given and prints one JSON line with the outcome:
//   ELECTRON_RUN_AS_NODE=1 electron boringsslProbe.cjs <port> <tls options as JSON>
const tls = require('node:tls');

const [port, optionsJson] = process.argv.slice(2);
const socket = tls.connect({
  host: '127.0.0.1',
  port: Number(port),
  rejectUnauthorized: false,
  ...JSON.parse(optionsJson || '{}'),
});
const done = (result) => {
  process.stdout.write(`${JSON.stringify(result)}\n`);
  socket.destroy();
  process.exit(0);
};
socket.on('secureConnect', () =>
  done({ ok: true, protocol: socket.getProtocol(), cipher: socket.getCipher().name }),
);
socket.on('error', (error) => done({ ok: false, message: error.message }));
setTimeout(() => done({ ok: false, message: 'timed out' }), 15000);
