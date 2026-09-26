import asyncio
from sqlalchemy import text
from app.db.session import async_session_factory

STATEMENTS = [
    # discount_offers
    """CREATE TABLE IF NOT EXISTS discount_offers (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        code VARCHAR(100) UNIQUE,
        discount_type VARCHAR(50) NOT NULL,
        value NUMERIC(10,2) NOT NULL DEFAULT 0,
        max_redemptions INTEGER,
        redemptions_used INTEGER NOT NULL DEFAULT 0,
        max_redemptions_per_user INTEGER NOT NULL DEFAULT 1,
        valid_from TIMESTAMPTZ NOT NULL,
        valid_until TIMESTAMPTZ,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_public BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_admin_id BIGINT REFERENCES users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_discount_offers_code ON discount_offers(code)",
    "CREATE INDEX IF NOT EXISTS ix_discount_offers_active ON discount_offers(is_active)",
    # discount_plan_links
    """CREATE TABLE IF NOT EXISTS discount_plan_links (
        id BIGSERIAL PRIMARY KEY,
        offer_id BIGINT NOT NULL REFERENCES discount_offers(id),
        plan_id BIGINT NOT NULL REFERENCES subscription_plans(id),
        UNIQUE(offer_id, plan_id)
    )""",
    "CREATE INDEX IF NOT EXISTS ix_discount_plan_unique ON discount_plan_links(offer_id, plan_id)",
    # discount_redemptions
    """CREATE TABLE IF NOT EXISTS discount_redemptions (
        id BIGSERIAL PRIMARY KEY,
        offer_id BIGINT NOT NULL REFERENCES discount_offers(id),
        user_id BIGINT NOT NULL REFERENCES users(id),
        user_subscription_id BIGINT REFERENCES user_subscriptions(id),
        status VARCHAR(50) NOT NULL DEFAULT 'RESERVED',
        amount_deducted NUMERIC(10,2),
        redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_discount_redemptions_offer_user ON discount_redemptions(offer_id, user_id)",
    # subscription_audit_logs
    """CREATE TABLE IF NOT EXISTS subscription_audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_admin_id BIGINT REFERENCES users(id),
        action_type VARCHAR(100) NOT NULL,
        target_user_id BIGINT REFERENCES users(id),
        target_plan_id BIGINT REFERENCES subscription_plans(id),
        target_offer_id BIGINT REFERENCES discount_offers(id),
        target_subscription_id BIGINT REFERENCES user_subscriptions(id),
        action_metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS ix_sub_audit_actor ON subscription_audit_logs(actor_admin_id)",
    "CREATE INDEX IF NOT EXISTS ix_sub_audit_target_user ON subscription_audit_logs(target_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_sub_audit_action ON subscription_audit_logs(action_type)",
    "CREATE INDEX IF NOT EXISTS ix_sub_audit_created ON subscription_audit_logs(created_at)",
    # new columns on user_subscriptions (DO block is one statement)
    """DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='source') THEN
            ALTER TABLE user_subscriptions ADD COLUMN source VARCHAR(50) NOT NULL DEFAULT 'PAYMENT';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='granted_by_admin_id') THEN
            ALTER TABLE user_subscriptions ADD COLUMN granted_by_admin_id BIGINT REFERENCES users(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='grant_reason') THEN
            ALTER TABLE user_subscriptions ADD COLUMN grant_reason TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='discount_offer_id') THEN
            ALTER TABLE user_subscriptions ADD COLUMN discount_offer_id BIGINT REFERENCES discount_offers(id);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='original_price') THEN
            ALTER TABLE user_subscriptions ADD COLUMN original_price NUMERIC(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_subscriptions' AND column_name='discounted_price') THEN
            ALTER TABLE user_subscriptions ADD COLUMN discounted_price NUMERIC(10,2);
        END IF;
    END $$""",
    # indexes on new columns
    "CREATE INDEX IF NOT EXISTS ix_user_subs_source ON user_subscriptions(source)",
    "CREATE INDEX IF NOT EXISTS ix_user_subs_granted_by ON user_subscriptions(granted_by_admin_id)",
]

async def main():
    async with async_session_factory() as session:
        conn = await session.connection()
        for i, stmt in enumerate(STATEMENTS, 1):
            try:
                await conn.execute(text(stmt))
                print(f"  [{i}/{len(STATEMENTS)}] OK")
            except Exception as e:
                print(f"  [{i}/{len(STATEMENTS)}] SKIP/ERROR: {str(e)[:120]}")
        await session.commit()
        print("✅ Migration complete.")

asyncio.run(main())
