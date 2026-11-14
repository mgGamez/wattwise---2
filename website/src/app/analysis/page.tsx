"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ResultView } from "@/components/result";
import { IconArrowLeft, IconTrash } from "@/components/icons";
import { Button, ButtonLink, ConfirmInline, EmptyState } from "@/components/ui";
import { deleteAnalysis, toggleAction, useAppState } from "@/lib/storage";
import { fmtRelative } from "@/lib/time";

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisDetail />
    </Suspense>
  );
}

function AnalysisDetail() {
  const state = useAppState()!;
  const id = useSearchParams().get("id");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const a = state.analyses.find((x) => x.id === id);

  if (!a) {
    return (
      <EmptyState title="Analysis not found" body="It may have been deleted, or it was saved in a different browser.">
        <ButtonLink href="/history/">Back to history</ButtonLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/history/" variant="ghost">
          <IconArrowLeft size={18} /> History
        </ButtonLink>
        <span className="text-sm text-ink-3">Analyzed {fmtRelative(a.createdAt)}</span>
      </div>
      <ResultView
        data={a}
        tariff={state.tariff}
        checks={state.actions[a.id]}
        onToggleAction={(aid) => toggleAction(a.id, aid)}
        footer={
          <div className="flex justify-end">
            {confirm ? (
              <ConfirmInline
                prompt="Delete this analysis?"
                confirmLabel="Delete"
                onConfirm={() => {
                  deleteAnalysis(a.id);
                  router.replace("/history/");
                }}
                onCancel={() => setConfirm(false)}
              />
            ) : (
              <Button variant="ghost" onClick={() => setConfirm(true)}>
                <IconTrash size={18} /> Delete analysis
              </Button>
            )}
          </div>
        }
      />
    </div>
  );
}
