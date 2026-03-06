import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service role key required for admin operations
// client will be created in each request after verifying vars
// (pre‑level creation caused errors when env was missing)

// note: we intentionally don't build the client at module
// initialization because missing env variables would throw
// during import, resulting in the HTML error you saw.

interface CreateUserBody {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  contact_number: string;
  role: string;
  barangay_id?: string;
  tempPassword: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      username,
      first_name,
      last_name,
      contact_number,
      role,
      barangay_id,
      tempPassword,
    } = (await request.json()) as CreateUserBody;

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      // Environment not configured – respond with JSON instead of crashing
      return NextResponse.json(
        {
          success: false,
          error:
            "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is required",
        },
        { status: 500 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (
      !email ||
      !username ||
      !first_name ||
      !last_name ||
      !contact_number ||
      !role ||
      !tempPassword
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // create auth user with service role so email is auto-confirmed
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });

    if (authError || !authData?.user) {
      return NextResponse.json(
        {
          success: false,
          error: authError?.message || "Failed to create auth user",
        },
        { status: 400 },
      );
    }

    const userId = authData.user.id;

    // insert profile row
    const { error: insertError } = await supabase.from("users").insert({
      user_id: userId,
      username,
      first_name,
      last_name,
      email,
      contact_number,
      role,
      status: "active",
      barangay_id: role === "BWMC" ? barangay_id || null : null,
    });

    if (insertError) {
      // clean up auth user when profile insert fails
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, userId });
  } catch (err: any) {
    console.error("/api/admin/create-user error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
