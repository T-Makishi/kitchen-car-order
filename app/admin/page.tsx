import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/server";
import { AdminDashboard } from "@/components/AdminDashboard";

export const dynamic="force-dynamic";
export const metadata={title:"管理ダッシュボード",robots:{index:false,follow:false}};
export default async function AdminPage(){const incoming=await headers();const host=incoming.get("host")??"localhost";const session=await getAdminSession(new Request(`http://${host}/admin`,{headers:{cookie:incoming.get("cookie")??""}}));if(!session)redirect("/admin/login");return <AdminDashboard csrfToken={session.csrfToken}/>}
