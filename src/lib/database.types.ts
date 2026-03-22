export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export type GenerationType = 'text-to-video' | 'image-to-video' | 'text-to-image' | 'image-to-image'
export type GenerationStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'
export type PlanType = 'creator' | 'studio' | 'director' | null
export type PaidPlanType = Exclude<PlanType, null>
export type AdminTargetPlan = 'all' | 'free' | PaidPlanType
export type TransactionType = 'purchase' | 'usage' | 'refund' | 'bonus' | 'subscription'
export type LanguageType = 'pt' | 'en' | 'es'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
export type NotificationType = 'generation_complete' | 'generation_failed' | 'credits_low' | 'subscription' | 'system'
export type UserRole = 'user' | 'admin'

// Settings stored in generations.settings JSONB
export interface GenerationSettings {
  duration?: number
  resolution?: string
  aspectRatio?: string
  seed?: number
  withAudio?: boolean
  loopVideo?: boolean
  motionStrength?: number
  guidanceScale?: number
  numInferenceSteps?: number
  [key: string]: Json | undefined
}

export interface Database {
  public: {
    Tables: {
      // =============================================
      // PROFILES
      // =============================================
      profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          email: string | null
          avatar_url: string | null
          language: LanguageType
          timezone: string
          notifications_enabled: boolean
          role: UserRole
          is_suspended: boolean
          suspended_reason: string | null
          must_reset_password: boolean
          force_logout_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string | null
          email?: string | null
          avatar_url?: string | null
          language?: LanguageType
          timezone?: string
          notifications_enabled?: boolean
          role?: UserRole
          is_suspended?: boolean
          suspended_reason?: string | null
          must_reset_password?: boolean
          force_logout_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string | null
          email?: string | null
          avatar_url?: string | null
          language?: LanguageType
          timezone?: string
          notifications_enabled?: boolean
          role?: UserRole
          is_suspended?: boolean
          suspended_reason?: string | null
          must_reset_password?: boolean
          force_logout_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      // =============================================
      // SUBSCRIPTIONS
      // =============================================
      subscriptions: {
        Row: {
          id: string
          user_id: string
          plan: PlanType
          status: SubscriptionStatus
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          plan?: PlanType
          status?: SubscriptionStatus
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          plan?: PlanType
          status?: SubscriptionStatus
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          stripe_price_id?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
      }

      // =============================================
      // USER_CREDITS
      // =============================================
      user_credits: {
        Row: {
          id: string
          user_id: string
          credits: number
          lifetime_credits: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          credits?: number
          lifetime_credits?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          credits?: number
          lifetime_credits?: number
          created_at?: string
          updated_at?: string
        }
      }

      // =============================================
      // CREDIT_TRANSACTIONS
      // =============================================
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          type: TransactionType
          amount: number
          balance_after: number
          description: string | null
          reference_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: TransactionType
          amount: number
          balance_after: number
          description?: string | null
          reference_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: TransactionType
          amount?: number
          balance_after?: number
          description?: string | null
          reference_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }

      // =============================================
      // GENERATIONS
      // =============================================
      generations: {
        Row: {
          id: string
          user_id: string
          type: GenerationType
          status: GenerationStatus
          prompt: string | null
          negative_prompt: string | null
          input_image_url: string | null
          output_url: string | null
          thumbnail_url: string | null
          model_id: string
          model_name: string | null
          settings: GenerationSettings
          credits_used: number
          replicate_prediction_id: string | null
          error_message: string | null
          is_public: boolean
          view_count: number
          created_at: string
          updated_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: GenerationType
          status?: GenerationStatus
          prompt?: string | null
          negative_prompt?: string | null
          input_image_url?: string | null
          output_url?: string | null
          thumbnail_url?: string | null
          model_id: string
          model_name?: string | null
          settings?: GenerationSettings
          credits_used?: number
          replicate_prediction_id?: string | null
          error_message?: string | null
          is_public?: boolean
          view_count?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: GenerationType
          status?: GenerationStatus
          prompt?: string | null
          negative_prompt?: string | null
          input_image_url?: string | null
          output_url?: string | null
          thumbnail_url?: string | null
          model_id?: string
          model_name?: string | null
          settings?: GenerationSettings
          credits_used?: number
          replicate_prediction_id?: string | null
          error_message?: string | null
          is_public?: boolean
          view_count?: number
          created_at?: string
          updated_at?: string
          completed_at?: string | null
        }
      }

      // =============================================
      // STRIPE_WEBHOOK_EVENTS
      // =============================================
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          stripe_created_at: string | null
          status: 'processing' | 'processed' | 'failed'
          attempts: number
          last_error: string | null
          received_at: string
          processed_at: string | null
          updated_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          stripe_created_at?: string | null
          status?: 'processing' | 'processed' | 'failed'
          attempts?: number
          last_error?: string | null
          received_at?: string
          processed_at?: string | null
          updated_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          stripe_created_at?: string | null
          status?: 'processing' | 'processed' | 'failed'
          attempts?: number
          last_error?: string | null
          received_at?: string
          processed_at?: string | null
          updated_at?: string
        }
      }

      // =============================================
      // CONTENT_FLAGS
      // =============================================
      content_flags: {
        Row: {
          id: string
          generation_id: string
          reporter_user_id: string | null
          reason: string
          details: string | null
          status: 'open' | 'reviewing' | 'dismissed' | 'removed'
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          generation_id: string
          reporter_user_id?: string | null
          reason: string
          details?: string | null
          status?: 'open' | 'reviewing' | 'dismissed' | 'removed'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          generation_id?: string
          reporter_user_id?: string | null
          reason?: string
          details?: string | null
          status?: 'open' | 'reviewing' | 'dismissed' | 'removed'
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
        }
      }

      // =============================================
      // PROMPT_BLACKLIST
      // =============================================
      prompt_blacklist: {
        Row: {
          id: string
          pattern: string
          reason: string | null
          is_regex: boolean
          is_active: boolean
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          pattern: string
          reason?: string | null
          is_regex?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          pattern?: string
          reason?: string | null
          is_regex?: boolean
          is_active?: boolean
          created_by?: string | null
          created_at?: string
        }
      }

      ai_model_settings: {
        Row: {
          id: string
          model_id: string
          is_enabled: boolean
          credit_cost_override: number | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          model_id: string
          is_enabled?: boolean
          credit_cost_override?: number | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          model_id?: string
          is_enabled?: boolean
          credit_cost_override?: number | null
          updated_by?: string | null
          updated_at?: string
        }
      }

      plan_limits: {
        Row: {
          id: string
          plan: string
          max_concurrent_generations: number
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          plan: string
          max_concurrent_generations: number
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          plan?: string
          max_concurrent_generations?: number
          updated_by?: string | null
          updated_at?: string
        }
      }

      system_settings: {
        Row: {
          key: string
          value: Json
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          key: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          key?: string
          value?: Json
          updated_by?: string | null
          updated_at?: string
        }
      }

      feature_flags: {
        Row: {
          id: string
          key: string
          enabled: boolean
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          key: string
          enabled?: boolean
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          key?: string
          enabled?: boolean
          description?: string | null
          updated_by?: string | null
          updated_at?: string
        }
      }

      support_tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'normal' | 'high' | 'urgent'
          created_by_admin: boolean
          assigned_admin_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          created_by_admin?: boolean
          assigned_admin_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'normal' | 'high' | 'urgent'
          created_by_admin?: boolean
          assigned_admin_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }

      support_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_user_id: string | null
          sender_role: 'user' | 'admin' | 'system'
          message: string
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_user_id?: string | null
          sender_role: 'user' | 'admin' | 'system'
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_user_id?: string | null
          sender_role?: 'user' | 'admin' | 'system'
          message?: string
          created_at?: string
        }
      }

      user_internal_notes: {
        Row: {
          id: string
          user_id: string
          admin_user_id: string | null
          note: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          admin_user_id?: string | null
          note: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          admin_user_id?: string | null
          note?: string
          created_at?: string
        }
      }

      // =============================================
      // FAVORITES
      // =============================================
      favorites: {
        Row: {
          id: string
          user_id: string
          generation_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          generation_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          generation_id?: string
          created_at?: string
        }
      }

      // =============================================
      // SAVED_PROMPTS
      // =============================================
      saved_prompts: {
        Row: {
          id: string
          user_id: string
          title: string
          prompt: string
          negative_prompt: string | null
          category: GenerationType | null
          tags: string[] | null
          use_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          prompt: string
          negative_prompt?: string | null
          category?: GenerationType | null
          tags?: string[] | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          prompt?: string
          negative_prompt?: string | null
          category?: GenerationType | null
          tags?: string[] | null
          use_count?: number
          created_at?: string
          updated_at?: string
        }
      }

      // =============================================
      // API_KEYS
      // =============================================
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          expires_at: string | null
          is_active: boolean
          permissions: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          permissions?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          permissions?: Json
          created_at?: string
        }
      }

      // =============================================
      // USAGE_STATS
      // =============================================
      usage_stats: {
        Row: {
          id: string
          user_id: string
          date: string
          generation_type: GenerationType
          generation_count: number
          credits_used: number
          total_duration_seconds: number
        }
        Insert: {
          id?: string
          user_id: string
          date?: string
          generation_type: GenerationType
          generation_count?: number
          credits_used?: number
          total_duration_seconds?: number
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          generation_type?: GenerationType
          generation_count?: number
          credits_used?: number
          total_duration_seconds?: number
        }
      }

      // =============================================
      // NOTIFICATIONS
      // =============================================
      notifications: {
        Row: {
          id: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          data: Json | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: NotificationType
          title: string
          message: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: NotificationType
          title?: string
          message?: string
          data?: Json | null
          read?: boolean
          created_at?: string
        }
      }
    }

    Views: {
      user_dashboard: {
        Row: {
          user_id: string
          display_name: string | null
          avatar_url: string | null
          language: LanguageType | null
          plan: PlanType | null
          subscription_status: SubscriptionStatus | null
          current_period_end: string | null
          credits: number | null
          lifetime_credits: number | null
          total_generations: number
          successful_generations: number
          total_favorites: number
        }
      }
    }

    Functions: {
      admin_generation_analytics: {
        Args: {
          p_days?: number
        }
        Returns: {
          total: number
          succeeded: number
          failed: number
          processing: number
          canceled: number
          last_n_days: number
          credits_last_n_days: number
          top_models: Json
        }[]
      }
      deduct_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_description?: string
          p_reference_id?: string
        }
        Returns: boolean
      }
      add_credits: {
        Args: {
          p_user_id: string
          p_amount: number
          p_type?: TransactionType
          p_description?: string
          p_reference_id?: string
        }
        Returns: number
      }
      complete_generation: {
        Args: {
          p_generation_id: string
          p_status: GenerationStatus
          p_output_url?: string
          p_thumbnail_url?: string
          p_error_message?: string
        }
        Returns: boolean
      }
    }

    Enums: {
      generation_type: GenerationType
      generation_status: GenerationStatus
      plan_type: PlanType
      transaction_type: TransactionType
      language_type: LanguageType
    }
  }
}

// Helper types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert']
export type SubscriptionUpdate = Database['public']['Tables']['subscriptions']['Update']

export type UserCredits = Database['public']['Tables']['user_credits']['Row']
export type UserCreditsInsert = Database['public']['Tables']['user_credits']['Insert']
export type UserCreditsUpdate = Database['public']['Tables']['user_credits']['Update']

export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row']
export type CreditTransactionInsert = Database['public']['Tables']['credit_transactions']['Insert']

export type Generation = Database['public']['Tables']['generations']['Row']
export type GenerationInsert = Database['public']['Tables']['generations']['Insert']
export type GenerationUpdate = Database['public']['Tables']['generations']['Update']

export type Favorite = Database['public']['Tables']['favorites']['Row']
export type FavoriteInsert = Database['public']['Tables']['favorites']['Insert']

export type SavedPrompt = Database['public']['Tables']['saved_prompts']['Row']
export type SavedPromptInsert = Database['public']['Tables']['saved_prompts']['Insert']
export type SavedPromptUpdate = Database['public']['Tables']['saved_prompts']['Update']

export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert']
export type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update']

export type UsageStats = Database['public']['Tables']['usage_stats']['Row']
export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

export type UserDashboard = Database['public']['Views']['user_dashboard']['Row']
