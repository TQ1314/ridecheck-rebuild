"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile, NotificationPreferences } from "@/types/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { User, Bell } from "lucide-react";

const METHOD_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS / Text" },
  { value: "phone", label: "Phone Call" },
];

export default function ProfilePage() {
  const supabase = createClient();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    primary_method: "email",
    secondary_method: undefined,
    fastest_response_method: undefined,
    sms_opt_in: true,
    email_opt_in: true,
    phone_opt_in: false,
  });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (data) {
        setProfile(data);
        setFullName(data.full_name || "");
        setPhone(data.phone || "");
        if (data.notification_preferences) {
          setPrefs((prev) => ({ ...prev, ...data.notification_preferences }));
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone: phone || null })
        .eq("id", profile.id);
      if (error) throw error;
      toast({ title: "Profile updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!profile) return;
    setSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs })
        .eq("id", profile.id);
      if (error) throw error;
      toast({ title: "Notification preferences saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPrefs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">
        Profile
      </h1>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled />
          </div>
          <div>
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              data-testid="input-full-name"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              data-testid="input-phone"
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            data-testid="button-save-profile"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Tell us how you prefer to receive updates about your inspection.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="primary_method" className="text-sm">Preferred contact method</Label>
              <Select
                value={prefs.primary_method || "email"}
                onValueChange={(v) => setPrefs((p) => ({ ...p, primary_method: v as any }))}
              >
                <SelectTrigger id="primary_method" data-testid="select-primary-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="secondary_method" className="text-sm">Backup contact method</Label>
              <Select
                value={prefs.secondary_method || "none"}
                onValueChange={(v) => setPrefs((p) => ({ ...p, secondary_method: v === "none" ? undefined : v as any }))}
              >
                <SelectTrigger id="secondary_method" data-testid="select-secondary-method">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fastest_method" className="text-sm">Fastest way to reach you</Label>
              <Select
                value={prefs.fastest_response_method || "none"}
                onValueChange={(v) => setPrefs((p) => ({ ...p, fastest_response_method: v === "none" ? undefined : v as any }))}
              >
                <SelectTrigger id="fastest_method" data-testid="select-fastest-method">
                  <SelectValue placeholder="Not specified" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Opt-in settings</p>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Email updates</p>
                <p className="text-xs text-muted-foreground">Receive status updates via email</p>
              </div>
              <Switch
                checked={prefs.email_opt_in ?? true}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, email_opt_in: v }))}
                data-testid="switch-email-opt-in"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">SMS / Text updates</p>
                <p className="text-xs text-muted-foreground">Receive status updates via text message</p>
              </div>
              <Switch
                checked={prefs.sms_opt_in ?? true}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, sms_opt_in: v }))}
                data-testid="switch-sms-opt-in"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Phone call updates</p>
                <p className="text-xs text-muted-foreground">Allow our team to call you with updates</p>
              </div>
              <Switch
                checked={prefs.phone_opt_in ?? false}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, phone_opt_in: v }))}
                data-testid="switch-phone-opt-in"
              />
            </div>
          </div>

          <Button
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            data-testid="button-save-prefs"
          >
            {savingPrefs ? "Saving..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
