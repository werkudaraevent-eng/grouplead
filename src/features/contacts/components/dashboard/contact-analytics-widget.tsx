"use client"

import { useMemo } from "react"
import { Lead } from "@/types"
import { SectionCard, SectionTitle, SectionSub } from "@/features/leads/components/dashboard-widgets/shared"
import { Users, TrendingUp } from "lucide-react"
import { useCurrency } from "@/contexts/currency-context"

interface ContactAnalyticsWidgetProps {
  leads: Lead[]
}

export function ContactAnalyticsWidget({ leads }: ContactAnalyticsWidgetProps) {
  const { fmt } = useCurrency()
  const contactStats = useMemo(() => {
    const contactMap: Record<string, {
      name: string
      email: string | null
      revenue: number
      leadCount: number
      wonCount: number
    }> = {}

    leads.forEach(lead => {
      const contactId = lead.contact_id
      if (!contactId) return

      const contactName = lead.contact?.full_name || "Unknown Contact"
      const contactEmail = lead.contact?.email || null
      const stage = (lead.pipeline_stage?.name || "").toLowerCase()
      const isWon = stage.includes("won")
      const revenue = isWon ? (lead.actual_value ?? lead.estimated_value ?? 0) : 0

      if (!contactMap[contactId]) {
        contactMap[contactId] = {
          name: contactName,
          email: contactEmail,
          revenue: 0,
          leadCount: 0,
          wonCount: 0
        }
      }

      contactMap[contactId].leadCount++
      contactMap[contactId].revenue += revenue
      if (isWon) contactMap[contactId].wonCount++
    })

    const topContacts = Object.values(contactMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)

    const totalContacts = Object.keys(contactMap).length
    const totalRevenue = Object.values(contactMap).reduce((sum, c) => sum + c.revenue, 0)
    const avgRevenuePerContact = totalContacts > 0 ? totalRevenue / totalContacts : 0

    return {
      topContacts,
      totalContacts,
      totalRevenue,
      avgRevenuePerContact
    }
  }, [leads])

  return (
    <SectionCard>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
        <Users style={{ width: 13, height: 13, color: "#8892a4" }} />
        <SectionTitle>Top Contacts by Revenue</SectionTitle>
      </div>
      <SectionSub>
        {contactStats.totalContacts} contacts • Avg {fmt(contactStats.avgRevenuePerContact)}
      </SectionSub>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {contactStats.topContacts.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#8892a4", fontSize: 11 }}>
            No contact data available
          </div>
        ) : (
          contactStats.topContacts.map((contact, idx) => {
            const conversionRate = contact.leadCount > 0
              ? (contact.wonCount / contact.leadCount) * 100
              : 0

            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  background: "#f8fafc",
                  borderRadius: 6,
                  border: "1px solid #f1f5f9"
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: "#0f1729",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {contact.name}
                  </div>
                  <div style={{ fontSize: 10, color: "#8892a4", marginTop: 1 }}>
                    {contact.leadCount} leads • {contact.wonCount} won • {conversionRate.toFixed(0)}% conv
                  </div>
                </div>
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0ea5e9",
                  marginLeft: 12,
                  whiteSpace: "nowrap"
                }}>
                  {fmt(contact.revenue)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </SectionCard>
  )
}
