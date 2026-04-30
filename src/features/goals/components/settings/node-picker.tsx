"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GoalNode, GoalNodeTree } from "@/types/goals"

interface NodePickerProps {
  goalId: string
  value: string | null
  onChange: (nodeId: string | null) => void
}

function buildTree(nodes: GoalNode[]): GoalNodeTree[] {
  const map = new Map<string, GoalNodeTree>()
  const roots: GoalNodeTree[] = []
  for (const n of nodes) map.set(n.id, { ...n, children: [] })
  for (const n of nodes) {
    const tree = map.get(n.id)!
    if (n.parent_node_id && map.has(n.parent_node_id)) {
      map.get(n.parent_node_id)!.children.push(tree)
    } else {
      roots.push(tree)
    }
  }
  const sort = (items: GoalNodeTree[]) => {
    items.sort((a, b) => a.sort_order - b.sort_order)
    for (const item of items) sort(item.children)
  }
  sort(roots)
  return roots
}

function NodeItem({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: GoalNodeTree
  depth: number
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <>
      <button
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left",
          selected === node.id && "bg-accent"
        )}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => onSelect(selected === node.id ? null : node.id)}
      >
        {selected === node.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
        <span className="truncate">{node.name}</span>
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
          {node.dimension_type}
        </span>
      </button>
      {node.children.map((child) => (
        <NodeItem
          key={child.id}
          node={child}
          depth={depth + 1}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}

export function NodePicker({ goalId, value, onChange }: NodePickerProps) {
  const supabase = createClient()
  const [nodes, setNodes] = useState<GoalNode[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  const loadNodes = useCallback(async () => {
    if (!goalId) return
    setLoading(true)
    const { data } = await supabase
      .from("goal_nodes")
      .select("*")
      .eq("goal_id", goalId)
      .order("sort_order")
    setNodes((data as GoalNode[]) ?? [])
    setLoading(false)
  }, [goalId, supabase])

  useEffect(() => {
    loadNodes()
  }, [loadNodes])

  const tree = buildTree(nodes)
  const selectedNode = nodes.find((n) => n.id === value)

  const handleSelect = (id: string | null) => {
    onChange(id)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-9 text-sm">
          <span className="truncate">
            {selectedNode ? selectedNode.name : "Select node..."}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-1 max-h-[300px] overflow-y-auto" align="start">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : tree.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No nodes available
          </p>
        ) : (
          <>
            <button
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-accent transition-colors text-left text-muted-foreground",
                !value && "bg-accent"
              )}
              onClick={() => handleSelect(null)}
            >
              {!value && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              <span>No node (goal-level)</span>
            </button>
            {tree.map((root) => (
              <NodeItem
                key={root.id}
                node={root}
                depth={0}
                selected={value}
                onSelect={handleSelect}
              />
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
