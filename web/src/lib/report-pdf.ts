import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SessionDiagnosticResponse } from "@/lib/api-client";
import { trackAnalyticsEvent } from "@/lib/analytics";

export interface PdfReportOptions {
  patientName?: string;
  patientId?: string;
  evaluator?: string;
  clinicianName?: string;
  facilityName?: string;
  etiology?: string;
}

/**
 * Generates a unified, detailed, publication-grade clinical diagnostic PDF report
 * with non-overlapping header typography, executive metric cards, detailed multi-utterance
 * battery breakdown table, and clinical recommendations.
 */
export function generateClinicalPdfReport(
  report: SessionDiagnosticResponse,
  options?: PdfReportOptions
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Color Palette
  const primaryDark = [15, 23, 42]; // #0F172A
  const primaryCyan = [14, 165, 233]; // #0EA5E9
  const emeraldGreen = [16, 185, 129]; // #10B981
  const alertRose = [225, 29, 72]; // #E11D48
  const warningAmber = [217, 119, 6]; // #D97706
  const bgSlate = [248, 250, 252]; // #F8FAFC
  const borderSlate = [226, 232, 240]; // #E2E8F0
  const textMuted = [100, 116, 139]; // #64748B
  const textDark = [30, 41, 59]; // #1E293B

  const isDys = report.is_dysarthric;
  const statusColor = isDys
    ? report.consensus_severity.toLowerCase() === "severe"
      ? alertRose
      : warningAmber
    : emeraldGreen;

  // ----------------------------------------------------
  // 1. TOP HEADER BANNER (Non-overlapping layout)
  // ----------------------------------------------------
  const headerHeight = 32;
  doc.setFillColor(primaryDark[0], primaryDark[1], primaryDark[2]);
  doc.rect(0, 0, pageWidth, headerHeight, "F");

  // Cyan accent bar under header
  doc.setFillColor(primaryCyan[0], primaryCyan[1], primaryCyan[2]);
  doc.rect(0, headerHeight, pageWidth, 1.8, "F");

  // Status Badge on Right (measured first so title never collides)
  const statusBadgeText = isDys
    ? "FLAGGED: SPEECH IMPAIRMENT"
    : "NORMAL SPEECH PROFILE";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const badgeWidth = doc.getTextWidth(statusBadgeText) + 10;
  const badgeX = pageWidth - margin - badgeWidth;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.roundedRect(badgeX, 7.5, badgeWidth, 7.5, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.text(statusBadgeText, badgeX + 5, 12.5);

  // Title & Subtitle on Left (constrained to left of badge)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("DysarthriaNet-XC  |  Diagnostic Report", margin, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.2);
  doc.setTextColor(148, 163, 184); // #94A3B8
  doc.text(
    "Acoustic Motor Speech Evaluation & Multi-Utterance Clinical Screening Summary",
    margin,
    19
  );

  doc.setFontSize(7.8);
  doc.setTextColor(203, 213, 225); // #CBD5E1
  const generatedStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(
    `Session Ref: #${report.session_id.toUpperCase()}   |   Recorded: ${report.timestamp || generatedStr}   |   Exported: ${generatedStr}`,
    margin,
    26
  );

  // ----------------------------------------------------
  // 2. PATIENT & SESSION METADATA STRIP
  // ----------------------------------------------------
  let currentY = 39;
  doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.roundedRect(margin, currentY, contentWidth, 18, 2.5, 2.5, "FD");

  const colW = contentWidth / 4;
  const metaFields = [
    {
      label: "PATIENT / SUBJECT",
      val: options?.patientName || "Evaluated Participant",
    },
    {
      label: "SESSION IDENTIFIER",
      val: report.session_id,
    },
    {
      label: "PRIMARY CONDITION / NOTE",
      val: options?.etiology || `${report.total_utterances} Vocal Tasks Evaluated`,
    },
    {
      label: "ACOUSTIC ENGINE",
      val: "Wav2Vec 2.0 + CORAL v1.0",
    },
  ];

  metaFields.forEach((field, i) => {
    const fx = margin + i * colW + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(field.label, fx, currentY + 6.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(doc.splitTextToSize(String(field.val), colW - 6)[0], fx, currentY + 13);
  });

  currentY += 24;

  // ----------------------------------------------------
  // 3. EXECUTIVE CLINICAL FINDINGS (3 STAT CARDS)
  // ----------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Executive Diagnostic Evaluation", margin, currentY);

  currentY += 4;
  const cardW = (contentWidth - 6) / 3;
  const cardH = 26;

  // Card 1: Dysarthria Probability
  const probPct = Math.round(report.consensus_probability * 100);
  doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.roundedRect(margin, currentY, cardW, cardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("DYSARTHRIA PROBABILITY", margin + 4, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(`${probPct}%`, margin + 4, currentY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Consensus Vote: ${report.dysarthria_vote_ratio} tasks flagged`,
    margin + 4,
    currentY + 22
  );

  // Card 2: Consensus Severity
  const c2X = margin + cardW + 3;
  doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
  doc.roundedRect(c2X, currentY, cardW, cardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("GRADED SEVERITY LEVEL", c2X + 4, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(report.consensus_severity.toUpperCase(), c2X + 4, currentY + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text(
    `Confidence Rating: ${report.confidence_rating}`,
    c2X + 4,
    currentY + 22
  );

  // Card 3: Clinical Diagnostic Verdict
  const c3X = c2X + cardW + 3;
  doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
  doc.roundedRect(c3X, currentY, cardW, cardH, 2.5, 2.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.8);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  doc.text("CONSENSUS VERDICT", c3X + 4, currentY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  const splitDiag = doc.splitTextToSize(report.consensus_diagnosis, cardW - 8);
  doc.text(splitDiag, c3X + 4, currentY + 14);

  currentY += cardH + 8;

  // ----------------------------------------------------
  // 4. CLINICAL RECOMMENDATION & GUIDANCE CALLOUT BOX
  // ----------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Clinical Assessment & Recommended Action Plan", margin, currentY);

  currentY += 3.5;
  const clinicalGuidance = [
    report.clinical_recommendation,
    "",
    isDys
      ? "Clinical Context: Acoustic markers indicate deviations in articulatory precision, phonatory stability, or syllable cadence. Note that dysarthria is strictly a neuromotor speech execution condition affecting vocal tract muscle coordination—it does not reflect cognitive impairment or intelligence."
      : "Clinical Context: Vocal stability, diadochokinetic syllable repetition rate, and connected speech prosody are within healthy clinical reference limits across the evaluated tasks.",
  ].join("\n");

  const recLines = doc.splitTextToSize(clinicalGuidance, contentWidth - 12);
  const recBoxH = Math.max(20, recLines.length * 4.1 + 8);

  doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.roundedRect(margin, currentY, contentWidth, recBoxH, 2.5, 2.5, "FD");

  // Left accent border strip
  doc.setFillColor(primaryCyan[0], primaryCyan[1], primaryCyan[2]);
  doc.roundedRect(margin, currentY, 2.8, recBoxH, 1.2, 1.2, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text(recLines, margin + 6.5, currentY + 6.5);

  currentY += recBoxH + 8;

  // ----------------------------------------------------
  // 5. MULTI-UTTERANCE BATTERY BREAKDOWN TABLE
  // ----------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(textDark[0], textDark[1], textDark[2]);
  doc.text("Multi-Utterance Speech Battery Breakdown", margin, currentY);

  currentY += 2.5;

  const tableRows = report.utterances.map((u) => {
    const taskNameFormatted = u.task_name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const probFormatted = `${Math.round(u.dysarthria_probability * 100)}%`;
    const sevBreakdown = u.severity_probabilities
      ? `M:${Math.round(u.severity_probabilities.mild * 100)}% / Mod:${Math.round(
          u.severity_probabilities.moderate * 100
        )}% / S:${Math.round(u.severity_probabilities.severe * 100)}%`
      : "—";
    const durStr = u.audio_quality?.duration_seconds
      ? `${u.audio_quality.duration_seconds.toFixed(1)}s`
      : "—";
    const severityFormatted = u.is_dysarthric
      ? u.predicted_severity.toUpperCase()
      : "NORMAL";
    const statusFormatted = u.is_dysarthric ? "FLAGGED" : "PASS";

    return [
      `#${u.utterance_index}`,
      taskNameFormatted,
      u.filename,
      durStr,
      probFormatted,
      sevBreakdown,
      severityFormatted,
      statusFormatted,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "#",
        "Speech Task",
        "Audio File",
        "Duration",
        "Dys. Prob",
        "Severity Distribution",
        "Grade",
        "Result",
      ],
    ],
    body: tableRows,
    theme: "striped",
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: "bold",
      halign: "left",
      cellPadding: 2.8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2.6,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 34, fontStyle: "bold" },
      2: { cellWidth: 32, textColor: [100, 116, 139] },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 35, halign: "center", fontSize: 6.8 },
      6: { cellWidth: 20, halign: "center", fontStyle: "bold" },
      7: { cellWidth: 18, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        if (data.cell.raw === "FLAGGED") {
          data.cell.styles.textColor = [225, 29, 72];
        } else {
          data.cell.styles.textColor = [16, 185, 129];
        }
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTable = (doc as any).lastAutoTable;
  currentY = (lastTable ? lastTable.finalY : currentY + 45) + 7;

  // ----------------------------------------------------
  // 6. PER-UTTERANCE CLINICAL OBSERVATIONS
  // ----------------------------------------------------
  if (report.utterances.some((u) => u.clinical_note) && currentY < pageHeight - 65) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text("Task-Level Acoustic Observations", margin, currentY);
    currentY += 3;

    const noteLines = report.utterances
      .map(
        (u) =>
          `• Task #${u.utterance_index} (${u.task_name.replace(/_/g, " ")}): ${
            u.clinical_note ||
            (u.is_dysarthric
              ? "Motor speech deviations detected."
              : "Within normal acoustic thresholds.")
          }`
      )
      .join("\n");
    const splitNotes = doc.splitTextToSize(noteLines, contentWidth - 8);
    const notesH = Math.max(14, splitNotes.length * 3.8 + 6);

    doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, contentWidth, notesH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(splitNotes, margin + 4, currentY + 5);

    currentY += notesH + 6;
  }

  // ----------------------------------------------------
  // 7. TECHNICAL BENCHMARK & METHODOLOGY VERIFICATION
  // ----------------------------------------------------
  if (currentY < pageHeight - 36) {
    doc.setFillColor(bgSlate[0], bgSlate[1], bgSlate[2]);
    doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
    doc.roundedRect(margin, currentY, contentWidth, 17, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text("METHODOLOGY & CLINICAL VALIDATION SUMMARY", margin + 4, currentY + 4.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    const techNotes =
      "• Architecture: DysarthriaNet-XC Unified Classifier combining 768-D Wav2Vec 2.0 representations with CORAL domain alignment and cost-sensitive severity grading.\n" +
      "• Multi-Corpus Calibration: Validated across TORGO, EasyCall, and Italian Parkinson's datasets (31,634 reference clips) with automatic microphone gain normalization.";
    doc.text(doc.splitTextToSize(techNotes, contentWidth - 8), margin + 4, currentY + 8.5);
  }

  // ----------------------------------------------------
  // 8. LEGAL DISCLAIMER & PAGE FOOTER
  // ----------------------------------------------------
  const footerY = pageHeight - 11;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
  const disclaimer =
    "DISCLAIMER: DysarthriaNet-XC is an AI-assisted motor speech screening and clinical decision-support tool. It does not replace a comprehensive evaluation by a certified Speech-Language Pathologist (SLP) or neurologist.";
  doc.text(doc.splitTextToSize(disclaimer, contentWidth), margin, footerY - 3.5);

  doc.setDrawColor(borderSlate[0], borderSlate[1], borderSlate[2]);
  doc.line(margin, footerY + 1.5, pageWidth - margin, footerY + 1.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(
    "DysarthriaNet-XC v1.0.0 Unified Diagnostic Report   |   Confidential Clinical Record",
    margin,
    footerY + 5
  );
  doc.text("Page 1 of 1", pageWidth - margin - 15, footerY + 5);

  const filename = `DysarthriaNet_Diagnostic_Report_${report.session_id}.pdf`;
  trackAnalyticsEvent({
    eventType: "pdf_downloaded",
    metadata: {
      sessionId: report.session_id,
      severity: report.consensus_severity,
    },
  });
  doc.save(filename);
}
