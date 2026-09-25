import { RecordPageSkeleton } from "@/components/shared/record-page-skeleton"

/** A contact's page while it loads, in the page's own layout (DESIGN.md, "Record pages"). */
export default function ContactDetailLoading() {
    return <RecordPageSkeleton label="Loading contact" shape="circle" tabs={3} quickActions={4} />
}
