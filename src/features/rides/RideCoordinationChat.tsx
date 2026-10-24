import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, MessageSquare, AlertCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { rideMessageService } from './rideMessage.service';
import { realtimeService } from '@/features/realtime/realtime.service';
import type { RideMessage, ChatAccessCheckResult } from './rideMessage.types';
import type { RideStatus } from '@/types/database';
import type { RealtimeRideEvent, RideRoomSubscription } from '@/features/realtime/realtime.types';

export interface RideCoordinationChatProps {
  rideId: string;
  rideStatus: RideStatus;
  currentUserId: string;
  currentUserName: string;
  hostId: string;
  className?: string;
}

export const RideCoordinationChat: React.FC<RideCoordinationChatProps> = ({
  rideId,
  rideStatus,
  currentUserId,
  currentUserName,
  hostId,
  className = '',
}) => {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatAccess, setChatAccess] = useState<ChatAccessCheckResult | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const access = await rideMessageService.checkChatAccess(rideId, currentUserId);
      setChatAccess(access);

      if (access.can_read) {
        const history = await rideMessageService.getMessages(rideId, currentUserId);
        setMessages(history);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load coordination messages');
    } finally {
      setIsLoading(false);
    }
  }, [rideId, currentUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime room for live incoming messages
  useEffect(() => {
    let sub: RideRoomSubscription | null = null;
    let isCancelled = false;

    const role = currentUserId === hostId ? 'HOST' : 'PASSENGER';

    realtimeService
      .subscribeToRideRoom(rideId, currentUserId, currentUserName, role, {
        onEvent: (event: RealtimeRideEvent) => {
          if (event.type === 'ride:message:new') {
            const payload = event.payload;
            setMessages((prev) => {
              if (prev.some((m) => m.id === payload.message_id)) {
                return prev;
              }
              return [
                ...prev,
                {
                  id: payload.message_id,
                  ride_id: payload.ride_id,
                  sender_id: payload.sender_id,
                  sender_name: payload.sender_name,
                  message: payload.message,
                  created_at: payload.created_at,
                  expires_at: payload.expires_at,
                },
              ];
            });
          }
        },
      })
      .then((subscription) => {
        if (isCancelled) {
          subscription.unsubscribe();
        } else {
          sub = subscription;
        }
      })
      .catch((err) => {
        console.warn('Realtime subscription error for ride chat:', err);
      });

    return () => {
      isCancelled = true;
      if (sub) {
        sub.unsubscribe();
      }
    };
  }, [rideId, currentUserId, currentUserName, hostId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const sent = await rideMessageService.sendMessage(rideId, currentUserId, trimmed);
      setInputText('');
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const isReadOnly =
    ['COMPLETED', 'CANCELLED'].includes(rideStatus) || Boolean(chatAccess?.is_read_only);

  if (isLoading) {
    return (
      <div className={`p-6 text-center bg-card rounded-xl border border-border ${className}`}>
        <RefreshCw className="w-5 h-5 mx-auto text-primary animate-spin mb-2" />
        <p className="text-xs text-muted-foreground font-medium">Loading coordination messages...</p>
      </div>
    );
  }

  if (chatAccess && !chatAccess.can_read) {
    return (
      <div className={`p-4 bg-amber-500/10 rounded-xl border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2 ${className}`}>
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>{chatAccess.reason || 'You do not have permission to view messages for this ride.'}</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Trip Coordination Chat</h3>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono text-muted-foreground">
            Ephemeral
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3 text-muted-foreground/70" />
          <span>Auto-expires 3h post-trip</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-4 min-h-[200px] max-h-[340px] overflow-y-auto space-y-3 bg-muted/15">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4 text-muted-foreground">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2 stroke-[1.5]" />
            <p className="text-xs font-medium text-foreground">No coordination messages yet</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
              Use this chat to coordinate exact pickup spots, timing, or vehicle identification with your ride group.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const isMsgFromHost = msg.sender_id === hostId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-semibold text-foreground/80">
                    {isMe ? 'You' : msg.sender_name || 'Student'}
                  </span>
                  {isMsgFromHost && (
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.2 rounded font-medium">
                      Host
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs break-words ${
                    isMe
                      ? 'bg-primary text-primary-foreground rounded-br-xs'
                      : 'bg-card border border-border text-foreground rounded-bl-xs shadow-xs'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Input or Read-Only Notice Bar */}
      <div className="p-3 border-t border-border bg-card">
        {isReadOnly ? (
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-center">
            <p className="text-xs font-medium text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Trip has concluded. Chat is read-only and will be removed in 3 hours.
            </p>
          </div>
        ) : chatAccess && !chatAccess.can_send ? (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              {chatAccess.reason || 'Sending messages is restricted for this ride.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Coordinate pickup landmark or exact arrival..."
                maxLength={500}
                disabled={isSending}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary focus:border-primary disabled:bg-muted"
              />
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={!inputText.trim() || isSending}
                isLoading={isSending}
                className="h-8 px-3 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] text-muted-foreground">
                Visible only to confirmed trip participants and host
              </span>
              <span
                className={`text-[10px] font-mono ${
                  inputText.length > 450 ? 'text-amber-600 font-bold' : 'text-muted-foreground'
                }`}
              >
                {inputText.length}/500
              </span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
