"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, MapPin, Plus } from "lucide-react"
import { createMission, type CreateMissionState } from "@/app/actions/mission-actions"
import { MISSION_TYPES } from "@/lib/missions/mission-schema"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"

export function MissionForm({ salesOptions, defaultDate }: { salesOptions: TenantSalesOption[]; defaultDate: string }) {
  const [state, formAction, pending] = useActionState<CreateMissionState, FormData>(createMission, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success && state.data?.id) {
      router.push(`/workspace/missions/${state.data.id}`)
      router.refresh()
    }
  }, [state, router])

  if (salesOptions.length === 0) {
    return (
      <div className="workspace-empty-state" role="status">
        <h2>Belum ada anggota tim</h2>
        <p>Mission butuh minimal satu sales untuk ditugaskan. Minta admin menambahkan anggota ke unit bisnis ini lebih dulu.</p>
        <Link className="workspace-secondary-button" href="/workspace/missions">Kembali</Link>
      </div>
    )
  }

  return (
    <form className="workspace-form-panel" action={formAction}>
      {state?.error ? (
        <div className="workspace-form-error" role="alert">{state.error}</div>
      ) : null}

      <div className="workspace-form-section">
        <div>
          <p className="workspace-section-kicker">Visit details</p>
          <h2>What is happening?</h2>
        </div>
        <div className="workspace-form-grid">
          <label>
            <span>Client company</span>
            <input name="clientCompanyName" required maxLength={200} placeholder="Nama perusahaan klien" />
          </label>
          <label>
            <span>Mission type</span>
            <select name="missionType" defaultValue="Meeting">
              {MISSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input name="date" required type="date" defaultValue={defaultDate} />
          </label>
          <label>
            <span>Start time</span>
            <input name="startTime" required type="time" defaultValue="09:30" />
          </label>
          <label>
            <span>End time <small>(opsional)</small></span>
            <input name="endTime" type="time" />
          </label>
          <label>
            <span>Location</span>
            <div className="workspace-input-with-icon">
              <MapPin size={15} />
              <input name="location" maxLength={300} placeholder="Jakarta Selatan" />
            </div>
          </label>
          <label>
            <span>Objective</span>
            <input name="objective" maxLength={1000} placeholder="Apa yang ingin dicapai dari kunjungan ini?" />
          </label>
        </div>
      </div>

      <div className="workspace-form-section">
        <div>
          <p className="workspace-section-kicker">Assignment</p>
          <h2>Who will attend?</h2>
        </div>
        <div className="workspace-form-grid">
          <label>
            <span>Primary sales</span>
            <select name="primarySalesId" required defaultValue="">
              <option value="" disabled>Pilih sales utama</option>
              {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </label>
          <fieldset className="workspace-checkbox-group">
            <legend>Supporting sales <small>(opsional)</small></legend>
            {salesOptions.map((option) => (
              <label className="workspace-checkbox" key={option.id}>
                <input type="checkbox" name="supportingSalesIds" value={option.id} />
                <span>{option.name}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <div className="workspace-form-footer">
        <Link className="workspace-secondary-button" href="/workspace/missions">Cancel</Link>
        <button className="workspace-primary-button" type="submit" disabled={pending}>
          {pending ? <><Loader2 size={16} className="workspace-spin" /> Menyimpan…</> : <><Plus size={16} /> Save mission</>}
        </button>
      </div>
    </form>
  )
}
