import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Broadcast,
  Copy,
  Power,
  QrCode,
  Send,
  TriangleAlert,
  Upload,
  Wifi,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useRemoteStore } from '@/stores/remoteStore';

export function HostPanel(): React.JSX.Element {
  const state = useRemoteStore((s) => s.state);
  const [ip, setIp] = useState('');
  const [port, setPort] = useState(7900);
  const [generating, setGenerating] = useState(false);

  const interfaces = state?.interfaces ?? [];
  const hosting = state?.hosting ?? false;
  const inputSupported = state?.inputSupported ?? false;
  const peers = state?.peers ?? [];

  // Default the interface selection to the first (LAN-preferred) address.
  useEffect(() => {
    if (!ip && interfaces.length > 0) setIp(interfaces[0].address);
  }, [interfaces, ip]);

  const options = useMemo(
    () => interfaces.map((i) => ({ value: i.address, label: `${i.address}  ·  ${i.name}` })),
    [interfaces],
  );

  async function toggleHosting(): Promise<void> {
    if (hosting) {
      await window.agentmat.remote.stopHost();
    } else {
      if (!ip) {
        toast.error('Pick an IP address to host on.');
        return;
      }
      await window.agentmat.remote.startHost({ ip, port });
    }
  }

  async function generateCode(): Promise<void> {
    setGenerating(true);
    try {
      await window.agentmat.remote.generatePairingCode();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  function copyCode(): void {
    if (!state?.pairing) return;
    void navigator.clipboard.writeText(state.pairing.code);
    toast.success('Pairing code copied.');
  }

  const pairing = state?.pairing ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Broadcast className="h-4 w-4 text-primary" /> Allow this machine to be controlled
          </CardTitle>
          <CardDescription>
            Bind a WebSocket server to one of your network addresses, then share a one-time code so
            another AgentMate can connect and control this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label className="flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5" /> Network address
              </Label>
              <Combobox
                options={options}
                value={ip}
                onChange={setIp}
                placeholder={options.length ? 'Select an IP…' : 'No network interfaces found'}
                disabled={hosting || options.length === 0}
              />
            </div>
            <div className="flex w-full flex-col gap-1.5 sm:w-32">
              <Label>Port</Label>
              <Input
                type="number"
                value={port}
                min={1024}
                max={65535}
                disabled={hosting}
                onChange={(e) => setPort(Number(e.target.value) || 7900)}
              />
            </div>
          </div>

          {!inputSupported && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Keyboard/mouse control isn&apos;t available on this platform yet — connected
                controllers will see the screen but can&apos;t drive it. Screen viewing, clipboard
                and file transfer still work.
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={() => void toggleHosting()}
              variant={hosting ? 'destructive' : 'default'}
              disabled={!ip && !hosting}
            >
              <Power className="h-4 w-4" />
              {hosting ? 'Stop hosting' : 'Start hosting'}
            </Button>
            {hosting && (
              <Badge variant="success" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> Listening on {state?.hostIp}:
                {state?.hostPort}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {hosting && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Pairing code
            </CardTitle>
            <CardDescription>
              Each code contains a single-use token and expires shortly. Generate a fresh one for
              every connection.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pairing ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <img
                  src={pairing.qrDataUrl}
                  alt="Pairing QR code"
                  className="h-40 w-40 shrink-0 rounded-lg bg-white p-2"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label>Code (paste on the other device)</Label>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={pairing.code}
                        onFocus={(e) => e.currentTarget.select()}
                        className="h-20 flex-1 resize-none rounded-md border border-input bg-background p-2 font-mono text-[11px] leading-tight"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={copyCode}>
                      <Copy className="h-3.5 w-3.5" /> Copy code
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void generateCode()} disabled={generating}>
                      <QrCode className="h-3.5 w-3.5" /> New code
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <Button onClick={() => void generateCode()} disabled={generating}>
                <QrCode className="h-4 w-4" /> Generate pairing code
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {hosting && (
        <Card>
          <CardHeader>
            <CardTitle>Connected controllers ({peers.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {peers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No one is connected yet. Share the pairing code above to let a device connect.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {peers.map((peer) => (
                  <li
                    key={peer.id}
                    className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{peer.deviceName}</span>
                    <span className="text-xs text-muted-foreground">{peer.address}</span>
                  </li>
                ))}
              </ul>
            )}
            {peers.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => void window.agentmat.remote.sendClipboard()}>
                  <Send className="h-3.5 w-3.5" /> Send clipboard
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void window.agentmat.remote.sendFile()}>
                  <Upload className="h-3.5 w-3.5" /> Send file
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
