"use client";

import type { Order, ActivityLogEntry } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrderStatusBadge, PaymentStatusBadge } from "./OrderStatusBadge";
import {
  formatDate,
  formatDateTime,
  formatRelative,
  bookingTypeLabel,
  packageLabel,
  statusLabel,
} from "@/lib/utils/format";
import { formatCurrency } from "@/lib/utils/pricing";
import {
  Car,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Phone,
  Link as LinkIcon,
  FileText,
  Clock,
} from "lucide-react";

interface OrderDetailPanelProps {
  order: Order;
  activities?: ActivityLogEntry[];
}

export function OrderDetailPanel({
  order,
  activities = [],
}: OrderDetailPanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1
            className="text-2xl font-bold font-mono"
            data-testid="text-order-id"
          >
            {order.id}
          </h1>
          <p className="text-sm text-muted-foreground">
            Created {formatRelative(order.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.payment_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              Vehicle Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vehicle</span>
              <span className="font-medium">
                {order.vehicle_year} {order.vehicle_make} {order.vehicle_model}
              </span>
            </div>
            {order.vehicle_description && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Description</span>
                <span className="text-right max-w-[200px]">
                  {order.vehicle_description}
                </span>
              </div>
            )}
            {order.listing_url && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Listing</span>
                <a
                  href={order.listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  View
                </a>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Location</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                {order.vehicle_location}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package</span>
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
              >
                {packageLabel(order.package)}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Booking Type</span>
              <span>{bookingTypeLabel(order.booking_type)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base Price</span>
              <span>{formatCurrency(order.base_price)}</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>Discount</span>
                <span>-{formatCurrency(order.discount_amount)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span>{formatCurrency(order.final_price)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Customer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{order.customer_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{order.customer_email}</span>
            </div>
            {order.customer_phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone</span>
                <span>{order.customer_phone}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.preferred_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferred</span>
                <span>{formatDate(order.preferred_date)}</span>
              </div>
            )}
            {order.scheduled_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scheduled</span>
                <span className="font-medium">
                  {formatDateTime(order.scheduled_date)}
                </span>
              </div>
            )}
            {order.paid_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid At</span>
                <span>{formatDateTime(order.paid_at)}</span>
              </div>
            )}
            {order.seller_name && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Seller</span>
                <span>{order.seller_name}</span>
              </div>
            )}
            {order.seller_phone && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Seller Phone</span>
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {order.seller_phone}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {order.report_url && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Inspection Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <a
              href={order.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
              data-testid="link-report"
            >
              Download Report (PDF)
            </a>
          </CardContent>
        </Card>
      )}

      {activities.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm"
                  data-testid={`activity-${entry.id}`}
                >
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{statusLabel(entry.action)}</p>
                    {entry.details && (
                      <p className="text-muted-foreground text-xs">
                        {typeof entry.details === "object"
                          ? (entry.details as any).note || JSON.stringify(entry.details)
                          : String(entry.details)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {formatRelative(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
