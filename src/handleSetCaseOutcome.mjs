/*
 *
 * Helper: `handleSetCaseOutcome`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import getOutcomeDelta from "./getOutcomeDelta.mjs";
import { OUTCOME_MAP } from "./constants.mjs";

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
    ? OUTCOME_MAP.blocked
    : elapsedMs < 600
      ? OUTCOME_MAP.needLessWait
      : elapsedMs < 650
        ? OUTCOME_MAP.lowWaiting
        : elapsedMs < 800
          ? OUTCOME_MAP.moderateWaiting
          : elapsedMs < 890
            ? OUTCOME_MAP.goodWaiting
            : elapsedMs < 1100
              ? OUTCOME_MAP.needMoreWait
              : OUTCOME_MAP.nearToBlock;

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
    const delta = getOutcomeDelta(outcome, elapsedMs);

    if (delta !== 0) {
      const currentRaw = Number(process.env.WAIT_FOR_ACCEPT_MS);
      const addedWait = Number(process.env.COMPUTED_EXTRA_WAIT || 0) || 0;
      const current = Number.isFinite(currentRaw) ? currentRaw : 0;
      const baseWait = current - addedWait;
      const nextWaitTime = baseWait + delta;
      updateEnvFile({
        WAIT_FOR_ACCEPT_MS: nextWaitTime,
        COMPUTED_EXTRA_WAIT: 0,
      });

      const arrow = delta > 0 ? "⬆️" : "⬇️";
      const sign = delta > 0 ? "+" : "";

      await sendTelegramMessage(
        `${arrow} baseWait \`${baseWait}\`→\`${nextWaitTime}\`ms (${sign}${delta}ms)\n` +
          `⏱️ finalWait: \`${current}\`ms | extraWait: \`${addedWait}\`ms\n` +
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
