'use client';

import { useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  is_paused: boolean;
  paused_until: string | null;
  last_message_at: string;
}

interface Message {
  id: string;
  from_me: boolean;
  is_from_human: boolean;
  body: string;
  created_at: string;
}

interface QRState {
  status: 'connected' | 'pending' | 'waiting' | 'error';
  qr?: string;
}

/** Les LID WhatsApp (mode privacy) dépassent 13 chiffres — pas de vrai numéro à afficher. */
function displayPhone(phone: string) {
  return phone.replace('+', '').length > 13 ? 'Numéro masqué' : phone;
}

export default function AgentPage() {
  const [qrState, setQrState] = useState<QRState>({ status: 'waiting' });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll QR / état de connexion
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/wa/qr');
        if (res.ok) setQrState(await res.json());
        else setQrState({ status: 'error' });
      } catch {
        setQrState({ status: 'error' });
      }
    };
    poll();
    const interval = setInterval(poll, 4_000);
    return () => clearInterval(interval);
  }, []);

  // Conversations
  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/wa/conversations');
      if (res.ok) setConversations(await res.json());
    };
    load();
    const interval = setInterval(load, 5_000);
    return () => clearInterval(interval);
  }, []);

  // Messages de la conversation sélectionnée
  useEffect(() => {
    if (!selectedPhone) return;
    const load = async () => {
      const res = await fetch(`/api/wa/messages?phone=${encodeURIComponent(selectedPhone)}`);
      if (res.ok) setMessages(await res.json());
    };
    load();
    const interval = setInterval(load, 3_000);
    return () => clearInterval(interval);
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!reply.trim() || !selectedPhone) return;
    setSending(true);
    await fetch('/api/wa/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: selectedPhone, message: reply }),
    });
    setReply('');
    setSending(false);
  };

  const togglePause = async (phone: string, currentlyPaused: boolean) => {
    await fetch('/api/wa/pause', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone, action: currentlyPaused ? 'resume' : 'pause' }),
    });
    setConversations((prev) =>
      prev.map((c) => (c.customer_phone === phone ? { ...c, is_paused: !currentlyPaused } : c)),
    );
  };

  const selectedConv = conversations.find((c) => c.customer_phone === selectedPhone);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Apolline — WhatsApp</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            L&apos;inbox en direct. Répondre à la main met Apolline en pause 24 h sur la conversation.
          </p>
        </div>
        <ConnectionBadge state={qrState} />
      </div>

      {qrState.status !== 'connected' && <QRPanel state={qrState} />}

      {qrState.status === 'connected' && (
        <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {/* Liste des conversations */}
          <aside className="w-72 shrink-0 overflow-y-auto border-r border-border">
            {conversations.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Aucune conversation pour le moment.</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedPhone(conv.customer_phone)}
                className={cn(
                  'flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  selectedPhone === conv.customer_phone && 'bg-muted',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate text-sm font-medium">
                    {conv.customer_name ?? displayPhone(conv.customer_phone)}
                  </span>
                  {conv.is_paused ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">Équipe</Badge>
                  ) : (
                    <Badge className="shrink-0 bg-success text-[10px] text-white">Apolline</Badge>
                  )}
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {displayPhone(conv.customer_phone)}
                </span>
              </button>
            ))}
          </aside>

          {/* Fil de messages */}
          <main className="flex flex-1 flex-col overflow-hidden">
            {!selectedPhone ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Sélectionnez une conversation
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="font-medium">{selectedConv?.customer_name ?? displayPhone(selectedPhone)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{displayPhone(selectedPhone)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {selectedConv?.is_paused ? "L'équipe répond" : 'Apolline répond'}
                    </span>
                    <Switch
                      checked={selectedConv?.is_paused ?? false}
                      onCheckedChange={() => togglePause(selectedPhone, selectedConv?.is_paused ?? false)}
                    />
                    <span className="text-xs text-muted-foreground">Pause</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={cn('flex', msg.from_me ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm',
                          msg.from_me
                            ? msg.is_from_human
                              ? 'bg-info text-white'
                              : 'bg-primary text-primary-foreground'
                            : 'bg-muted text-foreground',
                        )}
                      >
                        <p className="whitespace-pre-line">{msg.body}</p>
                        <p className="mt-0.5 text-right text-[10px] opacity-60">
                          {msg.from_me ? (msg.is_from_human ? 'Équipe' : 'Apolline') : ''}{' '}
                          {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                <div className="flex shrink-0 gap-2 border-t border-border p-3">
                  <Input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Répondre à la main (met Apolline en pause 24 h)…"
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={sending || !reply.trim()}>
                    Envoyer
                  </Button>
                </div>
              </>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({ state }: { state: QRState }) {
  const map = {
    connected: { label: '● Connectée', cls: 'bg-success text-white' },
    pending: { label: '◌ Scan requis', cls: 'bg-warning text-white' },
    waiting: { label: '◌ Démarrage…', cls: 'bg-muted text-muted-foreground' },
    error: { label: '✕ Service hors ligne', cls: 'bg-destructive text-white' },
  };
  const { label, cls } = map[state.status];
  return <span className={cn('rounded-full px-3 py-1 text-xs font-medium', cls)}>{label}</span>;
}

function QRPanel({ state }: { state: QRState }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-sm">
      <p className="font-display text-xl font-semibold">Connecter Apolline à WhatsApp</p>
      {state.status === 'pending' && state.qr ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.qr} alt="QR Code WhatsApp" className="h-64 w-64 rounded-lg border" />
          <p className="max-w-md text-center text-sm text-muted-foreground">
            Sur le téléphone de la conciergerie : WhatsApp → Appareils connectés → Connecter un
            appareil → scanner ce QR code.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {state.status === 'waiting'
            ? 'En attente du service WhatsApp…'
            : 'Service WhatsApp injoignable — vérifier le déploiement Railway.'}
        </p>
      )}
    </div>
  );
}
