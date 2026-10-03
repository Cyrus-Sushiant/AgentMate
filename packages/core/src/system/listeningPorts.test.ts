import { describe, expect, it } from 'vitest';
import { parseLsofListening, parseNetstatListening, parseSsListening } from './listeningPorts.js';

describe('parseNetstatListening', () => {
  const NETSTAT = [
    '',
    'Active Connections',
    '',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1456',
    '  TCP    127.0.0.1:5173         0.0.0.0:0              LISTENING       4242',
    '  TCP    127.0.0.1:5173         127.0.0.1:61234        ESTABLISHED     4242',
    '  TCP    127.0.0.1:61234        127.0.0.1:5173         TIME_WAIT       0',
    '  TCP    [::]:3000              [::]:0                 LISTENING       777',
    '  TCP    [::1]:5173             [::]:0                 LISTENING       4242',
    '  UDP    0.0.0.0:500            *:*                                    3100',
  ].join('\r\n');

  it('lists the TCP ports being listened on, by owning pid, IPv4 and IPv6', () => {
    expect(parseNetstatListening(NETSTAT)).toEqual([
      { pid: 1456, port: 135 },
      { pid: 4242, port: 5173 },
      { pid: 777, port: 3000 },
    ]);
  });

  it('does not depend on the English state name', () => {
    // German Windows prints ABHÖREN for LISTENING.
    const german = '  TCP    0.0.0.0:8080           0.0.0.0:0              ABHÖREN         99';
    expect(parseNetstatListening(german)).toEqual([{ pid: 99, port: 8080 }]);
  });

  it('gives nothing for empty or unrelated text', () => {
    expect(parseNetstatListening('')).toEqual([]);
    expect(parseNetstatListening('netstat: not found')).toEqual([]);
  });
});

describe('parseLsofListening', () => {
  it('pairs each address with the pid above it', () => {
    const output = [
      'p4242',
      'f21',
      'n*:5173',
      'f22',
      'n[::1]:5173',
      'p777',
      'f9',
      'n127.0.0.1:3000',
    ].join('\n');
    expect(parseLsofListening(output)).toEqual([
      { pid: 4242, port: 5173 },
      { pid: 777, port: 3000 },
    ]);
  });

  it('skips connected sockets and garbage', () => {
    const output = [
      'p1',
      'n127.0.0.1:5000->127.0.0.1:61000',
      'nnot-an-address',
      'pabc',
      'n*:80',
    ].join('\n');
    expect(parseLsofListening(output)).toEqual([]);
  });
});

describe('parseSsListening', () => {
  it('reads each pid that holds a listening socket', () => {
    const output = [
      'LISTEN 0      511          0.0.0.0:5173       0.0.0.0:*    users:(("node",pid=4242,fd=20))',
      'LISTEN 0      4096            [::]:22            [::]:*',
      'LISTEN 0      511                *:3000             *:*    users:(("node",pid=7,fd=3),("node",pid=8,fd=3))',
    ].join('\n');
    expect(parseSsListening(output)).toEqual([
      { pid: 4242, port: 5173 },
      { pid: 7, port: 3000 },
      { pid: 8, port: 3000 },
    ]);
  });

  it('gives nothing for empty output', () => {
    expect(parseSsListening('')).toEqual([]);
  });
});
