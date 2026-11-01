-- ============================================================
-- Tre-X full schema (rebuilt from the Oct 20 2026 production dump
-- ). Safe to run on a fresh Postgres database:
--   psql "$DATABASE_URL" -f schema.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------- TABLES ----------
CREATE TABLE IF NOT EXISTS banks (
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(20) NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
    id integer NOT NULL,
    service_id uuid NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    booking_date date NOT NULL,
    booking_time time without time zone NOT NULL,
    message text,
    platform_fee numeric(10,2) DEFAULT 2.00 NOT NULL,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    payment_reference text,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    service_option_name character varying(200),
    service_amount numeric(10,2) DEFAULT 0 NOT NULL,
    buyer_fee numeric(10,2) DEFAULT 0 NOT NULL,
    seller_fee numeric(10,2) DEFAULT 0 NOT NULL,
    seller_earnings numeric(10,2) DEFAULT 0 NOT NULL,
    duration_minutes integer,
    starting_notified boolean DEFAULT false,
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);
CREATE TABLE IF NOT EXISTS boosts (
    id integer NOT NULL,
    product_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    tier text NOT NULL,
    amount numeric(10,2) NOT NULL,
    payment_reference text NOT NULL,
    status text DEFAULT 'pending_payment'::text NOT NULL,
    boosted_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS business_profiles (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    profile_url text NOT NULL,
    slug text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS buyer_delivery_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    location text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lat double precision,
    lng double precision
);
CREATE TABLE IF NOT EXISTS calls (
    id integer NOT NULL,
    caller_id uuid NOT NULL,
    callee_id uuid NOT NULL,
    status text DEFAULT 'ringing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calls_status_check CHECK ((status = ANY (ARRAY['ringing'::text, 'delivered'::text, 'answered'::text, 'declined'::text, 'ended'::text, 'missed'::text])))
);
CREATE TABLE IF NOT EXISTS categories (
    id integer NOT NULL,
    name character varying(80) NOT NULL
);
CREATE TABLE IF NOT EXISTS chat_wallpaper_overrides (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hidden boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS chat_wallpapers (
    conversation_id uuid NOT NULL,
    wallpaper_type text DEFAULT 'none'::text NOT NULL,
    wallpaper_value text,
    updated_at timestamp with time zone DEFAULT now(),
    set_by uuid
);
CREATE TABLE IF NOT EXISTS conversation_deletions (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    product_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp without time zone DEFAULT now(),
    deleted_for_everyone_at timestamp with time zone,
    deleted_for_everyone_by uuid,
    allow_replies boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS data_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    network character varying(20) NOT NULL,
    gb_amount numeric(6,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS data_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    bundle_id uuid,
    network character varying(20) NOT NULL,
    gb_amount numeric(6,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    buyer_momo_number character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS email_otps (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    code character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS fee_payments (
    id integer NOT NULL,
    reference text NOT NULL,
    seller_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> following_id))
);
CREATE TABLE IF NOT EXISTS message_deletions (
    message_id integer NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS messages (
    id integer NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    media_type text DEFAULT 'text'::text,
    updated_at timestamp without time zone DEFAULT now(),
    media_url text,
    deleted_for_everyone boolean DEFAULT false NOT NULL,
    reply_story_media_url text,
    reply_story_media_type text,
    reply_story_id integer,
    reply_story_owner_id uuid
);
CREATE TABLE IF NOT EXISTS notifications (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    type character varying(50) NOT NULL,
    message text NOT NULL,
    related_id text,
    read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    link text,
    pushed boolean DEFAULT true NOT NULL,
    push_title text,
    push_body text,
    sender_id uuid
);
CREATE TABLE IF NOT EXISTS order_items (
    id integer NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    seller_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_at_purchase numeric(10,2) NOT NULL,
    platform_fee numeric(10,2) DEFAULT 0 NOT NULL,
    seller_earnings numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_net_profit numeric(10,2) DEFAULT 0,
    buyer_confirmed_at timestamp without time zone,
    admin_delivery_share numeric DEFAULT 0,
    cancelled_at timestamp with time zone,
    delivered_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    delivery_method character varying(20) DEFAULT 'pickup'::character varying NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    delivery_fee numeric(10,2) DEFAULT 0 NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    payment_reference character varying(100),
    credit_applied numeric(10,2) DEFAULT 0 NOT NULL,
    delivered_by_seller_id uuid,
    delivered_at timestamp without time zone,
    last_delivery_reminder_at timestamp without time zone,
    paystack_amount numeric(10,2),
    overdue_flagged_at timestamp without time zone,
    delivery_fee_full numeric,
    cancelled_by_seller_id uuid,
    cancelled_at timestamp with time zone,
    paystack_refunded numeric(12,2) DEFAULT 0,
    credit_refunded numeric(12,2) DEFAULT 0,
    reported_at timestamp with time zone,
    flagged_overdue_at timestamp with time zone,
    delivery_sms_reminder_sent boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS payout_withdrawals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    account_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'processing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reported_at timestamp with time zone,
    report_message text,
    transfer_reference text,
    transfer_code text,
    failure_reason text,
    updated_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_images (
    id integer NOT NULL,
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
CREATE TABLE IF NOT EXISTS product_review_comments (
    id integer NOT NULL,
    review_id integer,
    commenter_id uuid,
    commenter_name text,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_review_likes (
    id integer NOT NULL,
    review_id integer,
    user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product_reviews (
    id integer NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now(),
    image_url text,
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
CREATE TABLE IF NOT EXISTS product_views (
    id integer NOT NULL,
    product_id uuid,
    user_id uuid,
    viewed_at timestamp without time zone DEFAULT now(),
    anon_id text
);
CREATE TABLE IF NOT EXISTS products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    title character varying(200) NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    condition character varying(20) DEFAULT 'good'::character varying NOT NULL,
    category_id integer,
    stock integer DEFAULT 1 NOT NULL,
    primary_image text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rating numeric(3,2) DEFAULT 0,
    review_count integer DEFAULT 0,
    video_url text,
    images text[],
    video text,
    status text DEFAULT 'active'::text,
    views integer DEFAULT 0,
    updated_at timestamp without time zone DEFAULT now(),
    delivery_fee_on_campus numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_fee_near_campus numeric(10,2) DEFAULT 0 NOT NULL,
    delivery_fee_far_campus numeric(10,2) DEFAULT 0 NOT NULL,
    old_price numeric(10,2),
    network character varying(20),
    views_count integer DEFAULT 0 NOT NULL,
    service_duration text,
    price_max numeric,
    boosted_until timestamp with time zone,
    boost_tier text,
    restocked_at timestamp with time zone,
    subcategory text,
    service_options jsonb DEFAULT '[]'::jsonb,
    service_type_id integer,
    CONSTRAINT chk_delivery_fee_far_campus CHECK (((delivery_fee_far_campus >= (0)::numeric) AND (delivery_fee_far_campus <= (40)::numeric))),
    CONSTRAINT chk_delivery_fee_near_campus CHECK (((delivery_fee_near_campus >= (0)::numeric) AND (delivery_fee_near_campus <= (40)::numeric))),
    CONSTRAINT chk_delivery_fee_on_campus CHECK (((delivery_fee_on_campus >= (0)::numeric) AND (delivery_fee_on_campus <= (40)::numeric)))
);
CREATE TABLE IF NOT EXISTS referrals (
    id integer NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    reported_user_id uuid,
    product_id uuid,
    reason character varying(50) NOT NULL,
    details text,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    order_id text
);
CREATE TABLE IF NOT EXISTS review_comments (
    id integer NOT NULL,
    review_id integer NOT NULL,
    commenter_id uuid NOT NULL,
    commenter_name character varying(120) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS review_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS review_skips (
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
    id integer NOT NULL,
    seller_id uuid NOT NULL,
    reviewer_id uuid,
    reviewer_name character varying(120),
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
CREATE TABLE IF NOT EXISTS saved_searches (
    id integer NOT NULL,
    buyer_id uuid,
    keyword text,
    category text,
    school text,
    created_at timestamp with time zone DEFAULT now(),
    price_min numeric(10,2),
    price_max numeric(10,2),
    verified_only boolean DEFAULT false,
    filter_type text,
    service_type text
);
CREATE TABLE IF NOT EXISTS seller_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    amount_due numeric(10,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(10,2) DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS seller_payout_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    method character varying(20) DEFAULT 'bank'::character varying NOT NULL,
    bank_code character varying(20) NOT NULL,
    bank_name character varying(120) NOT NULL,
    account_number character varying(20) NOT NULL,
    account_name character varying(120) NOT NULL,
    paystack_recipient_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_default boolean DEFAULT false
);
CREATE TABLE IF NOT EXISTS seller_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    milestone integer NOT NULL,
    reward_percentage numeric(5,2) DEFAULT 0.5 NOT NULL,
    reward_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS service_types (
    id integer NOT NULL,
    label text NOT NULL,
    normalized text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    canonical_id integer,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS stories (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    media_url text NOT NULL,
    media_type character varying(10) NOT NULL,
    caption text,
    created_at timestamp without time zone DEFAULT now(),
    expires_at timestamp without time zone DEFAULT (now() + '24:00:00'::interval),
    content_type text,
    trim_start_ms integer,
    trim_end_ms integer,
    export_count integer DEFAULT 0,
    kind text DEFAULT 'story'::text NOT NULL,
    crop jsonb,
    product_tag jsonb,
    text_overlay jsonb,
    comments_off boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    music_url text
);
CREATE TABLE IF NOT EXISTS story_comment_likes (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS story_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    pinned boolean DEFAULT false NOT NULL
);
CREATE TABLE IF NOT EXISTS story_hidden (
    user_id uuid NOT NULL,
    story_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS story_likes (
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS story_reports (
    id integer NOT NULL,
    story_id text NOT NULL,
    reporter_id text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS story_reposts (
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS story_views (
    story_id integer NOT NULL,
    viewer_id uuid NOT NULL,
    viewed_at timestamp without time zone DEFAULT now()
);
CREATE TABLE IF NOT EXISTS subscriptions (
    id integer NOT NULL,
    user_id uuid,
    plan text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paystack_reference text,
    paystack_subscription_code text,
    amount integer NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    authorization_code text,
    renewal_warning_sent_at timestamp without time zone
);
CREATE TABLE IF NOT EXISTS support_requests (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_reply text,
    replied_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    university_email character varying(180) NOT NULL,
    password_hash text NOT NULL,
    school character varying(80),
    role character varying(20) DEFAULT 'user'::character varying NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    avatar_url text,
    about text,
    personal_email character varying(180),
    whatsapp character varying(30),
    location character varying(120),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    account_type character varying(20) DEFAULT 'buyer'::character varying NOT NULL,
    verification_code character varying(6),
    verification_code_expires timestamp with time zone,
    verification_attempts integer DEFAULT 0 NOT NULL,
    verification_last_sent_at timestamp with time zone,
    password_reset_code character varying(6),
    password_reset_code_expires timestamp with time zone,
    password_reset_attempts integer DEFAULT 0 NOT NULL,
    password_reset_last_sent_at timestamp with time zone,
    profile_updated_at timestamp with time zone,
    banned boolean DEFAULT false NOT NULL,
    last_active timestamp with time zone,
    referral_code character varying(10),
    referred_by uuid,
    credit_balance numeric(10,2) DEFAULT 0 NOT NULL,
    last_active_at timestamp without time zone DEFAULT now(),
    meeting_place text,
    is_data_seller boolean DEFAULT false NOT NULL,
    plan character varying(20) DEFAULT 'free'::character varying,
    plan_expires_at timestamp without time zone,
    payment_customer_id character varying(100) DEFAULT NULL::character varying,
    username text,
    pending_plan text,
    social_whatsapp text,
    social_instagram text,
    social_snapchat text,
    social_facebook text,
    social_twitter text,
    social_telegram text,
    social_tiktok text,
    sms_number character varying(20),
    notify_messages boolean DEFAULT true,
    session_id text,
    plan_discount_expires_at timestamp with time zone,
    push_token text,
    location_lat double precision,
    location_lng double precision,
    cover_url text,
    spotlight_bio character varying(140),
    notifications_muted boolean DEFAULT false NOT NULL,
    services_paused_until timestamp with time zone
);
CREATE TABLE IF NOT EXISTS wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- ---------- SEQUENCES ----------
CREATE SEQUENCE IF NOT EXISTS bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS boosts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS business_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS email_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS fee_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS product_review_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS product_review_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS product_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS product_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS review_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS saved_searches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS service_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS stories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS story_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE SEQUENCE IF NOT EXISTS support_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE bookings_id_seq OWNED BY bookings.id;
ALTER SEQUENCE boosts_id_seq OWNED BY boosts.id;
ALTER SEQUENCE business_profiles_id_seq OWNED BY business_profiles.id;
ALTER SEQUENCE calls_id_seq OWNED BY calls.id;
ALTER SEQUENCE categories_id_seq OWNED BY categories.id;
ALTER SEQUENCE email_otps_id_seq OWNED BY email_otps.id;
ALTER SEQUENCE fee_payments_id_seq OWNED BY fee_payments.id;
ALTER SEQUENCE messages_id_seq OWNED BY messages.id;
ALTER SEQUENCE notifications_id_seq OWNED BY notifications.id;
ALTER SEQUENCE order_items_id_seq OWNED BY order_items.id;
ALTER SEQUENCE product_images_id_seq OWNED BY product_images.id;
ALTER SEQUENCE product_review_comments_id_seq OWNED BY product_review_comments.id;
ALTER SEQUENCE product_review_likes_id_seq OWNED BY product_review_likes.id;
ALTER SEQUENCE product_reviews_id_seq OWNED BY product_reviews.id;
ALTER SEQUENCE product_views_id_seq OWNED BY product_views.id;
ALTER SEQUENCE referrals_id_seq OWNED BY referrals.id;
ALTER SEQUENCE review_comments_id_seq OWNED BY review_comments.id;
ALTER SEQUENCE reviews_id_seq OWNED BY reviews.id;
ALTER SEQUENCE saved_searches_id_seq OWNED BY saved_searches.id;
ALTER SEQUENCE service_types_id_seq OWNED BY service_types.id;
ALTER SEQUENCE stories_id_seq OWNED BY stories.id;
ALTER SEQUENCE story_reports_id_seq OWNED BY story_reports.id;
ALTER SEQUENCE subscriptions_id_seq OWNED BY subscriptions.id;
ALTER SEQUENCE support_requests_id_seq OWNED BY support_requests.id;

-- ---------- COLUMN DEFAULTS ----------
ALTER TABLE bookings ALTER COLUMN id SET DEFAULT nextval('bookings_id_seq'::regclass);
ALTER TABLE boosts ALTER COLUMN id SET DEFAULT nextval('boosts_id_seq'::regclass);
ALTER TABLE business_profiles ALTER COLUMN id SET DEFAULT nextval('business_profiles_id_seq'::regclass);
ALTER TABLE calls ALTER COLUMN id SET DEFAULT nextval('calls_id_seq'::regclass);
ALTER TABLE categories ALTER COLUMN id SET DEFAULT nextval('categories_id_seq'::regclass);
ALTER TABLE email_otps ALTER COLUMN id SET DEFAULT nextval('email_otps_id_seq'::regclass);
ALTER TABLE fee_payments ALTER COLUMN id SET DEFAULT nextval('fee_payments_id_seq'::regclass);
ALTER TABLE messages ALTER COLUMN id SET DEFAULT nextval('messages_id_seq'::regclass);
ALTER TABLE notifications ALTER COLUMN id SET DEFAULT nextval('notifications_id_seq'::regclass);
ALTER TABLE order_items ALTER COLUMN id SET DEFAULT nextval('order_items_id_seq'::regclass);
ALTER TABLE product_images ALTER COLUMN id SET DEFAULT nextval('product_images_id_seq'::regclass);
ALTER TABLE product_review_comments ALTER COLUMN id SET DEFAULT nextval('product_review_comments_id_seq'::regclass);
ALTER TABLE product_review_likes ALTER COLUMN id SET DEFAULT nextval('product_review_likes_id_seq'::regclass);
ALTER TABLE product_reviews ALTER COLUMN id SET DEFAULT nextval('product_reviews_id_seq'::regclass);
ALTER TABLE product_views ALTER COLUMN id SET DEFAULT nextval('product_views_id_seq'::regclass);
ALTER TABLE referrals ALTER COLUMN id SET DEFAULT nextval('referrals_id_seq'::regclass);
ALTER TABLE review_comments ALTER COLUMN id SET DEFAULT nextval('review_comments_id_seq'::regclass);
ALTER TABLE reviews ALTER COLUMN id SET DEFAULT nextval('reviews_id_seq'::regclass);
ALTER TABLE saved_searches ALTER COLUMN id SET DEFAULT nextval('saved_searches_id_seq'::regclass);
ALTER TABLE service_types ALTER COLUMN id SET DEFAULT nextval('service_types_id_seq'::regclass);
ALTER TABLE stories ALTER COLUMN id SET DEFAULT nextval('stories_id_seq'::regclass);
ALTER TABLE story_reports ALTER COLUMN id SET DEFAULT nextval('story_reports_id_seq'::regclass);
ALTER TABLE subscriptions ALTER COLUMN id SET DEFAULT nextval('subscriptions_id_seq'::regclass);
ALTER TABLE support_requests ALTER COLUMN id SET DEFAULT nextval('support_requests_id_seq'::regclass);

-- ---------- PRIMARY KEYS / UNIQUE / CHECK ----------
DO $$ BEGIN
  ALTER TABLE banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (code);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_payment_reference_key UNIQUE (payment_reference);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE boosts
    ADD CONSTRAINT boosts_payment_reference_key UNIQUE (payment_reference);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE boosts
    ADD CONSTRAINT boosts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE business_profiles
    ADD CONSTRAINT business_profiles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE business_profiles
    ADD CONSTRAINT business_profiles_profile_url_key UNIQUE (profile_url);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE business_profiles
    ADD CONSTRAINT business_profiles_slug_key UNIQUE (slug);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE business_profiles
    ADD CONSTRAINT business_profiles_user_id_key UNIQUE (user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE buyer_delivery_locations
    ADD CONSTRAINT buyer_delivery_locations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_pkey PRIMARY KEY (conversation_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_pkey PRIMARY KEY (conversation_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversation_deletions
    ADD CONSTRAINT conversation_deletions_pkey PRIMARY KEY (conversation_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_buyer_id_seller_id_product_id_key UNIQUE (buyer_id, seller_id, product_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_bundles
    ADD CONSTRAINT data_bundles_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_orders
    ADD CONSTRAINT data_orders_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE email_otps
    ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE fee_payments
    ADD CONSTRAINT fee_payments_reference_key UNIQUE (reference);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE message_deletions
    ADD CONSTRAINT message_deletions_pkey PRIMARY KEY (message_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_payment_reference_key UNIQUE (payment_reference);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_comments
    ADD CONSTRAINT product_review_comments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_likes
    ADD CONSTRAINT product_review_likes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_likes
    ADD CONSTRAINT product_review_likes_review_id_user_id_key UNIQUE (review_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_reviews
    ADD CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_views
    ADD CONSTRAINT product_views_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_views
    ADD CONSTRAINT product_views_product_id_user_id_key UNIQUE (product_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_comments
    ADD CONSTRAINT review_comments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_likes
    ADD CONSTRAINT review_likes_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_likes
    ADD CONSTRAINT review_likes_review_id_user_id_key UNIQUE (review_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_skips
    ADD CONSTRAINT review_skips_pkey PRIMARY KEY (buyer_id, seller_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_seller_reviewer_unique UNIQUE (seller_id, reviewer_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE saved_searches
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_payments
    ADD CONSTRAINT seller_payments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_payments
    ADD CONSTRAINT seller_payments_seller_id_period_start_period_end_key UNIQUE (seller_id, period_start, period_end);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_payout_accounts
    ADD CONSTRAINT seller_payout_accounts_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_rewards
    ADD CONSTRAINT seller_rewards_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_rewards
    ADD CONSTRAINT seller_rewards_seller_id_milestone_key UNIQUE (seller_id, milestone);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE service_types
    ADD CONSTRAINT service_types_normalized_key UNIQUE (normalized);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comment_likes
    ADD CONSTRAINT story_comment_likes_pkey PRIMARY KEY (comment_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comments
    ADD CONSTRAINT story_comments_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_hidden
    ADD CONSTRAINT story_hidden_pkey PRIMARY KEY (user_id, story_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_likes
    ADD CONSTRAINT story_likes_pkey PRIMARY KEY (story_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_reports
    ADD CONSTRAINT story_reports_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_reports
    ADD CONSTRAINT story_reports_story_id_reporter_id_key UNIQUE (story_id, reporter_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_reposts
    ADD CONSTRAINT story_reposts_pkey PRIMARY KEY (story_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_views
    ADD CONSTRAINT story_views_pkey PRIMARY KEY (story_id, viewer_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_paystack_reference_key UNIQUE (paystack_reference);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_university_email_key UNIQUE (university_email);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_username_key UNIQUE (username);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON bookings USING btree (buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_reference ON bookings USING btree (payment_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_seller_id ON bookings USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON bookings USING btree (service_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings USING btree (service_id, booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings USING btree (status);
CREATE INDEX IF NOT EXISTS idx_business_profiles_slug ON business_profiles USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_business_profiles_user_id ON business_profiles USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations USING btree (buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_data_bundles_seller_id ON data_bundles USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_data_orders_buyer_id ON data_orders USING btree (buyer_id);
CREATE INDEX IF NOT EXISTS idx_data_orders_seller_id ON data_orders USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows USING btree (following_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages USING btree (conversation_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications USING btree (read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders USING btree (buyer_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON reports USING btree (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reviews_seller_id ON reviews USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payments_seller_id ON seller_payments USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payout_accounts_seller_id ON seller_payout_accounts USING btree (seller_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_story ON story_comments USING btree (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests USING btree (status);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON wishlist_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON wishlist_items USING btree (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS payout_withdrawals_ref_idx ON payout_withdrawals USING btree (transfer_reference) WHERE (transfer_reference IS NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS product_views_product_anon_key ON product_views USING btree (product_id, anon_id) WHERE (anon_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS service_types_trgm ON service_types USING gin (normalized gin_trgm_ops);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_booking_slot ON bookings USING btree (service_id, booking_date, booking_time) WHERE (status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text]));
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key ON users (LOWER(username)) WHERE username IS NOT NULL;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS music_url text;

-- ---------- FOREIGN KEYS ----------
DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE boosts
    ADD CONSTRAINT boosts_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE boosts
    ADD CONSTRAINT boosts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE business_profiles
    ADD CONSTRAINT business_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE buyer_delivery_locations
    ADD CONSTRAINT buyer_delivery_locations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE calls
    ADD CONSTRAINT calls_callee_id_fkey FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE calls
    ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_set_by_fkey FOREIGN KEY (set_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversation_deletions
    ADD CONSTRAINT conversation_deletions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversation_deletions
    ADD CONSTRAINT conversation_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_deleted_for_everyone_by_fkey FOREIGN KEY (deleted_for_everyone_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_bundles
    ADD CONSTRAINT data_bundles_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_orders
    ADD CONSTRAINT data_orders_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES data_bundles(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_orders
    ADD CONSTRAINT data_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE data_orders
    ADD CONSTRAINT data_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE email_otps
    ADD CONSTRAINT email_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE message_deletions
    ADD CONSTRAINT message_deletions_message_id_fkey FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE message_deletions
    ADD CONSTRAINT message_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE order_items
    ADD CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE orders
    ADD CONSTRAINT orders_delivered_by_seller_id_fkey FOREIGN KEY (delivered_by_seller_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_account_id_fkey FOREIGN KEY (account_id) REFERENCES seller_payout_accounts(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_comments
    ADD CONSTRAINT product_review_comments_commenter_id_fkey FOREIGN KEY (commenter_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_comments
    ADD CONSTRAINT product_review_comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_likes
    ADD CONSTRAINT product_review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES product_reviews(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_review_likes
    ADD CONSTRAINT product_review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_views
    ADD CONSTRAINT product_views_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE product_views
    ADD CONSTRAINT product_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE products
    ADD CONSTRAINT products_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES service_types(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reports
    ADD CONSTRAINT reports_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_comments
    ADD CONSTRAINT review_comments_commenter_id_fkey FOREIGN KEY (commenter_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_comments
    ADD CONSTRAINT review_comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_likes
    ADD CONSTRAINT review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_likes
    ADD CONSTRAINT review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_skips
    ADD CONSTRAINT review_skips_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE review_skips
    ADD CONSTRAINT review_skips_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE reviews
    ADD CONSTRAINT reviews_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE saved_searches
    ADD CONSTRAINT saved_searches_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_payments
    ADD CONSTRAINT seller_payments_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_payout_accounts
    ADD CONSTRAINT seller_payout_accounts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE seller_rewards
    ADD CONSTRAINT seller_rewards_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE service_types
    ADD CONSTRAINT service_types_canonical_id_fkey FOREIGN KEY (canonical_id) REFERENCES service_types(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE stories
    ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comment_likes
    ADD CONSTRAINT story_comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES story_comments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comment_likes
    ADD CONSTRAINT story_comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comments
    ADD CONSTRAINT story_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES story_comments(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comments
    ADD CONSTRAINT story_comments_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_comments
    ADD CONSTRAINT story_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_hidden
    ADD CONSTRAINT story_hidden_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_hidden
    ADD CONSTRAINT story_hidden_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_likes
    ADD CONSTRAINT story_likes_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_likes
    ADD CONSTRAINT story_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_reposts
    ADD CONSTRAINT story_reposts_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_reposts
    ADD CONSTRAINT story_reposts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_views
    ADD CONSTRAINT story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE story_views
    ADD CONSTRAINT story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE support_requests
    ADD CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

-- ---------- REFERENCE DATA ----------
INSERT INTO banks (code, name, type) VALUES
  ('MTN', 'MTN Mobile Money', 'mobile_money'),
  ('VOD', 'Vodafone Cash', 'mobile_money'),
  ('AT', 'AirtelTigo Money', 'mobile_money'),
  ('030100', 'Absa Bank Ghana Ltd', 'bank'),
  ('280100', 'Access Bank', 'bank'),
  ('080100', 'ADB Bank Limited', 'bank'),
  ('300345', 'Adehyeman Savings and Loans LTD', 'bank'),
  ('300341', 'Affinity Ghana Savings and Loans', 'bank'),
  ('070101', 'ARB Apex Bank', 'bank'),
  ('210100', 'Bank of Africa Ghana', 'bank'),
  ('300335', 'Best Point Savings & Loans', 'bank'),
  ('140100', 'CAL Bank Limited', 'bank'),
  ('340100', 'Consolidated Bank Ghana Limited', 'bank'),
  ('130100', 'Ecobank Ghana Limited', 'bank'),
  ('200100', 'FBNBank Ghana Limited', 'bank'),
  ('240100', 'Fidelity Bank Ghana Limited', 'bank'),
  ('170100', 'First Atlantic Bank Limited', 'bank'),
  ('330100', 'First National Bank Ghana Limited', 'bank'),
  ('040100', 'GCB Bank Limited', 'bank'),
  ('230100', 'Guaranty Trust Bank (Ghana) Limited', 'bank'),
  ('050100', 'National Investment Bank Limited', 'bank'),
  ('360100', 'OmniBSCI Bank', 'bank'),
  ('180100', 'Prudential Bank Limited', 'bank'),
  ('110100', 'Republic Bank (GH) Limited', 'bank'),
  ('300361', 'Services Integrity Savings and Loans', 'bank'),
  ('240092', 'Sinapi ABA Savings And Loans', 'bank'),
  ('090100', 'Société Générale Ghana Limited', 'bank'),
  ('190100', 'Stanbic Bank Ghana Limited', 'bank'),
  ('020100', 'Standard Chartered Bank Ghana Limited', 'bank'),
  ('060100', 'United Bank for Africa Ghana Limited', 'bank'),
  ('100100', 'Universal Merchant Bank Ghana Limited', 'bank'),
  ('120100', 'Zenith Bank Ghana', 'bank')
ON CONFLICT (code) DO NOTHING;
INSERT INTO categories (id, name) VALUES
  (1, 'Clothes'),
  (3, 'Stationery'),
  (5, 'Perfumes'),
  (6, 'Food'),
  (7, 'Sneakers'),
  (8, 'Other'),
  (2, 'Gadgets'),
  (81, 'Mobile Data'),
  (82, 'Services'),
  (83, 'Bags'),
  (84, 'Books'),
  (85, 'Beauty & Skincare'),
  (86, 'Hair & Wigs'),
  (87, 'Jewelry & Watches'),
  (88, 'Groceries'),
  (89, 'Room Essentials'),
  (90, 'Furniture'),
  (91, 'Appliances'),
  (92, 'Sports & Fitness'),
  (93, 'Music & Instruments'),
  (94, 'Tickets & Events')
ON CONFLICT (name) DO NOTHING;
SELECT setval('categories_id_seq', (SELECT COALESCE(MAX(id),1) FROM categories));
INSERT INTO service_types (id, label, normalized, status, canonical_id) VALUES
  (1, 'Makeup', 'makeup', 'approved', NULL),
  (2, 'Nail fixing', 'nail fixing', 'approved', NULL),
  (3, 'Hair styling/braiding', 'hair styling braiding', 'approved', NULL),
  (4, 'Printing & photocopying', 'printing and photocopying', 'approved', NULL),
  (5, 'Graphic design', 'graphic design', 'approved', NULL),
  (6, 'Website development', 'website development', 'approved', NULL),
  (7, 'Photography', 'photography', 'approved', NULL),
  (8, 'Haircuts/barbering', 'haircut barbering', 'approved', NULL),
  (9, 'Errand running', 'errand running', 'approved', NULL),
  (10, 'Video recording/editing', 'video recording editing', 'approved', NULL),
  (11, 'Custom T-shirts/hoodies', 'custom t shirt hoodie', 'approved', NULL),
  (12, 'Mobile app development', 'mobile app development', 'approved', NULL),
  (13, 'Pickup & delivery', 'pickup and delivery', 'approved', NULL),
  (14, 'Tutoring/lessons', 'tutoring lesson', 'approved', NULL),
  (15, 'Laundry', 'laundry', 'approved', NULL),
  (16, 'Phone/laptop repair', 'phone laptop repair', 'approved', NULL),
  (17, 'Event planning/MC', 'event planning mc', 'approved', NULL),
  (18, 'Cleaning services', 'cleaning service', 'approved', NULL),
  (19, 'Tailoring/sewing', 'tailoring sewing', 'approved', NULL),
  (20, 'Max do bc chi', 'max do bc chi', 'pending', NULL)
ON CONFLICT (normalized) DO NOTHING;
SELECT setval('service_types_id_seq', (SELECT COALESCE(MAX(id),1) FROM service_types));