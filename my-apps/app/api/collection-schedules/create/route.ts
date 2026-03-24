import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
  );
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(req: NextRequest) {
  try {
    const { barangay_id, days, start_time, gcp_user_id, created_by } =
      await req.json();

    if (!barangay_id || !days || !start_time || !gcp_user_id) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("collection_schedules")
      .insert([
        {
          barangay_id,
          days,
          start_time,
          gcp_user_id,
          created_by,
          status: "Active",
        },
      ])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || JSON.stringify(error) },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error("collection-schedules create error:", error);
    return NextResponse.json(
      { success: false, error: error.message || String(error) },
      { status: 500 },
    );
  }
}
