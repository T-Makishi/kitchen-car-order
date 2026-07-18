import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const admins = sqliteTable("admins", {
  id: text("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: text("locked_until"),
  ...timestamps,
});

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  adminId: text("admin_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  csrfToken: text("csrf_token").notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("admin_sessions_token_idx").on(table.tokenHash)]);

export const storeSettings = sqliteTable("store_settings", {
  id: text("id").primaryKey(),
  storeName: text("store_name").notNull(),
  description: text("description").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  notificationEmail: text("notification_email").notNull(),
  instagramUrl: text("instagram_url"),
  logoUrl: text("logo_url"),
  heroUrl: text("hero_url"),
  currency: text("currency").notNull().default("JPY"),
  taxLabel: text("tax_label").notNull().default("税込"),
  minimumOrderAmount: integer("minimum_order_amount").notNull().default(800),
  paymentMethods: text("payment_methods").notNull(),
  orderStatus: text("order_status").notNull().default("OPEN"),
  completionMessage: text("completion_message").notNull(),
  privacyPolicy: text("privacy_policy").notNull(),
  terms: text("terms").notNull(),
  allergyNotice: text("allergy_notice").notNull(),
  preparationMinutes: integer("preparation_minutes").notNull().default(30),
  bookingDays: integer("booking_days").notNull().default(14),
  sessionMinutes: integer("session_minutes").notNull().default(480),
  ...timestamps,
});

export const businessLocations = sqliteTable("business_locations", {
  id: text("id").primaryKey(), name: text("name").notNull(), address: text("address").notNull(),
  mapUrl: text("map_url").notNull(), isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...timestamps,
});

export const businessSchedules = sqliteTable("business_schedules", {
  id: text("id").primaryKey(), dayOfWeek: integer("day_of_week").notNull(), locationId: text("location_id").notNull(),
  opensAt: text("opens_at").notNull(), closesAt: text("closes_at").notNull(), pickupIntervalMinutes: integer("pickup_interval_minutes").notNull(),
  slotCapacity: integer("slot_capacity").notNull(), cutoffMinutes: integer("cutoff_minutes").notNull(), sameDayAllowed: integer("same_day_allowed", { mode: "boolean" }).notNull(),
  ...timestamps,
});

export const specialBusinessDays = sqliteTable("special_business_days", {
  id: text("id").primaryKey(), businessDate: text("business_date").notNull(), isClosed: integer("is_closed", { mode: "boolean" }).notNull(),
  locationId: text("location_id"), opensAt: text("opens_at"), closesAt: text("closes_at"), notice: text("notice"), ...timestamps,
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(), name: text("name").notNull(), slug: text("slug").notNull(), sortOrder: integer("sort_order").notNull(),
  isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true), ...timestamps,
}, (table) => [uniqueIndex("categories_slug_idx").on(table.slug)]);

export const menuItems = sqliteTable("menu_items", {
  id: text("id").primaryKey(), categoryId: text("category_id").notNull(), name: text("name").notNull(), slug: text("slug").notNull(),
  description: text("description").notNull(), price: integer("price").notNull(), ingredients: text("ingredients").notNull(), allergens: text("allergens").notNull(),
  spiciness: integer("spiciness").notNull().default(0), preparationMinutes: integer("preparation_minutes").notNull().default(10), imageUrl: text("image_url"),
  stock: integer("stock"), maxPerOrder: integer("max_per_order").notNull().default(10), isPublished: integer("is_published", { mode: "boolean" }).notNull().default(true),
  isSoldOut: integer("is_sold_out", { mode: "boolean" }).notNull().default(false), isRecommended: integer("is_recommended", { mode: "boolean" }).notNull().default(false),
  isNew: integer("is_new", { mode: "boolean" }).notNull().default(false), sortOrder: integer("sort_order").notNull(), ...timestamps,
}, (table) => [uniqueIndex("menu_items_slug_idx").on(table.slug)]);

export const menuItemImages = sqliteTable("menu_item_images", {
  id: text("id").primaryKey(), menuItemId: text("menu_item_id").notNull(), objectKey: text("object_key").notNull(), mimeType: text("mime_type").notNull(),
  width: integer("width"), height: integer("height"), sortOrder: integer("sort_order").notNull().default(0), createdAt: text("created_at").notNull(),
});

export const optionGroups = sqliteTable("option_groups", {
  id: text("id").primaryKey(), menuItemId: text("menu_item_id").notNull(), name: text("name").notNull(), isRequired: integer("is_required", { mode: "boolean" }).notNull(),
  minSelections: integer("min_selections").notNull(), maxSelections: integer("max_selections").notNull(), sortOrder: integer("sort_order").notNull(), ...timestamps,
});

export const optionChoices = sqliteTable("option_choices", {
  id: text("id").primaryKey(), optionGroupId: text("option_group_id").notNull(), name: text("name").notNull(), additionalPrice: integer("additional_price").notNull(),
  isSoldOut: integer("is_sold_out", { mode: "boolean" }).notNull().default(false), sortOrder: integer("sort_order").notNull(), ...timestamps,
});

export const pickupSlots = sqliteTable("pickup_slots", {
  id: text("id").primaryKey(), locationId: text("location_id").notNull(), startsAt: text("starts_at").notNull(), capacity: integer("capacity").notNull(),
  reservedCount: integer("reserved_count").notNull().default(0), isPaused: integer("is_paused", { mode: "boolean" }).notNull().default(false), ...timestamps,
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(), orderNumber: text("order_number").notNull(), verificationHash: text("verification_hash").notNull(), idempotencyKey: text("idempotency_key").notNull(),
  customerName: text("customer_name").notNull(), customerNameKana: text("customer_name_kana").notNull(), phone: text("phone").notNull(), email: text("email").notNull(),
  pickupAt: text("pickup_at").notNull(), pickupLocationId: text("pickup_location_id").notNull(), pickupLocationName: text("pickup_location_name").notNull(),
  paymentMethod: text("payment_method").notNull(), status: text("status").notNull(), subtotal: integer("subtotal").notNull(), total: integer("total").notNull(),
  customerNote: text("customer_note"), allergyDeclaration: text("allergy_declaration"), adminNote: text("admin_note"), emailStatus: text("email_status").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("orders_number_idx").on(table.orderNumber), uniqueIndex("orders_idempotency_idx").on(table.idempotencyKey)]);

export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey(), orderId: text("order_id").notNull(), menuItemId: text("menu_item_id"), itemName: text("item_name").notNull(),
  unitPrice: integer("unit_price").notNull(), quantity: integer("quantity").notNull(), lineTotal: integer("line_total").notNull(), note: text("note"), createdAt: text("created_at").notNull(),
});

export const orderItemOptions = sqliteTable("order_item_options", {
  id: text("id").primaryKey(), orderItemId: text("order_item_id").notNull(), groupName: text("group_name").notNull(), choiceName: text("choice_name").notNull(),
  additionalPrice: integer("additional_price").notNull(), createdAt: text("created_at").notNull(),
});

export const announcements = sqliteTable("announcements", {
  id: text("id").primaryKey(), title: text("title").notNull(), body: text("body").notNull(), severity: text("severity").notNull(),
  startsAt: text("starts_at").notNull(), endsAt: text("ends_at"), isPublished: integer("is_published", { mode: "boolean" }).notNull(), ...timestamps,
});

export const emailDeliveries = sqliteTable("email_deliveries", {
  id: text("id").primaryKey(), orderId: text("order_id"), type: text("type").notNull(), recipientMasked: text("recipient_masked").notNull(), subject: text("subject").notNull(),
  textBody: text("text_body").notNull(), htmlBody: text("html_body").notNull(), status: text("status").notNull(), attempts: integer("attempts").notNull(),
  lastError: text("last_error"), sentAt: text("sent_at"), createdAt: text("created_at").notNull(), updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(), adminId: text("admin_id"), action: text("action").notNull(), targetType: text("target_type").notNull(), targetId: text("target_id"),
  summary: text("summary").notNull(), ipHash: text("ip_hash"), createdAt: text("created_at").notNull(),
});

export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(), scope: text("scope").notNull(), identityHash: text("identity_hash").notNull(), windowStartedAt: text("window_started_at").notNull(),
  count: integer("count").notNull(), expiresAt: text("expires_at").notNull(),
});
