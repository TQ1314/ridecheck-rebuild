"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, CreditCard, Mail, MessageSquare, Database } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform configuration and integrations
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Stripe
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
              >
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Payment processing via Stripe Checkout.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Resend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
              >
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Transactional emails via Resend.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Twilio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
              >
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              SMS notifications via Twilio.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              Supabase
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge
                variant="outline"
                className="no-default-hover-elevate no-default-active-elevate"
              >
                Connected
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Database, auth, and storage via Supabase.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
