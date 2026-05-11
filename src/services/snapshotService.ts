import { supabase } from "../lib/supabase.js";

export interface PromiseSnapshot {
  promise_id: string;
  previous_status: string | null;
  new_status: string;
  previous_score: number | null;
  new_score: number | null;
  changed_by: string;
  change_reason: string;
  metadata: Record<string, any>;
}

export async function savePromiseSnapshot(snapshot: PromiseSnapshot): Promise<void> {
  try {
    const { error } = await supabase.from("promise_audit_log").insert({
      promise_id: snapshot.promise_id,
      action: "status_change",
      previous_status: snapshot.previous_status,
      new_status: snapshot.new_status,
      previous_score: snapshot.previous_score,
      new_score: snapshot.new_score,
      changed_by: snapshot.changed_by,
      change_reason: snapshot.change_reason,
      previous_value: snapshot.previous_status ? { status: snapshot.previous_status, score: snapshot.previous_score } : null,
      new_value: { status: snapshot.new_status, score: snapshot.new_score, ...snapshot.metadata },
      metadata: snapshot.metadata
    });

    if (error) {
      console.error(`[Snapshot] Failed to save snapshot: ${error.message}`);
    } else {
      console.log(`[Snapshot] Saved for promise ${snapshot.promise_id}: ${snapshot.previous_status} → ${snapshot.new_status}`);
    }
  } catch (err) {
    console.error("[Snapshot] Error saving promise snapshot:", err);
  }
}

export async function getPromiseHistory(promiseId: string) {
  try {
    const { data, error } = await supabase
      .from("promise_audit_log")
      .select("*")
      .eq("promise_id", promiseId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("[Snapshot] Error fetching history:", err);
    return [];
  }
}

export function generateDiff(prev: any, next: any): Record<string, { from: any; to: any }> {
  const diff: Record<string, { from: any; to: any }> = {};

  const allKeys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
  for (const key of allKeys) {
    if (JSON.stringify(prev?.[key]) !== JSON.stringify(next?.[key])) {
      diff[key] = { from: prev?.[key], to: next?.[key] };
    }
  }

  return diff;
}

export async function uploadEvidence(
  file: Buffer,
  fileName: string,
  mimeType: string,
  promiseId: string,
  uploadedBy?: string
): Promise<{ url: string; error?: string }> {
  const MAX_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "video/mp4"];

  if (file.length > MAX_SIZE) {
    return { url: "", error: "Arquivo maior que 10MB" };
  }

  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { url: "", error: `Tipo de arquivo não permitido. Aceitos: PDF, JPG, PNG, MP4` };
  }

  const ext = fileName.split(".").pop() || "bin";
  const path = `evidences/${promiseId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const { data, error } = await supabase.storage
      .from("evidences")
      .upload(path, file, {
        contentType: mimeType,
        cacheControl: "31536000"
      });

    if (error) {
      if (error.message.includes("not found") || error.message.includes("bucket")) {
        return { url: "", error: "Bucket de armazenamento não configurado. Configure o bucket 'evidences' no Supabase Storage." };
      }
      return { url: "", error: error.message };
    }

    const { data: urlData } = supabase.storage.from("evidences").getPublicUrl(path);
    return { url: urlData.publicUrl };
  } catch (err: any) {
    return { url: "", error: err.message };
  }
}

export default {
  savePromiseSnapshot,
  getPromiseHistory,
  generateDiff,
  uploadEvidence
};