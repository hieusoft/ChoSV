// ==========================================
// Models — Chat Service
// ==========================================

export interface Conversation {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_id: string | null;
  last_message_at: string | null;
  buyer_unread_count: number;
  seller_unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: 'text' | 'image' | 'system';
  is_read: boolean;
  read_at: string | null;
  risk_score: number;
  moderation_status: 'unchecked' | 'safe' | 'warning' | 'blocked' | 'review';
  created_at: string;
}

// ==========================================
// WebSocket message types
// ==========================================

export type WsClientEvent =
  | { event: 'join_conversation'; data: { conversation_id: string } }
  | { event: 'leave_conversation'; data: { conversation_id: string } }
  | { event: 'send_message'; data: { conversation_id: string; content: string; message_type?: 'text' | 'image' } }
  | { event: 'mark_read'; data: { conversation_id: string } }
  | { event: 'load_more'; data: { conversation_id: string; before_id: string } }
  | { event: 'ping' };

export type WsServerEvent =
  | { event: 'message_received'; data: Message }
  | { event: 'message_ack'; data: { message_id: string; conversation_id: string; timestamp: string } }
  | { event: 'message_read'; data: { conversation_id: string; read_by: string } }
  | { event: 'messages_history'; data: { conversation_id: string; messages: Message[]; has_more: boolean } }
  | { event: 'risk_warning'; data: { conversation_id: string; message_id: string; risk_score: number; signals: string[]; warning_text: string } }
  | { event: 'user_online'; data: { user_id: string; online: boolean } }
  | { event: 'error'; data: { code: string; message: string } }
  | { event: 'pong' };
