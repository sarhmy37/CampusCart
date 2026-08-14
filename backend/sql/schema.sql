-- CampusCart database schema
-- Run this once against your PostgreSQL database to create all tables.

-- Needed for gen_random_uuid() below
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(120) NOT NULL,
    university_email  VARCHAR(180) NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    school            VARCHAR(80),
    role              VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user' | 'admin'
    verified          BOOLEAN NOT NULL DEFAULT FALSE,
    avatar_url        TEXT,
    about             TEXT,
    personal_email    VARCHAR(180),
    whatsapp          VARCHAR(30),
    location          VARCHAR(120),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    price         NUMERIC(10,2) NOT NULL,
    condition     VARCHAR(20) NOT NULL DEFAULT 'good', -- 'new' | 'good' | 'fair'
    category_id   INTEGER REFERENCES categories(id),
    stock         INTEGER NOT NULL DEFAULT 1,
    primary_image TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_images (
    id          SERIAL PRIMARY KEY,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url   TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS reviews (
    id             SERIAL PRIMARY KEY,
    seller_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewer_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_name  VARCHAR(120),
    rating         INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID REFERENCES products(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (buyer_id, seller_id, product_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id               SERIAL PRIMARY KEY,
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content          TEXT NOT NULL,
    read             BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'cancelled' | 'refunded'
    delivery_method VARCHAR(20) NOT NULL DEFAULT 'pickup',  -- 'pickup' | 'delivery'
    subtotal        NUMERIC(10,2) NOT NULL,
    delivery_fee    NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_amount    NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
    id                SERIAL PRIMARY KEY,
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
    seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title             VARCHAR(200) NOT NULL,
    quantity          INTEGER NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    platform_fee      NUMERIC(10,2) NOT NULL DEFAULT 0,
    seller_earnings   NUMERIC(10,2) NOT NULL DEFAULT 0,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'completed' | 'cancelled' | 'refunded'
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seller_payments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_start  DATE NOT NULL,
    period_end    DATE NOT NULL,
    amount_due    NUMERIC(10,2) NOT NULL DEFAULT 0,
    amount_paid   NUMERIC(10,2) NOT NULL DEFAULT 0,
    status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'overdue'
    paid_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (seller_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS seller_payout_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    method          VARCHAR(20) NOT NULL DEFAULT 'bank', -- 'bank' | 'mobile_money'
    bank_code       VARCHAR(20) NOT NULL,
    bank_name       VARCHAR(120) NOT NULL,
    account_number  VARCHAR(20) NOT NULL,
    account_name    VARCHAR(120) NOT NULL,
    paystack_recipient_code TEXT, -- filled in once we create the Paystack transfer recipient
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seller_rewards (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone         INTEGER NOT NULL, -- e.g. 30, 60, 90
    reward_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.5,
    reward_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
    credited          BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (seller_id, milestone)
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_last_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_otps (
    id          SERIAL PRIMARY KEY,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        VARCHAR(6) NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed starter categories matching the frontend's ITEM_TYPES list
INSERT INTO categories (name) VALUES
    ('Clothes'), ('Phone accessories'), ('Stationery'), ('Laptops'),
    ('Perfumes'), ('Food'), ('Sneakers'), ('Other')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, product_id)
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS credit_applied NUMERIC(10,2) NOT NULL DEFAULT 0;