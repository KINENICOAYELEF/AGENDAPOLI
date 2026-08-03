import { NextResponse } from "next/server";
import { getAdminDb, requireAuthenticated } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticated(req.headers.get("authorization"));
    if (auth.user?.role !== "INTERNO") {
      return NextResponse.json({ tasks: [] }, { headers: { "Cache-Control": "no-store" } });
    }
    const snapshot = await getAdminDb()
      .collection("student_clinical_tasks")
      .where("studentId", "==", auth.uid)
      .get();
    const tasks = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((task: any) => task.status === "ACTIVE")
      .sort((a: any, b: any) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    return NextResponse.json({ tasks }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    const message = error?.message || "Internal Error";
    const status = message.startsWith("Unauthorized") ? 401 : message.startsWith("Forbidden") ? 403 : 500;
    return NextResponse.json({ tasks: [], error: message }, { status });
  }
}
