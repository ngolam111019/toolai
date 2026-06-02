-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "n_users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "device_id" TEXT,
    "balance_xu" INTEGER NOT NULL DEFAULT 0,
    "fcm_token" TEXT,
    "web_push_subscription" JSONB,
    "platform" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "n_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_user_pending" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_user_pending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_reset_otps" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_packages" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "price_2" INTEGER,
    "duration_days" INTEGER,
    "is_lifetime" BOOLEAN NOT NULL DEFAULT false,
    "gateways" JSONB,
    "description" TEXT,
    "color" TEXT,
    "bg_color" TEXT,
    "is_best_saler" BOOLEAN NOT NULL DEFAULT false,
    "max_turns_per_day" INTEGER NOT NULL DEFAULT 0,
    "is_gift" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "n_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_user_packages" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "package_id" INTEGER NOT NULL,
    "activated_at" TIMESTAMP(3),
    "expired_at" TIMESTAMP(3),
    "turns_used_today" INTEGER NOT NULL DEFAULT 0,
    "last_turn_reset" TIMESTAMP(3),

    CONSTRAINT "n_user_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_transactions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "ref_code" TEXT,
    "expired_at" TIMESTAMP(3),
    "package_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_tool_usage_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "gateway" TEXT NOT NULL,
    "prediction" TEXT,
    "round_code" TEXT,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_tool_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_user_event_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_code" TEXT NOT NULL,
    "meta" JSONB,
    "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_user_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_notification_templates" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "btn_text" TEXT,
    "screen_redirect" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_notifications_queue" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "email" TEXT,
    "platform" INTEGER,
    "title" TEXT,
    "message" TEXT,
    "btn_text" TEXT,
    "screen_redirect" TEXT,
    "template_id" INTEGER NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "send_after" TIMESTAMP(3) NOT NULL,
    "status" INTEGER NOT NULL DEFAULT 0,
    "sent_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "n_notifications_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "n_user_notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT,
    "deep_link" TEXT,
    "image_url" TEXT,
    "meta_json" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "n_user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "n_users_email_key" ON "n_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "n_user_pending_email_key" ON "n_user_pending"("email");

-- CreateIndex
CREATE UNIQUE INDEX "n_reset_otps_email_key" ON "n_reset_otps"("email");

-- CreateIndex
CREATE UNIQUE INDEX "n_notification_templates_code_key" ON "n_notification_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "n_notifications_queue_user_id_template_id_key" ON "n_notifications_queue"("user_id", "template_id");

-- AddForeignKey
ALTER TABLE "n_user_packages" ADD CONSTRAINT "n_user_packages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "n_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_user_packages" ADD CONSTRAINT "n_user_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "n_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_transactions" ADD CONSTRAINT "n_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "n_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_tool_usage_logs" ADD CONSTRAINT "n_tool_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "n_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_user_event_logs" ADD CONSTRAINT "n_user_event_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "n_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_notifications_queue" ADD CONSTRAINT "n_notifications_queue_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "n_notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "n_user_notifications" ADD CONSTRAINT "n_user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "n_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

