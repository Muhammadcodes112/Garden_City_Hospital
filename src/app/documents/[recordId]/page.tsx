import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { formRecords, patients } from "@/db/schema";
import { requireAdmin } from "@/lib/session";
import { DocumentViewer } from "@/components/forms/document-viewer";
import { DocumentViewHeader } from "@/components/forms/document-view-header";
import { FORM_TYPE_LABELS } from "@/lib/routes";

export const dynamic = "force-dynamic";

export default async function DocumentViewPage({ params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  const session = await requireAdmin();

  const [row] = await db
    .select({
      id: formRecords.id,
      type: formRecords.type,
      status: formRecords.status,
      deletedAt: formRecords.deletedAt,
      updatedAt: formRecords.updatedAt,
      surname: patients.surname,
      firstNames: patients.firstNames,
      hospitalNumber: patients.hospitalNumber,
    })
    .from(formRecords)
    .innerJoin(patients, eq(formRecords.patientId, patients.id))
    .where(eq(formRecords.id, recordId));

  if (!row || row.deletedAt) notFound();

  const isSuperAdmin = (session.user as { role?: string }).role === "super_admin";
  const filename = `${FORM_TYPE_LABELS[row.type].replace(/\s+/g, "")}_${row.hospitalNumber}.pdf`;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-950">
      <DocumentViewHeader
        patientName={`${row.surname}, ${row.firstNames}`}
        hospitalNumber={row.hospitalNumber}
        formTypeLabel={FORM_TYPE_LABELS[row.type]}
        status={row.status}
        recordId={row.id}
        formType={row.type}
        isSuperAdmin={isSuperAdmin}
      />
      <div className="relative flex-1 overflow-hidden">
        <DocumentViewer recordId={row.id} formType={row.type} filename={filename} isPublic={false} />
      </div>
    </div>
  );
}
