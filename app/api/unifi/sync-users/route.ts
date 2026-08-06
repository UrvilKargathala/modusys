import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { fetchUnifiUsers } from "@/lib/unifi";

export async function POST() {
  try {
    const unifiUsers = await fetchUnifiUsers();
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const user of unifiUsers) {
      if (user.status !== "ACTIVE") {
        skipped++;
        continue;
      }

      const fullName = user.full_name || `${user.first_name} ${user.last_name}`.trim();
      const email = user.user_email || user.email || null;

      const existing = await prisma.employee.findFirst({
        where: { unifiUserId: user.id },
      });

      if (existing) {
        await prisma.employee.update({
          where: { id: existing.id },
          data: { unifiFullName: fullName },
        });
        updated++;
      } else {
        let employeeByEmail = null;
        if (email) {
          employeeByEmail = await prisma.employee.findFirst({ where: { email } });
        }

        if (employeeByEmail) {
          await prisma.employee.update({
            where: { id: employeeByEmail.id },
            data: { unifiUserId: user.id, unifiFullName: fullName },
          });
          updated++;
        } else {
          await prisma.employee.create({
            data: {
              name: fullName,
              email,
              employeeNumber: user.employee_number || null,
              unifiUserId: user.id,
              unifiFullName: fullName,
            },
          });
          created++;
        }
      }
    }

    await prisma.unifiSyncLog.create({
      data: {
        syncType: "users",
        status: "success",
        details: `Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
        recordsProcessed: created + updated,
      },
    });

    return NextResponse.json({ success: true, total: unifiUsers.length, created, updated, skipped });
  } catch (error) {
    console.error("[Modusys] User sync error:", error);

    await prisma.unifiSyncLog.create({
      data: { syncType: "users", status: "error", details: String(error) },
    });

    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
