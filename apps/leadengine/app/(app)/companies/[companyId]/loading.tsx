import { RecordPageSkeleton } from "@/components/shared/record-page-skeleton"

/** A company's page while it loads, in the page's own layout (DESIGN.md, "Record pages"). */
export default function CompanyDetailLoading() {
    return <RecordPageSkeleton label="Loading company" shape="square" tabs={4} quickActions={3} />
}
