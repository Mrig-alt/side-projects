import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  time,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const cuisineTypeEnum = pgEnum("cuisine_type", [
  "north_indian",
  "south_indian",
  "east_indian",
  "west_indian",
  "street_food",
  "chinese",
  "dessert",
  "beverages",
  "other",
]);

export const slotStatusEnum = pgEnum("slot_status", [
  "upcoming",
  "active",
  "completed",
  "cancelled",
]);

export const listingStatusEnum = pgEnum("listing_status", [
  "active",
  "paused",
  "sold_out",
  "cancelled",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "accepted",
  "rejected",
  "ready",
  "picked_up",
  "cancelled",
  "expired",
]);

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  // Seller-specific fields (null = buyer-only account)
  whatsappNumber: varchar("whatsapp_number", { length: 15 }),
  upiId: varchar("upi_id", { length: 100 }),
  isSellerProfileComplete: boolean("is_seller_profile_complete")
    .notNull()
    .default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Cafeteria Slots ──────────────────────────────────────────────────────────

export const cafeteriaSlots = pgTable(
  "cafeteria_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sellerId: uuid("seller_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // date is just the calendar day, e.g. "2026-04-15"
    date: date("date").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    status: slotStatusEnum("status").notNull().default("upcoming"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("unique_seller_date").on(t.sellerId, t.date)]
);

// ─── Listings (dishes offered in a slot) ─────────────────────────────────────

export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  slotId: uuid("slot_id")
    .notNull()
    .references(() => cafeteriaSlots.id, { onDelete: "cascade" }),
  sellerId: uuid("seller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dishName: varchar("dish_name", { length: 100 }).notNull(),
  description: text("description"),
  cuisineType: cuisineTypeEnum("cuisine_type").notNull(),
  isVeg: boolean("is_veg").notNull(),
  pricePerPortion: integer("price_per_portion").notNull(), // in ₹
  totalQuantity: integer("total_quantity").notNull(),
  availableQuantity: integer("available_quantity").notNull(),
  photoUrl: text("photo_url"),
  status: listingStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  slotId: uuid("slot_id")
    .notNull()
    .references(() => cafeteriaSlots.id, { onDelete: "cascade" }),
  buyerId: uuid("buyer_id")
    .notNull()
    .references(() => users.id),
  quantity: integer("quantity").notNull(),
  // Price snapshot at reservation time
  totalAmount: integer("total_amount").notNull(),
  status: orderStatusEnum("status").notNull().default("pending"),
  // Pickup info snapshot (immutable after creation)
  pickupDate: date("pickup_date").notNull(),
  pickupStartTime: time("pickup_start_time").notNull(),
  pickupEndTime: time("pickup_end_time").notNull(),
  // Dish snapshot
  dishName: varchar("dish_name", { length: 100 }).notNull(),
  // Seller contact snapshot (only revealed after acceptance)
  sellerWhatsapp: varchar("seller_whatsapp", { length: 15 }),
  sellerUpiId: varchar("seller_upi_id", { length: 100 }),
  sellerName: varchar("seller_name", { length: 100 }),
  // Transition timestamps
  acceptedAt: timestamp("accepted_at"),
  readyAt: timestamp("ready_at"),
  pickedUpAt: timestamp("picked_up_at"),
  rejectedAt: timestamp("rejected_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type CafeteriaSlot = typeof cafeteriaSlots.$inferSelect;
export type NewCafeteriaSlot = typeof cafeteriaSlots.$inferInsert;
export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;

export type CuisineType = (typeof cuisineTypeEnum.enumValues)[number];
export type SlotStatus = (typeof slotStatusEnum.enumValues)[number];
export type ListingStatus = (typeof listingStatusEnum.enumValues)[number];
export type OrderStatus = (typeof orderStatusEnum.enumValues)[number];
