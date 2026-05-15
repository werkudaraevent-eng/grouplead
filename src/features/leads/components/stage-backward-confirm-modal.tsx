"use client"

import { AlertTriangle, CornerUpLeft } from "lucide-react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface StageBackwardConfirmModalProps {
    open: boolean
    fromStageName: string
    toStageName: string
    leadLabel?: string
    /** Set true while the parent is awaiting the server action. */
    loading?: boolean
    onConfirm: () => void
    onCancel: () => void
}

/**
 * Confirmation prompt shown when a user attempts to move a lead to a stage
 * with a lower sort_order than its current stage. Reusable from the table
 * inline editor and the kanban drag handler.
 */
export function StageBackwardConfirmModal({
    open,
    fromStageName,
    toStageName,
    leadLabel,
    loading,
    onConfirm,
    onCancel,
}: StageBackwardConfirmModalProps) {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !loading) onCancel()
            }}
        >
            <AlertDialogContent className="max-w-md">
                <AlertDialogHeader>
                    <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <AlertDialogTitle className="text-[15px] leading-tight">
                                Move backward in pipeline?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-[13px] leading-relaxed text-slate-600">
                                {leadLabel ? (
                                    <>
                                        <span className="font-medium text-slate-700">{leadLabel}</span>{" "}
                                        will move from{" "}
                                    </>
                                ) : (
                                    <>This lead will move from </>
                                )}
                                <span className="font-medium text-slate-700">{fromStageName}</span>{" "}
                                back to{" "}
                                <span className="font-medium text-slate-700">{toStageName}</span>.
                                The change is logged in the stage history and can be reversed.
                            </AlertDialogDescription>
                        </div>
                    </div>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(event) => {
                            event.preventDefault()
                            onConfirm()
                        }}
                        disabled={loading}
                        className="bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
                    >
                        <CornerUpLeft className="mr-1.5 h-3.5 w-3.5" />
                        {loading ? "Moving…" : "Move backward"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
