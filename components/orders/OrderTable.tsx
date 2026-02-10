"use client";

import Link from "next/link";
import type { Order } from "@/types/orders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OrderStatusBadge, PaymentStatusBadge } from "./OrderStatusBadge";
import { formatDate, bookingTypeLabel, packageLabel } from "@/lib/utils/format";
import { formatCurrency } from "@/lib/utils/pricing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Package, Inbox } from "lucide-react";

interface OrderTableProps {
  orders: Order[];
  basePath?: string;
  showCustomer?: boolean;
}

export function OrderTable({
  orders,
  basePath = "/orders",
  showCustomer = false,
}: OrderTableProps) {
  if (!orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-state">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted mb-4">
          <Inbox className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">No orders found</h3>
        <p className="text-sm text-muted-foreground">Orders will appear here once created.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            {showCustomer && <TableHead>Customer</TableHead>}
            <TableHead>Vehicle</TableHead>
            <TableHead>Package</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
              <TableCell className="font-mono text-xs font-medium">
                {order.id}
              </TableCell>
              {showCustomer && (
                <TableCell>
                  <div className="text-sm">{order.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {order.customer_email}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <div className="text-sm">
                  {order.vehicle_year} {order.vehicle_make}
                </div>
                <div className="text-xs text-muted-foreground">
                  {order.vehicle_model}
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="no-default-hover-elevate no-default-active-elevate"
                >
                  {packageLabel(order.package)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {bookingTypeLabel(order.booking_type)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={order.payment_status} />
              </TableCell>
              <TableCell className="font-medium">
                {formatCurrency(order.final_price)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDate(order.created_at)}
              </TableCell>
              <TableCell>
                <Link href={`${basePath}/${order.id}`}>
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-view-${order.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

