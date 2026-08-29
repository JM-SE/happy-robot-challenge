import { cookies } from "next/headers"; import { redirect } from "next/navigation"; import { hasValidSession } from "../../src/operations/session-helper"; import OperationsDashboard from "../../src/operations/ui/OperationsDashboard";
export default async function OperationsPage() { if (!hasValidSession((await cookies()).toString())) redirect("/operations/login"); return <OperationsDashboard />; }
