export interface Notification {
  id: string | number;
  user_id?: string;
  title: string;
  message: string;
  type?: string;
  is_read: boolean;
  link_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface UnreadNotificationCount {
  count: number;
}
