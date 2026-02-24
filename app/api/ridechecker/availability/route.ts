import { NextResponse } from "next/server";
import { z } from "zod";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import { supabaseAdmin } from "@/lib/supabase/admin";

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be in HH:MM format"),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, "End time must be in HH:MM format"),
  max_jobs: z.number().int().min(1).max(5),
});

type AvailabilityInput = z.infer<typeof availabilitySchema>;

export async function GET() {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = session.user.id;

    const { data: availability, error } = await supabaseAdmin
      .from("ridechecker_availability")
      .select("*")
      .eq("ridechecker_id", userId)
      .order("date", { ascending: true });

    if (error) {
      console.error("[availability GET error]", error);
      return NextResponse.json({ error: "Failed to fetch availability" }, { status: 500 });
    }

    return NextResponse.json({
      availability: availability || [],
    });
  } catch (err: any) {
    console.error("[availability GET error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!profile || !["ridechecker_active", "owner"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = availabilitySchema.parse(body);

    const userId = session.user.id;

    // Upsert availability record
    const { data: availability, error } = await supabaseAdmin
      .from("ridechecker_availability")
      .upsert(
        {
          ridechecker_id: userId,
          date: validatedData.date,
          start_time: validatedData.start_time,
          end_time: validatedData.end_time,
          max_jobs: validatedData.max_jobs,
        },
        {
          onConflict: "ridechecker_id,date",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("[availability POST error]", error);
      return NextResponse.json({ error: "Failed to save availability" }, { status: 500 });
    }

    return NextResponse.json(
      {
        success: true,
        availability,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: err.errors },
        { status: 400 }
      );
    }
    console.error("[availability POST error]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
