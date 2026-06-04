import { NextResponse } from "next/server";
import { clearSparkRecruiterCookies } from "@/lib/spark-auth";

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearSparkRecruiterCookies(response);
  return response;
}
