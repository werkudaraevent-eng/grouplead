"use client"

import { useState } from "react"
import {
    TrendingUp, Briefcase, Target, Zap, Rocket, BarChart3,
    LineChart, PieChart, DollarSign, Users, Building2, Globe,
    Award, Crown, Star, Heart, Gem, ShieldCheck,
    Handshake, Megaphone, Send, Mail, Phone, Radio,
    Layers, Package, ShoppingCart, Truck, Wrench, Settings,
} from "lucide-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

// Icon registry — maps string keys to Lucide components
export const PIPELINE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    TrendingUp,
    Briefcase,
    Target,
    Zap,
    Rocket,
    BarChart3,
    LineChart,
    PieChart,
    DollarSign,
    Users,
    Building2,
    Globe,
    Award,
    Crown,
    Star,
    Heart,
    Gem,
    ShieldCheck,
    Handshake,
    Megaphone,
    Send,
    Mail,
    Phone,
    Radio,
    Layers,
    Package,
    ShoppingCart,
    Truck,
    Wrench,
    Settings,
}

export const DEFAULT_PIPELINE_ICON = "TrendingUp"

interface PipelineIconPickerProps {
    value: string
    onChange: (icon: string) => void
}

export function PipelineIconPicker({ value, onChange }: PipelineIconPickerProps) {
    const [open, setOpen] = useState(false)
    const ActiveIcon = PIPELINE_ICONS[value] || PIPELINE_ICONS[DEFAULT_PIPELINE_ICON]

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="h-9 w-9 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0 shadow-sm"
                    title="Choose icon"
                >
                    <ActiveIcon className="h-4 w-4 text-slate-600" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[260px] p-3" sideOffset={8}>
                <div className="mb-2">
                    <h4 className="text-[13px] font-semibold text-slate-800">Choose an icon</h4>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                    {Object.entries(PIPELINE_ICONS).map(([key, Icon]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => { onChange(key); setOpen(false) }}
                            className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                                value === key
                                    ? "bg-primary/10 text-primary ring-2 ring-primary/30"
                                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            }`}
                            title={key}
                        >
                            <Icon className="h-4.5 w-4.5" />
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

/**
 * Renders the pipeline icon from a string key.
 * Use this wherever you need to display a pipeline's icon.
 */
export function PipelineIcon({ icon, className }: { icon?: string; className?: string }) {
    const IconComp = PIPELINE_ICONS[icon || DEFAULT_PIPELINE_ICON] || TrendingUp
    return <IconComp className={className} />
}
