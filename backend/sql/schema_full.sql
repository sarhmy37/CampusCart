--
-- PostgreSQL database dump
--

-- Dumped from database version 17.12 (Debian 17.12-1.pgdg12+1)
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: banks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.banks (
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(20) NOT NULL
);
ALTER TABLE ONLY public.banks ALTER COLUMN code SET (pg_attver=37842896);
ALTER TABLE ONLY public.banks ALTER COLUMN name SET (pg_attver=37842896);
ALTER TABLE ONLY public.banks ALTER COLUMN type SET (pg_attver=37842896);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
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
    reply_deadline_hours integer,
    reply_deadline_at timestamp with time zone,
    refund_status text DEFAULT 'not_requested'::text,
    provider_first_reply_at timestamp with time zone,
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text, 'completed'::text, 'cancelled'::text, 'no_show'::text])))
);
ALTER TABLE ONLY public.bookings ALTER COLUMN id SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN service_id SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN buyer_id SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN seller_id SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN booking_date SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN booking_time SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN message SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN platform_fee SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN status SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN payment_reference SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN paid_at SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN created_at SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN updated_at SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN service_option_name SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN service_amount SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN buyer_fee SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN seller_fee SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN seller_earnings SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN duration_minutes SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN starting_notified SET (pg_attver=37860968);
ALTER TABLE ONLY public.bookings ALTER COLUMN reply_deadline_hours SET (pg_attver=41999008);
ALTER TABLE ONLY public.bookings ALTER COLUMN reply_deadline_at SET (pg_attver=42026328);
ALTER TABLE ONLY public.bookings ALTER COLUMN refund_status SET (pg_attver=42060040);
ALTER TABLE ONLY public.bookings ALTER COLUMN provider_first_reply_at SET (pg_attver=42108360);


--
-- Name: bookings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.bookings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bookings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.bookings_id_seq OWNED BY public.bookings.id;


--
-- Name: boosts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boosts (
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
ALTER TABLE ONLY public.boosts ALTER COLUMN id SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN product_id SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN seller_id SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN tier SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN amount SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN payment_reference SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN status SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN boosted_until SET (pg_attver=37957648);
ALTER TABLE ONLY public.boosts ALTER COLUMN created_at SET (pg_attver=37957648);


--
-- Name: boosts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.boosts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: boosts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.boosts_id_seq OWNED BY public.boosts.id;


--
-- Name: business_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_profiles (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    profile_url text NOT NULL,
    slug text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN id SET (pg_attver=37981080);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN user_id SET (pg_attver=37981080);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN profile_url SET (pg_attver=37981080);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN slug SET (pg_attver=37981080);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN created_at SET (pg_attver=37981080);
ALTER TABLE ONLY public.business_profiles ALTER COLUMN updated_at SET (pg_attver=37981080);


--
-- Name: business_profiles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.business_profiles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: business_profiles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.business_profiles_id_seq OWNED BY public.business_profiles.id;


--
-- Name: buyer_delivery_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.buyer_delivery_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    location text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    lat double precision,
    lng double precision
);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN id SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN buyer_id SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN location SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN is_default SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN created_at SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN lat SET (pg_attver=37999944);
ALTER TABLE ONLY public.buyer_delivery_locations ALTER COLUMN lng SET (pg_attver=37999944);


--
-- Name: calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calls (
    id integer NOT NULL,
    caller_id uuid NOT NULL,
    callee_id uuid NOT NULL,
    status text DEFAULT 'ringing'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT calls_status_check CHECK ((status = ANY (ARRAY['ringing'::text, 'delivered'::text, 'answered'::text, 'declined'::text, 'ended'::text, 'missed'::text])))
);
ALTER TABLE ONLY public.calls ALTER COLUMN id SET (pg_attver=38015264);
ALTER TABLE ONLY public.calls ALTER COLUMN caller_id SET (pg_attver=38015264);
ALTER TABLE ONLY public.calls ALTER COLUMN callee_id SET (pg_attver=38015264);
ALTER TABLE ONLY public.calls ALTER COLUMN status SET (pg_attver=38015264);
ALTER TABLE ONLY public.calls ALTER COLUMN created_at SET (pg_attver=38015264);


--
-- Name: calls_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.calls_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: calls_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.calls_id_seq OWNED BY public.calls.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name character varying(80) NOT NULL
);
ALTER TABLE ONLY public.categories ALTER COLUMN id SET (pg_attver=38037096);
ALTER TABLE ONLY public.categories ALTER COLUMN name SET (pg_attver=38037096);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: chat_wallpaper_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_wallpaper_overrides (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    hidden boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.chat_wallpaper_overrides ALTER COLUMN conversation_id SET (pg_attver=38050176);
ALTER TABLE ONLY public.chat_wallpaper_overrides ALTER COLUMN user_id SET (pg_attver=38050176);
ALTER TABLE ONLY public.chat_wallpaper_overrides ALTER COLUMN hidden SET (pg_attver=38050176);
ALTER TABLE ONLY public.chat_wallpaper_overrides ALTER COLUMN updated_at SET (pg_attver=38050176);


--
-- Name: chat_wallpapers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_wallpapers (
    conversation_id uuid NOT NULL,
    wallpaper_type text DEFAULT 'none'::text NOT NULL,
    wallpaper_value text,
    updated_at timestamp with time zone DEFAULT now(),
    set_by uuid
);
ALTER TABLE ONLY public.chat_wallpapers ALTER COLUMN conversation_id SET (pg_attver=38057440);
ALTER TABLE ONLY public.chat_wallpapers ALTER COLUMN wallpaper_type SET (pg_attver=38057440);
ALTER TABLE ONLY public.chat_wallpapers ALTER COLUMN wallpaper_value SET (pg_attver=38057440);
ALTER TABLE ONLY public.chat_wallpapers ALTER COLUMN updated_at SET (pg_attver=38057440);
ALTER TABLE ONLY public.chat_wallpapers ALTER COLUMN set_by SET (pg_attver=38057440);


--
-- Name: conversation_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_deletions (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.conversation_deletions ALTER COLUMN conversation_id SET (pg_attver=38071112);
ALTER TABLE ONLY public.conversation_deletions ALTER COLUMN user_id SET (pg_attver=38071112);
ALTER TABLE ONLY public.conversation_deletions ALTER COLUMN deleted_at SET (pg_attver=38071112);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    product_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_active_at timestamp without time zone DEFAULT now(),
    deleted_for_everyone_at timestamp with time zone,
    deleted_for_everyone_by uuid,
    allow_replies boolean DEFAULT false NOT NULL,
    booking_id integer
);
ALTER TABLE ONLY public.conversations ALTER COLUMN id SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN buyer_id SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN seller_id SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN product_id SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN created_at SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN last_active_at SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN deleted_for_everyone_at SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN deleted_for_everyone_by SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN allow_replies SET (pg_attver=38077072);
ALTER TABLE ONLY public.conversations ALTER COLUMN booking_id SET (pg_attver=42120712);


--
-- Name: data_bundles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_bundles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    network character varying(20) NOT NULL,
    gb_amount numeric(6,2) NOT NULL,
    price numeric(10,2) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN id SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN seller_id SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN network SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN gb_amount SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN price SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN active SET (pg_attver=38087768);
ALTER TABLE ONLY public.data_bundles ALTER COLUMN created_at SET (pg_attver=38087768);


--
-- Name: data_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_orders (
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
ALTER TABLE ONLY public.data_orders ALTER COLUMN id SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN buyer_id SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN seller_id SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN bundle_id SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN network SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN gb_amount SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN price SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN buyer_momo_number SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN status SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN created_at SET (pg_attver=38104808);
ALTER TABLE ONLY public.data_orders ALTER COLUMN delivered_at SET (pg_attver=38104808);


--
-- Name: email_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_otps (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    code character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.email_otps ALTER COLUMN id SET (pg_attver=38115368);
ALTER TABLE ONLY public.email_otps ALTER COLUMN user_id SET (pg_attver=38115368);
ALTER TABLE ONLY public.email_otps ALTER COLUMN code SET (pg_attver=38115368);
ALTER TABLE ONLY public.email_otps ALTER COLUMN expires_at SET (pg_attver=38115368);
ALTER TABLE ONLY public.email_otps ALTER COLUMN attempts SET (pg_attver=38115368);
ALTER TABLE ONLY public.email_otps ALTER COLUMN created_at SET (pg_attver=38115368);


--
-- Name: email_otps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_otps_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_otps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_otps_id_seq OWNED BY public.email_otps.id;


--
-- Name: fee_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_payments (
    id integer NOT NULL,
    reference text NOT NULL,
    seller_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone
);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN id SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN reference SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN seller_id SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN amount SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN status SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN created_at SET (pg_attver=38128448);
ALTER TABLE ONLY public.fee_payments ALTER COLUMN paid_at SET (pg_attver=38128448);


--
-- Name: fee_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_payments_id_seq OWNED BY public.fee_payments.id;


--
-- Name: follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT follows_check CHECK ((follower_id <> following_id))
);
ALTER TABLE ONLY public.follows ALTER COLUMN follower_id SET (pg_attver=38147360);
ALTER TABLE ONLY public.follows ALTER COLUMN following_id SET (pg_attver=38147360);
ALTER TABLE ONLY public.follows ALTER COLUMN created_at SET (pg_attver=38147360);


--
-- Name: message_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_deletions (
    message_id integer NOT NULL,
    user_id uuid NOT NULL,
    deleted_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.message_deletions ALTER COLUMN message_id SET (pg_attver=38155712);
ALTER TABLE ONLY public.message_deletions ALTER COLUMN user_id SET (pg_attver=38155712);
ALTER TABLE ONLY public.message_deletions ALTER COLUMN deleted_at SET (pg_attver=38155712);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
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
ALTER TABLE ONLY public.messages ALTER COLUMN id SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN conversation_id SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN sender_id SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN content SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN read SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN created_at SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN media_type SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN updated_at SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN media_url SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN deleted_for_everyone SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN reply_story_media_url SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN reply_story_media_type SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN reply_story_id SET (pg_attver=38169600);
ALTER TABLE ONLY public.messages ALTER COLUMN reply_story_owner_id SET (pg_attver=38169600);


--
-- Name: messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.messages_id_seq OWNED BY public.messages.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
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
ALTER TABLE ONLY public.notifications ALTER COLUMN id SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN user_id SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN type SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN message SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN related_id SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN read SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN created_at SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN link SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN pushed SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN push_title SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN push_body SET (pg_attver=38193360);
ALTER TABLE ONLY public.notifications ALTER COLUMN sender_id SET (pg_attver=38193360);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
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
    delivered_at timestamp with time zone,
    delivery_method text
);
ALTER TABLE ONLY public.order_items ALTER COLUMN id SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN order_id SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN product_id SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN seller_id SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN title SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN quantity SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN price_at_purchase SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN platform_fee SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN seller_earnings SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN status SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN created_at SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN admin_net_profit SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN buyer_confirmed_at SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN admin_delivery_share SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN cancelled_at SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN delivered_at SET (pg_attver=38223616);
ALTER TABLE ONLY public.order_items ALTER COLUMN delivery_method SET (pg_attver=41982704);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
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
    delivery_sms_reminder_sent boolean DEFAULT false,
    buyer_location text,
    buyer_lat double precision,
    buyer_lng double precision
);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN buyer_id SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN status SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivery_method SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN subtotal SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivery_fee SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN total_amount SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN created_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN completed_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN payment_reference SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN credit_applied SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivered_by_seller_id SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivered_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN last_delivery_reminder_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN paystack_amount SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN overdue_flagged_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivery_fee_full SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN cancelled_by_seller_id SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN cancelled_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN paystack_refunded SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN credit_refunded SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN reported_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN flagged_overdue_at SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN delivery_sms_reminder_sent SET (pg_attver=38251072);
ALTER TABLE ONLY public.orders ALTER COLUMN buyer_location SET (pg_attver=41966376);
ALTER TABLE ONLY public.orders ALTER COLUMN buyer_lat SET (pg_attver=41981776);
ALTER TABLE ONLY public.orders ALTER COLUMN buyer_lng SET (pg_attver=41982216);


--
-- Name: payout_withdrawals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payout_withdrawals (
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
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN id SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN seller_id SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN account_id SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN amount SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN status SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN created_at SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN reported_at SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN report_message SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN transfer_reference SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN transfer_code SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN failure_reason SET (pg_attver=38280016);
ALTER TABLE ONLY public.payout_withdrawals ALTER COLUMN updated_at SET (pg_attver=38280016);


--
-- Name: product_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_images (
    id integer NOT NULL,
    product_id uuid NOT NULL,
    image_url text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);
ALTER TABLE ONLY public.product_images ALTER COLUMN id SET (pg_attver=38306704);
ALTER TABLE ONLY public.product_images ALTER COLUMN product_id SET (pg_attver=38306704);
ALTER TABLE ONLY public.product_images ALTER COLUMN image_url SET (pg_attver=38306704);
ALTER TABLE ONLY public.product_images ALTER COLUMN sort_order SET (pg_attver=38306704);


--
-- Name: product_images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_images_id_seq OWNED BY public.product_images.id;


--
-- Name: product_review_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_review_comments (
    id integer NOT NULL,
    review_id integer,
    commenter_id uuid,
    commenter_name text,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN id SET (pg_attver=38820040);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN review_id SET (pg_attver=38820040);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN commenter_id SET (pg_attver=38820040);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN commenter_name SET (pg_attver=38820040);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN content SET (pg_attver=38820040);
ALTER TABLE ONLY public.product_review_comments ALTER COLUMN created_at SET (pg_attver=38820040);


--
-- Name: product_review_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_review_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_review_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_review_comments_id_seq OWNED BY public.product_review_comments.id;


--
-- Name: product_review_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_review_likes (
    id integer NOT NULL,
    review_id integer,
    user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);
ALTER TABLE ONLY public.product_review_likes ALTER COLUMN id SET (pg_attver=38838432);
ALTER TABLE ONLY public.product_review_likes ALTER COLUMN review_id SET (pg_attver=38838432);
ALTER TABLE ONLY public.product_review_likes ALTER COLUMN user_id SET (pg_attver=38838432);
ALTER TABLE ONLY public.product_review_likes ALTER COLUMN created_at SET (pg_attver=38838432);


--
-- Name: product_review_likes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_review_likes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_review_likes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_review_likes_id_seq OWNED BY public.product_review_likes.id;


--
-- Name: product_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_reviews (
    id integer NOT NULL,
    product_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp without time zone DEFAULT now(),
    image_url text,
    CONSTRAINT product_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN id SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN product_id SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN user_id SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN rating SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN comment SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN created_at SET (pg_attver=38849408);
ALTER TABLE ONLY public.product_reviews ALTER COLUMN image_url SET (pg_attver=38849408);


--
-- Name: product_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_reviews_id_seq OWNED BY public.product_reviews.id;


--
-- Name: product_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_views (
    id integer NOT NULL,
    product_id uuid,
    user_id uuid,
    viewed_at timestamp without time zone DEFAULT now(),
    anon_id text
);
ALTER TABLE ONLY public.product_views ALTER COLUMN id SET (pg_attver=38869768);
ALTER TABLE ONLY public.product_views ALTER COLUMN product_id SET (pg_attver=38869768);
ALTER TABLE ONLY public.product_views ALTER COLUMN user_id SET (pg_attver=38869768);
ALTER TABLE ONLY public.product_views ALTER COLUMN viewed_at SET (pg_attver=38869768);
ALTER TABLE ONLY public.product_views ALTER COLUMN anon_id SET (pg_attver=38869768);


--
-- Name: product_views_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_views_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_views_id_seq OWNED BY public.product_views.id;


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
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
ALTER TABLE ONLY public.products ALTER COLUMN id SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN seller_id SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN title SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN description SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN price SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN condition SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN category_id SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN stock SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN primary_image SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN created_at SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN rating SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN review_count SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN video_url SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN images SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN video SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN status SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN views SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN updated_at SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN delivery_fee_on_campus SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN delivery_fee_near_campus SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN delivery_fee_far_campus SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN old_price SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN network SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN views_count SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN service_duration SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN price_max SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN boosted_until SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN boost_tier SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN restocked_at SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN subcategory SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN service_options SET (pg_attver=38887504);
ALTER TABLE ONLY public.products ALTER COLUMN service_type_id SET (pg_attver=38887504);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id uuid NOT NULL,
    referred_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.referrals ALTER COLUMN id SET (pg_attver=38932808);
ALTER TABLE ONLY public.referrals ALTER COLUMN referrer_id SET (pg_attver=38932808);
ALTER TABLE ONLY public.referrals ALTER COLUMN referred_id SET (pg_attver=38932808);
ALTER TABLE ONLY public.referrals ALTER COLUMN created_at SET (pg_attver=38932808);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reports (
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
ALTER TABLE ONLY public.reports ALTER COLUMN id SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN reporter_id SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN reported_user_id SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN product_id SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN reason SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN details SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN status SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN created_at SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN reviewed_at SET (pg_attver=38943712);
ALTER TABLE ONLY public.reports ALTER COLUMN order_id SET (pg_attver=38943712);


--
-- Name: review_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_comments (
    id integer NOT NULL,
    review_id integer NOT NULL,
    commenter_id uuid NOT NULL,
    commenter_name character varying(120) NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.review_comments ALTER COLUMN id SET (pg_attver=38960584);
ALTER TABLE ONLY public.review_comments ALTER COLUMN review_id SET (pg_attver=38960584);
ALTER TABLE ONLY public.review_comments ALTER COLUMN commenter_id SET (pg_attver=38960584);
ALTER TABLE ONLY public.review_comments ALTER COLUMN commenter_name SET (pg_attver=38960584);
ALTER TABLE ONLY public.review_comments ALTER COLUMN content SET (pg_attver=38960584);
ALTER TABLE ONLY public.review_comments ALTER COLUMN created_at SET (pg_attver=38960584);


--
-- Name: review_comments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.review_comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: review_comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.review_comments_id_seq OWNED BY public.review_comments.id;


--
-- Name: review_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.review_likes ALTER COLUMN id SET (pg_attver=38979344);
ALTER TABLE ONLY public.review_likes ALTER COLUMN review_id SET (pg_attver=38979344);
ALTER TABLE ONLY public.review_likes ALTER COLUMN user_id SET (pg_attver=38979344);
ALTER TABLE ONLY public.review_likes ALTER COLUMN created_at SET (pg_attver=38979344);


--
-- Name: review_skips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_skips (
    buyer_id uuid NOT NULL,
    seller_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.review_skips ALTER COLUMN buyer_id SET (pg_attver=38986328);
ALTER TABLE ONLY public.review_skips ALTER COLUMN seller_id SET (pg_attver=38986328);
ALTER TABLE ONLY public.review_skips ALTER COLUMN created_at SET (pg_attver=38986328);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    seller_id uuid NOT NULL,
    reviewer_id uuid,
    reviewer_name character varying(120),
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);
ALTER TABLE ONLY public.reviews ALTER COLUMN id SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN seller_id SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN reviewer_id SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN reviewer_name SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN rating SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN comment SET (pg_attver=38992232);
ALTER TABLE ONLY public.reviews ALTER COLUMN created_at SET (pg_attver=38992232);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: saved_searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_searches (
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
ALTER TABLE ONLY public.saved_searches ALTER COLUMN id SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN buyer_id SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN keyword SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN category SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN school SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN created_at SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN price_min SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN price_max SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN verified_only SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN filter_type SET (pg_attver=39012640);
ALTER TABLE ONLY public.saved_searches ALTER COLUMN service_type SET (pg_attver=39012640);


--
-- Name: saved_searches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.saved_searches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: saved_searches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.saved_searches_id_seq OWNED BY public.saved_searches.id;


--
-- Name: seller_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_payments (
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
ALTER TABLE ONLY public.seller_payments ALTER COLUMN id SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN seller_id SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN period_start SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN period_end SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN amount_due SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN amount_paid SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN status SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN paid_at SET (pg_attver=39033632);
ALTER TABLE ONLY public.seller_payments ALTER COLUMN created_at SET (pg_attver=39033632);


--
-- Name: seller_payout_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_payout_accounts (
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
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN id SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN seller_id SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN method SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN bank_code SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN bank_name SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN account_number SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN account_name SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN paystack_recipient_code SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN created_at SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN updated_at SET (pg_attver=39046656);
ALTER TABLE ONLY public.seller_payout_accounts ALTER COLUMN is_default SET (pg_attver=39046656);


--
-- Name: seller_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seller_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    seller_id uuid NOT NULL,
    milestone integer NOT NULL,
    reward_percentage numeric(5,2) DEFAULT 0.5 NOT NULL,
    reward_amount numeric(10,2) DEFAULT 0 NOT NULL,
    credited boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN id SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN seller_id SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN milestone SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN reward_percentage SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN reward_amount SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN credited SET (pg_attver=39064864);
ALTER TABLE ONLY public.seller_rewards ALTER COLUMN created_at SET (pg_attver=39064864);


--
-- Name: service_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_types (
    id integer NOT NULL,
    label text NOT NULL,
    normalized text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    canonical_id integer,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.service_types ALTER COLUMN id SET (pg_attver=39075864);
ALTER TABLE ONLY public.service_types ALTER COLUMN label SET (pg_attver=39075864);
ALTER TABLE ONLY public.service_types ALTER COLUMN normalized SET (pg_attver=39075864);
ALTER TABLE ONLY public.service_types ALTER COLUMN status SET (pg_attver=39075864);
ALTER TABLE ONLY public.service_types ALTER COLUMN canonical_id SET (pg_attver=39075864);
ALTER TABLE ONLY public.service_types ALTER COLUMN created_at SET (pg_attver=39075864);


--
-- Name: service_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_types_id_seq OWNED BY public.service_types.id;


--
-- Name: stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stories (
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
    music_url text,
    music_start_ms integer,
    music_end_ms integer,
    allow_chat boolean,
    show_likes boolean,
    allow_repost boolean,
    allow_export boolean,
    sound_story_id integer
);
ALTER TABLE ONLY public.stories ALTER COLUMN id SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN user_id SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN media_url SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN media_type SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN caption SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN created_at SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN expires_at SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN content_type SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN trim_start_ms SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN trim_end_ms SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN export_count SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN kind SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN crop SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN product_tag SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN text_overlay SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN comments_off SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN archived_at SET (pg_attver=39094408);
ALTER TABLE ONLY public.stories ALTER COLUMN music_url SET (pg_attver=41325368);
ALTER TABLE ONLY public.stories ALTER COLUMN music_start_ms SET (pg_attver=41326056);
ALTER TABLE ONLY public.stories ALTER COLUMN music_end_ms SET (pg_attver=41326752);
ALTER TABLE ONLY public.stories ALTER COLUMN allow_chat SET (pg_attver=41843472);
ALTER TABLE ONLY public.stories ALTER COLUMN show_likes SET (pg_attver=41866840);
ALTER TABLE ONLY public.stories ALTER COLUMN allow_repost SET (pg_attver=41867280);
ALTER TABLE ONLY public.stories ALTER COLUMN allow_export SET (pg_attver=41873088);
ALTER TABLE ONLY public.stories ALTER COLUMN sound_story_id SET (pg_attver=41873536);


--
-- Name: stories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.stories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.stories_id_seq OWNED BY public.stories.id;


--
-- Name: story_comment_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_comment_likes (
    comment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.story_comment_likes ALTER COLUMN comment_id SET (pg_attver=39119568);
ALTER TABLE ONLY public.story_comment_likes ALTER COLUMN user_id SET (pg_attver=39119568);
ALTER TABLE ONLY public.story_comment_likes ALTER COLUMN created_at SET (pg_attver=39119568);


--
-- Name: story_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    text text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    parent_id uuid,
    pinned boolean DEFAULT false NOT NULL
);
ALTER TABLE ONLY public.story_comments ALTER COLUMN id SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN story_id SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN user_id SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN text SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN created_at SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN parent_id SET (pg_attver=39134584);
ALTER TABLE ONLY public.story_comments ALTER COLUMN pinned SET (pg_attver=39134584);


--
-- Name: story_exports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_exports (
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.story_exports ALTER COLUMN story_id SET (pg_attver=41606792);
ALTER TABLE ONLY public.story_exports ALTER COLUMN user_id SET (pg_attver=41606792);
ALTER TABLE ONLY public.story_exports ALTER COLUMN created_at SET (pg_attver=41606792);


--
-- Name: story_hidden; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_hidden (
    user_id uuid NOT NULL,
    story_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.story_hidden ALTER COLUMN user_id SET (pg_attver=39150088);
ALTER TABLE ONLY public.story_hidden ALTER COLUMN story_id SET (pg_attver=39150088);
ALTER TABLE ONLY public.story_hidden ALTER COLUMN created_at SET (pg_attver=39150088);


--
-- Name: story_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_likes (
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE ONLY public.story_likes ALTER COLUMN story_id SET (pg_attver=39156056);
ALTER TABLE ONLY public.story_likes ALTER COLUMN user_id SET (pg_attver=39156056);
ALTER TABLE ONLY public.story_likes ALTER COLUMN created_at SET (pg_attver=39156056);


--
-- Name: story_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_reports (
    id integer NOT NULL,
    story_id text NOT NULL,
    reporter_id text NOT NULL,
    reason text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.story_reports ALTER COLUMN id SET (pg_attver=39162008);
ALTER TABLE ONLY public.story_reports ALTER COLUMN story_id SET (pg_attver=39162008);
ALTER TABLE ONLY public.story_reports ALTER COLUMN reporter_id SET (pg_attver=39162008);
ALTER TABLE ONLY public.story_reports ALTER COLUMN reason SET (pg_attver=39162008);
ALTER TABLE ONLY public.story_reports ALTER COLUMN created_at SET (pg_attver=39162008);


--
-- Name: story_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.story_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: story_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.story_reports_id_seq OWNED BY public.story_reports.id;


--
-- Name: story_reposts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_reposts (
    story_id integer NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.story_reposts ALTER COLUMN story_id SET (pg_attver=39180024);
ALTER TABLE ONLY public.story_reposts ALTER COLUMN user_id SET (pg_attver=39180024);
ALTER TABLE ONLY public.story_reposts ALTER COLUMN created_at SET (pg_attver=39180024);


--
-- Name: story_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_views (
    story_id integer NOT NULL,
    viewer_id uuid NOT NULL,
    viewed_at timestamp without time zone DEFAULT now()
);
ALTER TABLE ONLY public.story_views ALTER COLUMN story_id SET (pg_attver=39185960);
ALTER TABLE ONLY public.story_views ALTER COLUMN viewer_id SET (pg_attver=39185960);
ALTER TABLE ONLY public.story_views ALTER COLUMN viewed_at SET (pg_attver=39185960);


--
-- Name: story_watch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_watch (
    story_id integer NOT NULL,
    viewer_id uuid NOT NULL,
    watched_ms integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    replays integer DEFAULT 0 NOT NULL,
    skipped boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.story_watch ALTER COLUMN story_id SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN viewer_id SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN watched_ms SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN duration_ms SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN completed SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN replays SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN skipped SET (pg_attver=41424984);
ALTER TABLE ONLY public.story_watch ALTER COLUMN updated_at SET (pg_attver=41957120);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
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
ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN user_id SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN plan SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN status SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN paystack_reference SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN paystack_subscription_code SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN amount SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN starts_at SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN ends_at SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN created_at SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN authorization_code SET (pg_attver=39192056);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN renewal_warning_sent_at SET (pg_attver=39192056);


--
-- Name: subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;


--
-- Name: support_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_requests (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    admin_reply text,
    replied_at timestamp with time zone
);
ALTER TABLE ONLY public.support_requests ALTER COLUMN id SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN user_id SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN message SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN status SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN created_at SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN admin_reply SET (pg_attver=39213376);
ALTER TABLE ONLY public.support_requests ALTER COLUMN replied_at SET (pg_attver=39213376);


--
-- Name: support_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_requests_id_seq OWNED BY public.support_requests.id;


--
-- Name: user_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blocks (
    blocker_id uuid NOT NULL,
    blocked_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.user_blocks ALTER COLUMN blocker_id SET (pg_attver=39232760);
ALTER TABLE ONLY public.user_blocks ALTER COLUMN blocked_id SET (pg_attver=39232760);
ALTER TABLE ONLY public.user_blocks ALTER COLUMN created_at SET (pg_attver=39232760);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
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
    services_paused_until timestamp with time zone,
    spotlight_allow_chat boolean DEFAULT true NOT NULL,
    spotlight_show_likes boolean DEFAULT true NOT NULL,
    spotlight_allow_repost boolean DEFAULT true NOT NULL,
    spotlight_allow_export boolean DEFAULT true NOT NULL
);
ALTER TABLE ONLY public.users ALTER COLUMN id SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN name SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN university_email SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN password_hash SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN school SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN role SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN verified SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN avatar_url SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN about SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN personal_email SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN whatsapp SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN location SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN created_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN account_type SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN verification_code SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN verification_code_expires SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN verification_attempts SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN verification_last_sent_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN password_reset_code SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN password_reset_code_expires SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN password_reset_attempts SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN password_reset_last_sent_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN profile_updated_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN banned SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN last_active SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN referral_code SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN referred_by SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN credit_balance SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN last_active_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN meeting_place SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN is_data_seller SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN plan SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN plan_expires_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN payment_customer_id SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN username SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN pending_plan SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_whatsapp SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_instagram SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_snapchat SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_facebook SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_twitter SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_telegram SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN social_tiktok SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN sms_number SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN notify_messages SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN session_id SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN plan_discount_expires_at SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN push_token SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN location_lat SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN location_lng SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN cover_url SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN spotlight_bio SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN notifications_muted SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN services_paused_until SET (pg_attver=39242368);
ALTER TABLE ONLY public.users ALTER COLUMN spotlight_allow_chat SET (pg_attver=41751656);
ALTER TABLE ONLY public.users ALTER COLUMN spotlight_show_likes SET (pg_attver=41839584);
ALTER TABLE ONLY public.users ALTER COLUMN spotlight_allow_repost SET (pg_attver=41840864);
ALTER TABLE ONLY public.users ALTER COLUMN spotlight_allow_export SET (pg_attver=41842144);


--
-- Name: wishlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.wishlist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE ONLY public.wishlist_items ALTER COLUMN id SET (pg_attver=39290384);
ALTER TABLE ONLY public.wishlist_items ALTER COLUMN user_id SET (pg_attver=39290384);
ALTER TABLE ONLY public.wishlist_items ALTER COLUMN product_id SET (pg_attver=39290384);
ALTER TABLE ONLY public.wishlist_items ALTER COLUMN created_at SET (pg_attver=39290384);


--
-- Name: bookings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings ALTER COLUMN id SET DEFAULT nextval('public.bookings_id_seq'::regclass);


--
-- Name: boosts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts ALTER COLUMN id SET DEFAULT nextval('public.boosts_id_seq'::regclass);


--
-- Name: business_profiles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles ALTER COLUMN id SET DEFAULT nextval('public.business_profiles_id_seq'::regclass);


--
-- Name: calls id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls ALTER COLUMN id SET DEFAULT nextval('public.calls_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: email_otps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps ALTER COLUMN id SET DEFAULT nextval('public.email_otps_id_seq'::regclass);


--
-- Name: fee_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments ALTER COLUMN id SET DEFAULT nextval('public.fee_payments_id_seq'::regclass);


--
-- Name: messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages ALTER COLUMN id SET DEFAULT nextval('public.messages_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: product_images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images ALTER COLUMN id SET DEFAULT nextval('public.product_images_id_seq'::regclass);


--
-- Name: product_review_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_comments ALTER COLUMN id SET DEFAULT nextval('public.product_review_comments_id_seq'::regclass);


--
-- Name: product_review_likes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_likes ALTER COLUMN id SET DEFAULT nextval('public.product_review_likes_id_seq'::regclass);


--
-- Name: product_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews ALTER COLUMN id SET DEFAULT nextval('public.product_reviews_id_seq'::regclass);


--
-- Name: product_views id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views ALTER COLUMN id SET DEFAULT nextval('public.product_views_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: review_comments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_comments ALTER COLUMN id SET DEFAULT nextval('public.review_comments_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: saved_searches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_searches ALTER COLUMN id SET DEFAULT nextval('public.saved_searches_id_seq'::regclass);


--
-- Name: service_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types ALTER COLUMN id SET DEFAULT nextval('public.service_types_id_seq'::regclass);


--
-- Name: stories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories ALTER COLUMN id SET DEFAULT nextval('public.stories_id_seq'::regclass);


--
-- Name: story_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reports ALTER COLUMN id SET DEFAULT nextval('public.story_reports_id_seq'::regclass);


--
-- Name: subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);


--
-- Name: support_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests ALTER COLUMN id SET DEFAULT nextval('public.support_requests_id_seq'::regclass);


--
-- Name: banks banks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.banks
    ADD CONSTRAINT banks_pkey PRIMARY KEY (code);


--
-- Name: bookings bookings_payment_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_payment_reference_key UNIQUE (payment_reference);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: boosts boosts_payment_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT boosts_payment_reference_key UNIQUE (payment_reference);


--
-- Name: boosts boosts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT boosts_pkey PRIMARY KEY (id);


--
-- Name: business_profiles business_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_pkey PRIMARY KEY (id);


--
-- Name: business_profiles business_profiles_profile_url_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_profile_url_key UNIQUE (profile_url);


--
-- Name: business_profiles business_profiles_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_slug_key UNIQUE (slug);


--
-- Name: business_profiles business_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_user_id_key UNIQUE (user_id);


--
-- Name: buyer_delivery_locations buyer_delivery_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_delivery_locations
    ADD CONSTRAINT buyer_delivery_locations_pkey PRIMARY KEY (id);


--
-- Name: calls calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_pkey PRIMARY KEY (id);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: chat_wallpaper_overrides chat_wallpaper_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: chat_wallpapers chat_wallpapers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_pkey PRIMARY KEY (conversation_id);


--
-- Name: conversation_deletions conversation_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_deletions
    ADD CONSTRAINT conversation_deletions_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: conversations conversations_buyer_id_seller_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_buyer_id_seller_id_product_id_key UNIQUE (buyer_id, seller_id, product_id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: data_bundles data_bundles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bundles
    ADD CONSTRAINT data_bundles_pkey PRIMARY KEY (id);


--
-- Name: data_orders data_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_orders
    ADD CONSTRAINT data_orders_pkey PRIMARY KEY (id);


--
-- Name: email_otps email_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps
    ADD CONSTRAINT email_otps_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_reference_key UNIQUE (reference);


--
-- Name: follows follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_pkey PRIMARY KEY (follower_id, following_id);


--
-- Name: message_deletions message_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_pkey PRIMARY KEY (message_id, user_id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_payment_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_payment_reference_key UNIQUE (payment_reference);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payout_withdrawals payout_withdrawals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_review_comments product_review_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_comments
    ADD CONSTRAINT product_review_comments_pkey PRIMARY KEY (id);


--
-- Name: product_review_likes product_review_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_likes
    ADD CONSTRAINT product_review_likes_pkey PRIMARY KEY (id);


--
-- Name: product_review_likes product_review_likes_review_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_likes
    ADD CONSTRAINT product_review_likes_review_id_user_id_key UNIQUE (review_id, user_id);


--
-- Name: product_reviews product_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_pkey PRIMARY KEY (id);


--
-- Name: product_reviews product_reviews_product_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_user_id_key UNIQUE (product_id, user_id);


--
-- Name: product_views product_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_pkey PRIMARY KEY (id);


--
-- Name: product_views product_views_product_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_product_id_user_id_key UNIQUE (product_id, user_id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referred_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_key UNIQUE (referred_id);


--
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);


--
-- Name: review_comments review_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_pkey PRIMARY KEY (id);


--
-- Name: review_likes review_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_pkey PRIMARY KEY (id);


--
-- Name: review_likes review_likes_review_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_review_id_user_id_key UNIQUE (review_id, user_id);


--
-- Name: review_skips review_skips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_skips
    ADD CONSTRAINT review_skips_pkey PRIMARY KEY (buyer_id, seller_id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_seller_reviewer_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_seller_reviewer_unique UNIQUE (seller_id, reviewer_id);


--
-- Name: saved_searches saved_searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_pkey PRIMARY KEY (id);


--
-- Name: seller_payments seller_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_payments
    ADD CONSTRAINT seller_payments_pkey PRIMARY KEY (id);


--
-- Name: seller_payments seller_payments_seller_id_period_start_period_end_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_payments
    ADD CONSTRAINT seller_payments_seller_id_period_start_period_end_key UNIQUE (seller_id, period_start, period_end);


--
-- Name: seller_payout_accounts seller_payout_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_payout_accounts
    ADD CONSTRAINT seller_payout_accounts_pkey PRIMARY KEY (id);


--
-- Name: seller_rewards seller_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_rewards
    ADD CONSTRAINT seller_rewards_pkey PRIMARY KEY (id);


--
-- Name: seller_rewards seller_rewards_seller_id_milestone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_rewards
    ADD CONSTRAINT seller_rewards_seller_id_milestone_key UNIQUE (seller_id, milestone);


--
-- Name: service_types service_types_normalized_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_normalized_key UNIQUE (normalized);


--
-- Name: service_types service_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_pkey PRIMARY KEY (id);


--
-- Name: stories stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_pkey PRIMARY KEY (id);


--
-- Name: story_comment_likes story_comment_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comment_likes
    ADD CONSTRAINT story_comment_likes_pkey PRIMARY KEY (comment_id, user_id);


--
-- Name: story_comments story_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments
    ADD CONSTRAINT story_comments_pkey PRIMARY KEY (id);


--
-- Name: story_exports story_exports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_exports
    ADD CONSTRAINT story_exports_pkey PRIMARY KEY (story_id, user_id);


--
-- Name: story_hidden story_hidden_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_hidden
    ADD CONSTRAINT story_hidden_pkey PRIMARY KEY (user_id, story_id);


--
-- Name: story_likes story_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_likes
    ADD CONSTRAINT story_likes_pkey PRIMARY KEY (story_id, user_id);


--
-- Name: story_reports story_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reports
    ADD CONSTRAINT story_reports_pkey PRIMARY KEY (id);


--
-- Name: story_reports story_reports_story_id_reporter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reports
    ADD CONSTRAINT story_reports_story_id_reporter_id_key UNIQUE (story_id, reporter_id);


--
-- Name: story_reposts story_reposts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reposts
    ADD CONSTRAINT story_reposts_pkey PRIMARY KEY (story_id, user_id);


--
-- Name: story_views story_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_pkey PRIMARY KEY (story_id, viewer_id);


--
-- Name: story_watch story_watch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_watch
    ADD CONSTRAINT story_watch_pkey PRIMARY KEY (story_id, viewer_id);


--
-- Name: subscriptions subscriptions_paystack_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_paystack_reference_key UNIQUE (paystack_reference);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: support_requests support_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_pkey PRIMARY KEY (id);


--
-- Name: user_blocks user_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_pkey PRIMARY KEY (blocker_id, blocked_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_key UNIQUE (referral_code);


--
-- Name: users users_university_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_university_email_key UNIQUE (university_email);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wishlist_items wishlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_pkey PRIMARY KEY (id);


--
-- Name: wishlist_items wishlist_items_user_id_product_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id);


--
-- Name: conversations_booking_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX conversations_booking_id_key ON public.conversations USING btree (booking_id);


--
-- Name: idx_bookings_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_buyer_id ON public.bookings USING btree (buyer_id);


--
-- Name: idx_bookings_payment_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_payment_reference ON public.bookings USING btree (payment_reference);


--
-- Name: idx_bookings_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_seller_id ON public.bookings USING btree (seller_id);


--
-- Name: idx_bookings_service_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_service_id ON public.bookings USING btree (service_id);


--
-- Name: idx_bookings_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_slot ON public.bookings USING btree (service_id, booking_date, booking_time);


--
-- Name: idx_bookings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bookings_status ON public.bookings USING btree (status);


--
-- Name: idx_business_profiles_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_profiles_slug ON public.business_profiles USING btree (slug);


--
-- Name: idx_business_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_profiles_user_id ON public.business_profiles USING btree (user_id);


--
-- Name: idx_conversations_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_buyer_id ON public.conversations USING btree (buyer_id);


--
-- Name: idx_conversations_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_seller_id ON public.conversations USING btree (seller_id);


--
-- Name: idx_data_bundles_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_bundles_seller_id ON public.data_bundles USING btree (seller_id);


--
-- Name: idx_data_orders_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_orders_buyer_id ON public.data_orders USING btree (buyer_id);


--
-- Name: idx_data_orders_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_data_orders_seller_id ON public.data_orders USING btree (seller_id);


--
-- Name: idx_follows_following; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_follows_following ON public.follows USING btree (following_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_notifications_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_read ON public.notifications USING btree (read);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_order_items_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);


--
-- Name: idx_order_items_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_items_seller_id ON public.order_items USING btree (seller_id);


--
-- Name: idx_orders_buyer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_buyer_id ON public.orders USING btree (buyer_id);


--
-- Name: idx_product_images_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_images_product_id ON public.product_images USING btree (product_id);


--
-- Name: idx_product_reviews_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_product_id ON public.product_reviews USING btree (product_id);


--
-- Name: idx_product_reviews_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_product_reviews_user_id ON public.product_reviews USING btree (user_id);


--
-- Name: idx_products_category_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_category_id ON public.products USING btree (category_id);


--
-- Name: idx_products_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_seller_id ON public.products USING btree (seller_id);


--
-- Name: idx_reports_reporter_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reports_reporter_id ON public.reports USING btree (reporter_id);


--
-- Name: idx_reviews_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_seller_id ON public.reviews USING btree (seller_id);


--
-- Name: idx_seller_payments_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_payments_seller_id ON public.seller_payments USING btree (seller_id);


--
-- Name: idx_seller_payout_accounts_seller_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seller_payout_accounts_seller_id ON public.seller_payout_accounts USING btree (seller_id);


--
-- Name: idx_story_comments_story; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_story_comments_story ON public.story_comments USING btree (story_id, created_at DESC);


--
-- Name: idx_support_requests_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_requests_status ON public.support_requests USING btree (status);


--
-- Name: idx_wishlist_items_product_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_items_product_id ON public.wishlist_items USING btree (product_id);


--
-- Name: idx_wishlist_items_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wishlist_items_user_id ON public.wishlist_items USING btree (user_id);


--
-- Name: payout_withdrawals_ref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payout_withdrawals_ref_idx ON public.payout_withdrawals USING btree (transfer_reference) WHERE (transfer_reference IS NOT NULL);


--
-- Name: product_views_product_anon_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX product_views_product_anon_key ON public.product_views USING btree (product_id, anon_id) WHERE (anon_id IS NOT NULL);


--
-- Name: service_types_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_types_trgm ON public.service_types USING gin (normalized public.gin_trgm_ops);


--
-- Name: uniq_active_booking_slot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_active_booking_slot ON public.bookings USING btree (service_id, booking_date, booking_time) WHERE (status = ANY (ARRAY['pending_payment'::text, 'confirmed'::text]));


--
-- Name: users_username_lower_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_lower_key ON public.users USING btree (lower(username)) WHERE (username IS NOT NULL);


--
-- Name: bookings bookings_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: bookings bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: boosts boosts_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT boosts_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: boosts boosts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosts
    ADD CONSTRAINT boosts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: business_profiles business_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_profiles
    ADD CONSTRAINT business_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: buyer_delivery_locations buyer_delivery_locations_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.buyer_delivery_locations
    ADD CONSTRAINT buyer_delivery_locations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calls calls_callee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_callee_id_fkey FOREIGN KEY (callee_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: calls calls_caller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calls
    ADD CONSTRAINT calls_caller_id_fkey FOREIGN KEY (caller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_wallpaper_overrides chat_wallpaper_overrides_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_wallpaper_overrides chat_wallpaper_overrides_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpaper_overrides
    ADD CONSTRAINT chat_wallpaper_overrides_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: chat_wallpapers chat_wallpapers_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: chat_wallpapers chat_wallpapers_set_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_wallpapers
    ADD CONSTRAINT chat_wallpapers_set_by_fkey FOREIGN KEY (set_by) REFERENCES public.users(id);


--
-- Name: conversation_deletions conversation_deletions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_deletions
    ADD CONSTRAINT conversation_deletions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_deletions conversation_deletions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_deletions
    ADD CONSTRAINT conversation_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_deleted_for_everyone_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_deleted_for_everyone_by_fkey FOREIGN KEY (deleted_for_everyone_by) REFERENCES public.users(id);


--
-- Name: conversations conversations_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_bundles data_bundles_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_bundles
    ADD CONSTRAINT data_bundles_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_orders data_orders_bundle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_orders
    ADD CONSTRAINT data_orders_bundle_id_fkey FOREIGN KEY (bundle_id) REFERENCES public.data_bundles(id);


--
-- Name: data_orders data_orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_orders
    ADD CONSTRAINT data_orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: data_orders data_orders_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_orders
    ADD CONSTRAINT data_orders_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_otps email_otps_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_otps
    ADD CONSTRAINT email_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: follows follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.follows
    ADD CONSTRAINT follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: message_deletions message_deletions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_deletions message_deletions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_deletions
    ADD CONSTRAINT message_deletions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: orders orders_delivered_by_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_delivered_by_seller_id_fkey FOREIGN KEY (delivered_by_seller_id) REFERENCES public.users(id);


--
-- Name: payout_withdrawals payout_withdrawals_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.seller_payout_accounts(id);


--
-- Name: payout_withdrawals payout_withdrawals_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payout_withdrawals
    ADD CONSTRAINT payout_withdrawals_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_review_comments product_review_comments_commenter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_comments
    ADD CONSTRAINT product_review_comments_commenter_id_fkey FOREIGN KEY (commenter_id) REFERENCES public.users(id);


--
-- Name: product_review_comments product_review_comments_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_comments
    ADD CONSTRAINT product_review_comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.product_reviews(id) ON DELETE CASCADE;


--
-- Name: product_review_likes product_review_likes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_likes
    ADD CONSTRAINT product_review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.product_reviews(id) ON DELETE CASCADE;


--
-- Name: product_review_likes product_review_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_review_likes
    ADD CONSTRAINT product_review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_reviews product_reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_reviews
    ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: product_views product_views_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: product_views product_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_views
    ADD CONSTRAINT product_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: products products_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_service_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_service_type_id_fkey FOREIGN KEY (service_type_id) REFERENCES public.service_types(id);


--
-- Name: referrals referrals_referred_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referred_id_fkey FOREIGN KEY (referred_id) REFERENCES public.users(id);


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.users(id);


--
-- Name: reports reports_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: reports reports_reported_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reported_user_id_fkey FOREIGN KEY (reported_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reports reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_comments review_comments_commenter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_commenter_id_fkey FOREIGN KEY (commenter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_comments review_comments_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_comments
    ADD CONSTRAINT review_comments_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: review_likes review_likes_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: review_likes review_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_likes
    ADD CONSTRAINT review_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_skips review_skips_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_skips
    ADD CONSTRAINT review_skips_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: review_skips review_skips_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_skips
    ADD CONSTRAINT review_skips_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: reviews reviews_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: saved_searches saved_searches_buyer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_searches
    ADD CONSTRAINT saved_searches_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);


--
-- Name: seller_payments seller_payments_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_payments
    ADD CONSTRAINT seller_payments_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_payout_accounts seller_payout_accounts_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_payout_accounts
    ADD CONSTRAINT seller_payout_accounts_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: seller_rewards seller_rewards_seller_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seller_rewards
    ADD CONSTRAINT seller_rewards_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: service_types service_types_canonical_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_types
    ADD CONSTRAINT service_types_canonical_id_fkey FOREIGN KEY (canonical_id) REFERENCES public.service_types(id);


--
-- Name: stories stories_sound_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_sound_story_id_fkey FOREIGN KEY (sound_story_id) REFERENCES public.stories(id) ON DELETE SET NULL;


--
-- Name: stories stories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stories
    ADD CONSTRAINT stories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: story_comment_likes story_comment_likes_comment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comment_likes
    ADD CONSTRAINT story_comment_likes_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES public.story_comments(id) ON DELETE CASCADE;


--
-- Name: story_comment_likes story_comment_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comment_likes
    ADD CONSTRAINT story_comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_comments story_comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments
    ADD CONSTRAINT story_comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.story_comments(id) ON DELETE CASCADE;


--
-- Name: story_comments story_comments_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments
    ADD CONSTRAINT story_comments_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_comments story_comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_comments
    ADD CONSTRAINT story_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_exports story_exports_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_exports
    ADD CONSTRAINT story_exports_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_exports story_exports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_exports
    ADD CONSTRAINT story_exports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_hidden story_hidden_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_hidden
    ADD CONSTRAINT story_hidden_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_hidden story_hidden_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_hidden
    ADD CONSTRAINT story_hidden_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_likes story_likes_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_likes
    ADD CONSTRAINT story_likes_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_likes story_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_likes
    ADD CONSTRAINT story_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_reposts story_reposts_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reposts
    ADD CONSTRAINT story_reposts_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_reposts story_reposts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_reposts
    ADD CONSTRAINT story_reposts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: story_views story_views_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_views story_views_viewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_views
    ADD CONSTRAINT story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id);


--
-- Name: story_watch story_watch_story_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_watch
    ADD CONSTRAINT story_watch_story_id_fkey FOREIGN KEY (story_id) REFERENCES public.stories(id) ON DELETE CASCADE;


--
-- Name: story_watch story_watch_viewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_watch
    ADD CONSTRAINT story_watch_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: support_requests support_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_requests
    ADD CONSTRAINT support_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocked_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_blocks user_blocks_blocker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blocks
    ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: wishlist_items wishlist_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: wishlist_items wishlist_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.wishlist_items
    ADD CONSTRAINT wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.12 (Debian 17.12-1.pgdg12+1)
-- Dumped by pg_dump version 17.5

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: banks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.banks (code, name, type) FROM stdin;
MTN	MTN Mobile Money	mobile_money
VOD	Vodafone Cash	mobile_money
AT	AirtelTigo Money	mobile_money
030100	Absa Bank Ghana Ltd	bank
280100	Access Bank	bank
080100	ADB Bank Limited	bank
300345	Adehyeman Savings and Loans LTD	bank
300341	Affinity Ghana Savings and Loans	bank
070101	ARB Apex Bank	bank
210100	Bank of Africa Ghana	bank
300335	Best Point Savings & Loans	bank
140100	CAL Bank Limited	bank
340100	Consolidated Bank Ghana Limited	bank
130100	Ecobank Ghana Limited	bank
200100	FBNBank Ghana Limited	bank
240100	Fidelity Bank Ghana Limited	bank
170100	First Atlantic Bank Limited	bank
330100	First National Bank Ghana Limited	bank
040100	GCB Bank Limited	bank
230100	Guaranty Trust Bank (Ghana) Limited	bank
050100	National Investment Bank Limited	bank
360100	OmniBSCI Bank	bank
180100	Prudential Bank Limited	bank
110100	Republic Bank (GH) Limited	bank
300361	Services Integrity Savings and Loans	bank
240092	Sinapi ABA Savings And Loans	bank
090100	Société Générale Ghana Limited	bank
190100	Stanbic Bank Ghana Limited	bank
020100	Standard Chartered Bank Ghana Limited	bank
060100	United Bank for Africa Ghana Limited	bank
100100	Universal Merchant Bank Ghana Limited	bank
120100	Zenith Bank Ghana	bank
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name) FROM stdin;
1	Clothes
3	Stationery
5	Perfumes
6	Food
7	Sneakers
8	Other
2	Gadgets
81	Mobile Data
82	Services
83	Bags
84	Books
85	Beauty & Skincare
86	Hair & Wigs
87	Jewelry & Watches
88	Groceries
89	Room Essentials
90	Furniture
91	Appliances
92	Sports & Fitness
93	Music & Instruments
94	Tickets & Events
\.


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 94, true);


--
-- PostgreSQL database dump complete
--

