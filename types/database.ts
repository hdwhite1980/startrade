// Database types - generate with: npx supabase gen types typescript --project-id YOUR_ID > types/database.ts

export interface Database {
  public: {
    Tables: {
      markets: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          category: string;
          status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'RESOLVED';
          current_odds: { yes: number; no: number };
          total_volume: number;
          betting_closes_at: string;
          resolves_at: string;
          created_at: string;
          updated_at: string;
          resolved_value: boolean | null;
          source_url: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          category: string;
          status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'RESOLVED';
          current_odds?: { yes: number; no: number };
          total_volume?: number;
          betting_closes_at: string;
          resolves_at: string;
          created_at?: string;
          updated_at?: string;
          resolved_value?: boolean | null;
          source_url?: string | null;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          category?: string;
          status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'RESOLVED';
          current_odds?: { yes: number; no: number };
          total_volume?: number;
          betting_closes_at?: string;
          resolves_at?: string;
          created_at?: string;
          updated_at?: string;
          resolved_value?: boolean | null;
          source_url?: string | null;
        };
      };
      bets: {
        Row: {
          id: string;
          user_id: string;
          market_id: string;
          position: 'YES' | 'NO';
          amount: number;
          odds_at_placement: number;
          potential_payout: number;
          status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
          created_at: string;
          settled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          market_id: string;
          position: 'YES' | 'NO';
          amount: number;
          odds_at_placement: number;
          potential_payout: number;
          status?: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
          created_at?: string;
          settled_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          market_id?: string;
          position?: 'YES' | 'NO';
          amount?: number;
          odds_at_placement?: number;
          potential_payout?: number;
          status?: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
          created_at?: string;
          settled_at?: string | null;
        };
      };
      user_profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          total_winnings: number;
          win_rate: number;
          total_bets: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          total_winnings?: number;
          win_rate?: number;
          total_bets?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          total_winnings?: number;
          win_rate?: number;
          total_bets?: number;
          created_at?: string;
        };
      };
      ai_bet_suggestions: {
        Row: {
          id: string;
          title: string;
          description: string;
          category: string;
          suggested_odds: { yes: number; no: number };
          source_url: string | null;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          category: string;
          suggested_odds: { yes: number; no: number };
          source_url?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          category?: string;
          suggested_odds?: { yes: number; no: number };
          source_url?: string | null;
          status?: 'PENDING' | 'APPROVED' | 'REJECTED';
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
