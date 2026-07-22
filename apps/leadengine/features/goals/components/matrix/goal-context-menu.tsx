"use client"

import { useState, useEffect, useRef } from "react"
import {
  Pencil, ArrowLeftRight, Plus, Trash2, Copy, UserPlus,
} from "lucide-react"

interface GoalContextMenuProps {
  x: number
  y: number
  nodeId: string
  nodeName: string
  allocationMode: string
  onClose: () => void
  onEditName: (nodeId: string) => void
  onSwitchMode: (nodeId: string) => void
  onAddChild: (nodeId: string) => void
  onDelete: (nodeId: string) => void
}

/**
 * Right-click context menu for hierarchy rows in the goal matrix grid.
 * Options: Edit Node Name, Switch Allocation Mode, Add Child Node, Delete Node.
 */
export function GoalContextMenu({
  x, y, nodeId, nodeName, allocationMode,
  onClose, onEditName, onSwitchMode, onAddChild, onDelete,
}: GoalContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [onClose])

  const modeLabel = allocationMode === "percentage" ? "Switch to Absolute" : "Switch to Percentage"

  const items = [
    { label: "Edit Node Name", icon: Pencil, action: () => { onEditName(nodeId); onClose() } },
    { label: modeLabel, icon: ArrowLeftRight, action: () => { onSwitchMode(nodeId); onClose() } },
    { label: "Add Child Node", icon: Plus, action: () => { onAddChild(nodeId); onClose() } },
  ]

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[200px]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
          {item.label}
        </button>
      ))}
      <div className="border-t border-slate-100 my-1" />
      {showDeleteConfirm ? (
        <div className="px-3 py-2 space-y-1.5">
          <p className="text-xs text-red-600">Delete &quot;{nodeName}&quot; and all children?</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => { onDelete(nodeId); onClose() }}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete Node
        </button>
      )}
    </div>
  )
}
