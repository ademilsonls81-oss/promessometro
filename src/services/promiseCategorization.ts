import { supabase } from "../lib/supabase.js";

interface PromiseStatus {
  promiseId: string;
  currentStatus: string;
  newStatus: string;
  confidence: number;
  evidenceSummary: {
    fulfilled: number;
    partial: number;
    broken: number;
    neutral: number;
  };
}

export async function autoCategorizePromise(promiseId: string): Promise<PromiseStatus | null> {
  const { data: evidences, error } = await supabase
    .from("promise_evidences")
    .select("evidence_type, confidence_score, validation_status")
    .eq("promise_id", promiseId)
    .eq("validation_status", "approved");

  if (error || !evidences || evidences.length === 0) {
    console.log(`[Categorization] No approved evidences for promise ${promiseId}`);
    return null;
  }

  const evidenceSummary = {
    fulfilled: 0,
    partial: 0,
    broken: 0,
    neutral: 0
  };

  let totalConfidence = 0;

  evidences.forEach((e: any) => {  // any-ok
    if (e.evidence_type === "fulfillment") {
      evidenceSummary.fulfilled++;
      totalConfidence += e.confidence_score || 50;
    } else if (e.evidence_type === "partial") {
      evidenceSummary.partial++;
      totalConfidence += (e.confidence_score || 50) * 0.5;
    } else if (e.evidence_type === "break") {
      evidenceSummary.broken++;
      totalConfidence += e.confidence_score || 50;
    } else {
      evidenceSummary.neutral++;
    }
  });

  const avgConfidence = Math.round(totalConfidence / evidences.length);

  let newStatus = "pending_analysis";
  const totalRelevant = evidenceSummary.fulfilled + evidenceSummary.partial + evidenceSummary.broken;

  if (totalRelevant >= 2) {
    if (evidenceSummary.fulfilled >= evidenceSummary.broken + 2) {
      newStatus = "fulfilled";
    } else if (evidenceSummary.broken >= evidenceSummary.fulfilled + 2) {
      newStatus = "broken";
    } else if (evidenceSummary.partial > 0) {
      newStatus = "partial";
    } else if (evidenceSummary.fulfilled > evidenceSummary.broken) {
      newStatus = "partial";
    } else if (evidenceSummary.broken > evidenceSummary.fulfilled) {
      newStatus = "partial";
    }
  }

  const { data: promise } = await supabase
    .from("promises")
    .select("status")
    .eq("id", promiseId)
    .single();

  const currentStatus = promise?.status || "pending_analysis";

  if (currentStatus === newStatus) {
    console.log(`[Categorization] Promise ${promiseId} already has status: ${newStatus}`);
    return { promiseId, currentStatus, newStatus, confidence: avgConfidence, evidenceSummary };
  }

  const { error: updateError } = await supabase
    .from("promises")
    .update({
      status: newStatus,
      fulfillment_score: calculateFulfillmentScore(evidenceSummary),
      updated_at: new Date().toISOString()
    })
    .eq("id", promiseId);

  if (updateError) {
    console.error(`[Categorization] Error updating promise:`, updateError);
    return null;
  }

  console.log(`[Categorization] Promise ${promiseId}: ${currentStatus} → ${newStatus} (confidence: ${avgConfidence}%)`);

  return { promiseId, currentStatus, newStatus, confidence: avgConfidence, evidenceSummary };
}

function calculateFulfillmentScore(summary: { fulfilled: number; partial: number; broken: number }): number {
  const total = summary.fulfilled + summary.partial + summary.broken;
  if (total === 0) return 50;
  
  const score = ((summary.fulfilled * 100) + (summary.partial * 50)) / total;
  return Math.round(score);
}

export async function batchCategorizeAllPromises(): Promise<{
  processed: number;
  updated: number;
  results: PromiseStatus[];
}> {
  const { data: promises } = await supabase
    .from("promises")
    .select("id")
    .eq("status", "pending_analysis");

  const results: PromiseStatus[] = [];
  let updated = 0;

  if (promises) {
    for (const promise of promises) {
      const result = await autoCategorizePromise(promise.id);
      if (result) {
        results.push(result);
        if (result.currentStatus !== result.newStatus) {
          updated++;
        }
      }
    }
  }

  return { processed: promises?.length || 0, updated, results };
}

export async function getPromiseWithEvidenceAnalysis(promiseId: string): Promise<any> {
  const { data: promise } = await supabase
    .from("promises")
    .select("*")
    .eq("id", promiseId)
    .single();

  if (!promise) return null;

  const { data: evidences } = await supabase
    .from("promise_evidences")
    .select("*")
    .eq("promise_id", promiseId)
    .eq("validation_status", "approved")
    .order("confidence_score", { ascending: false });

  const approvedCount = evidences?.length || 0;
  const evidenceTypes = { fulfillment: 0, partial: 0, break: 0, neutral: 0 };

  evidences?.forEach((e: any) => {  // any-ok
    if (e.evidence_type === "fulfillment") evidenceTypes.fulfillment++;
    else if (e.evidence_type === "partial") evidenceTypes.partial++;
    else if (e.evidence_type === "break") evidenceTypes.break++;
    else evidenceTypes.neutral++;
  });

  return {
    ...promise,
    evidence_analysis: {
      total_approved: approvedCount,
      breakdown: evidenceTypes,
      has_sufficient_evidence: approvedCount >= 2,
      recommendation: getRecommendation(evidenceTypes, approvedCount)
    }
  };
}

function getRecommendation(types: { fulfillment: number; partial: number; break: number }, count: number): string {
  if (count < 2) return "Aguardando mais evidências";
  
  if (types.fulfillment >= types.break + 2) return "Alta probabilidade de cumprimento";
  if (types.break >= types.fulfillment + 2) return "Alta probabilidade de descumprimento";
  if (types.partial > 0) return "Evidências mistas - análise manual recomendada";
  if (types.fulfillment > types.break) return "Evidências sugerem cumprimento parcial";
  if (types.break > types.fulfillment) return "Evidências sugerem descumprimento";
  
  return "Evidências inconclusivas";
}