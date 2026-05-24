/*
 *
 * Helper: `handleSetCaseOutcome`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";
import updateEnvFile from "./updateEnvFile.mjs";

const handleSetCaseOutcome = async ({
  elapsedMs,
  clickedAt,
  blocked,
  referralId: caseId,
  patientsStore,
  sendTelegramMessage,
}) => {
  if (!caseId) {
    return {
      success: false,
      reason: "missing caseId",
    };
  }

  if (typeof elapsedMs !== "number") {
    createConsoleMessage(
      `Missed elapsedMs=${elapsedMs}ms where caseId=${caseId}`,
      "error",
    );

    return {
      success: false,
      reason: "missing elapsedMs",
    };
  }

  let foundPatient = null;

  if (caseId) {
    const { patient } = patientsStore.findPatientByReferralId(caseId);
    if (patient) {
      foundPatient = patient;
    }
  }

  const patientData = foundPatient || patientsStore.getFirstGoingToAccept();

  const { referralId, referralEndTimestamp, readySeenAtLocalMs, waitTime } =
    patientData || {};

  const outcome = blocked
    ? "blocked"
    : elapsedMs < 600
      ? "need-less-wait" // 0% — definitely too late
      : elapsedMs < 650
        ? "low-waiting" // 25% — borderline, slight nudge
        : elapsedMs < 800
          ? "moderate-waiting" // 33-50% — ok but not optimal
          : elapsedMs < 890
            ? "good-waiting" // 75% — TARGET
            : elapsedMs < 1100
              ? "need-more-wait" // 0% above range
              : "near-to-block";

  createConsoleMessage(
    `caseId=${referralId} case-outcome=${outcome} clickedAt=${clickedAt} elapsed=${elapsedMs}ms readySeenAtLocalMs=${readySeenAtLocalMs} waitTime=${waitTime}ms`,
    outcome === "blocked" ? "error" : "warn",
  );

  if (patientData) {
    await updateCaseInLog(referralId, {
      status: `${outcome}_${elapsedMs}`,
      clickedAt,
      tookMS: clickedAt - readySeenAtLocalMs - (waitTime || 0),
    });
  }

  if (process.env.ENABLE_AUTO_WAITING === "1" && patientData) {
    const delta =
      {
        blocked: +5,
        "near-to-block": +4,
        "need-more-wait": +2,
        "good-waiting": 0,
        "moderate-waiting": elapsedMs < 770 ? 0 : -1,
        "low-waiting": -1,
        "need-less-wait": -2,
      }[outcome] ?? 0;

    if (delta !== 0) {
      const current = Number(process.env.WAIT_FOR_ACCEPT_MS);
      const nextWaitTime = current + delta;
      updateEnvFile({ WAIT_FOR_ACCEPT_MS: nextWaitTime });

      const arrow = delta > 0 ? "⬆️" : "⬇️";
      const sign = delta > 0 ? "+" : "";

      await sendTelegramMessage(
        `${arrow} waitTime \`${current}\`→\`${nextWaitTime}\`ms (${sign}${delta}ms)\n` +
          `📋 outcome: \`${outcome}\` elapsed: \`${elapsedMs}\`ms\n` +
          `🆔 case: \`${referralId}\``,
      );
    }
  }

  return {
    success: true,
    outcome,
  };
};

export default handleSetCaseOutcome;
