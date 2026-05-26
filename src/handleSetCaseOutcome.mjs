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

  const { referralId, readySeenAtLocalMs, waitTime } = patientData || {};

  const outcome = blocked
    ? "blocked"
    : elapsedMs < 600
      ? "need-less-wait"
      : elapsedMs < 650
        ? "low-waiting"
        : elapsedMs < 800
          ? "moderate-waiting"
          : elapsedMs < 890
            ? "good-waiting"
            : elapsedMs < 1100
              ? "need-more-wait"
              : "near-to-block";

  createConsoleMessage(
    `caseId=${referralId} case-outcome=${outcome} clickedAt=${clickedAt} elapsed=${elapsedMs}ms readySeenAtLocalMs=${readySeenAtLocalMs} waitTime=${waitTime}ms`,
    outcome === "blocked" ? "error" : "warn",
  );

  const tookMs =
    Number.isFinite(clickedAt) && Number.isFinite(readySeenAtLocalMs)
      ? clickedAt - readySeenAtLocalMs - (waitTime || 0)
      : undefined;

  if (patientData) {
    await updateCaseInLog(referralId, {
      status: `${outcome}_${elapsedMs}`,
      clickedAt,
      tookMS: typeof tookMs === "number" ? tookMs : "",
    });
  }

  if (process.env.ENABLE_AUTO_WAITING === "1" && patientData) {
    const delta =
      {
        "need-less-wait": -2,
        "low-waiting": -1,
        "moderate-waiting": elapsedMs <= 700 ? -1 : 0,
        "need-more-wait": elapsedMs < 910 ? +1 : +2,
        "good-waiting": 0,
        "near-to-block": elapsedMs > 2100 ? +6 : +3,
        blocked: 0,
      }[outcome] ?? 0;

    if (delta !== 0) {
      const currentRaw = Number(process.env.WAIT_FOR_ACCEPT_MS);
      const current = Number.isFinite(currentRaw) ? currentRaw : 0;
      const nextWaitTime = current + delta;
      updateEnvFile({ WAIT_FOR_ACCEPT_MS: nextWaitTime });

      const arrow = delta > 0 ? "⬆️" : "⬇️";
      const sign = delta > 0 ? "+" : "";

      await sendTelegramMessage(
        `${arrow} waitTime \`${current}\`→\`${nextWaitTime}\`ms (${sign}${delta}ms)\n` +
          `📋 outcome: \`${outcome}\` elapsed: \`${elapsedMs}\`ms\n` +
          `🆔 case: \`${referralId}\``,
      );

      await updateCaseInLog(referralId, {
        delta: delta,
      });
    }
  }

  return {
    success: true,
    outcome,
  };
};

export default handleSetCaseOutcome;
