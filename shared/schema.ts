import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const ROLES = [
  "customer",
  "operations",
  "operations_lead",
  "qa",
  "developer",
  "platform",
  "owner",
] as const;
export type Role = (typeof ROLES)[number];

export const BOOKING_TYPES = ["self_arrange", "concierge"] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const PACKAGES = ["standard", "plus", "premium", "exotic", "comprehensive"] as const;
export type Package = (typeof PACKAGES)[number];

export const ORDER_STATUSES = [
  "submitted",
  "payment_received",
  "payment_requested",
  "seller_contacted",
  "seller_confirmed",
  "inspection_scheduled",
  "inspection_in_progress",
  "report_drafting",
  "report_ready",
  "completed",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "not_requested",
  "requested",
  "paid",
  "failed",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  customerId: uuid("customer_id").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  customerPhone: text("customer_phone"),
  vehicleYear: integer("vehicle_year").notNull(),
  vehicleMake: text("vehicle_make").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  vehicleDescription: text("vehicle_description"),
  listingUrl: text("listing_url"),
  sellerName: text("seller_name"),
  sellerPhone: text("seller_phone"),
  vehicleLocation: text("vehicle_location").notNull(),
  bookingType: text("booking_type").notNull(),
  package: text("package").notNull(),
  basePrice: numeric("base_price").notNull(),
  discountAmount: numeric("discount_amount").default("0"),
  finalPrice: numeric("final_price").notNull(),
  paymentStatus: text("payment_status").notNull().default("not_requested"),
  paymentIntentId: text("payment_intent_id"),
  paidAt: timestamp("paid_at"),
  status: text("status").notNull().default("submitted"),
  preferredDate: timestamp("preferred_date"),
  scheduledDate: timestamp("scheduled_date"),
  assignedOpsId: uuid("assigned_ops_id"),
  reportUrl: text("report_url"),
  idempotencyKey: text("idempotency_key").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  orderId: text("order_id"),
  action: text("action").notNull(),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  customerId: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  paymentStatus: true,
  paymentIntentId: true,
  paidAt: true,
  status: true,
  scheduledDate: true,
  assignedOpsId: true,
  reportUrl: true,
  idempotencyKey: true,
  createdAt: true,
  updatedAt: true,
  basePrice: true,
  discountAmount: true,
  finalPrice: true,
});

export const bookingFormSchema = z.object({
  vehicleYear: z.number().min(1900).max(new Date().getFullYear() + 2),
  vehicleMake: z.string().min(1, "Make is required"),
  vehicleModel: z.string().min(1, "Model is required"),
  vehicleDescription: z.string().optional(),
  listingUrl: z.string().url().optional().or(z.literal("")),
  sellerName: z.string().optional(),
  sellerPhone: z.string().optional(),
  vehicleLocation: z.string().min(1, "Location is required"),
  bookingType: z.enum(BOOKING_TYPES),
  package: z.enum(PACKAGES),
  preferredDate: z.string().optional(),
});

export const insertActivitySchema = createInsertSchema(activityLog).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type ActivityLogEntry = typeof activityLog.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
