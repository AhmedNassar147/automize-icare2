/*
 *
 * Helper: `handleSetCaseOutcome`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  readLogsAsArray,
  updateCaseInLog,
} from "./summarizeLogsAfterAcceptance.mjs";
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
    const patients = await readLogsAsArray();
    foundPatient = patients.find(({ referralId }) => referralId === caseId);
  }

  if (!foundPatient) {
    return {
      success: false,
      reason: `couldn't find patient in logs data where caseId=${caseId} to set check the delta`,
    };
  }

  const { referralId, readySeenAtLocalMs, waitTime, extraWait } = foundPatient;

  if (!readySeenAtLocalMs || !waitTime) {
    return {
      success: false,
      reason: `couldn't find readySeenAtLocalMs=${readySeenAtLocalMs} or waitTime=${waitTime} extraWait=${extraWait} in logs data where caseId=${caseId} `,
    };
  }

  const outcome = blocked
    ? OUTCOME_MAP.blocked
    : elapsedMs <= 600
      ? OUTCOME_MAP.needLessWait
      : elapsedMs <= 650
        ? OUTCOME_MAP.lowWaiting
        : elapsedMs < 800
          ? OUTCOME_MAP.moderateWaiting
          : elapsedMs < 890
            ? OUTCOME_MAP.goodWaiting
            : elapsedMs < 1100
              ? OUTCOME_MAP.needMoreWait
              : OUTCOME_MAP.nearToBlock;

  createConsoleMessage(
    `caseId=${referralId} case-outcome=${outcome} clickedAt=${clickedAt} elapsed=${elapsedMs}ms readySeenAtLocalMs=${readySeenAtLocalMs} waitTime=${waitTime}ms extraWait=${extraWait}`,
    outcome === "blocked" ? "error" : "warn",
  );

  const tookMs =
    Number.isFinite(clickedAt) && Number.isFinite(readySeenAtLocalMs)
      ? clickedAt - readySeenAtLocalMs - (waitTime || 0)
      : undefined;

  await updateCaseInLog(referralId, {
    status: `${outcome}_${elapsedMs}`,
    clickedAt,
    tookMS: typeof tookMs === "number" ? tookMs : "",
  });

  const delta = getOutcomeDelta(outcome, elapsedMs);

  if (process.env.ENABLE_AUTO_WAITING === "1" && delta !== 0) {
    await updateCaseInLog(referralId, {
      delta: delta,
    });

    const safeExtraWait = Number.isFinite(extraWait) ? extraWait : 0;
    const current = waitTime;
    const baseWait = current - safeExtraWait;
    const nextWaitTime = current + delta;

    updateEnvFile({
      WAIT_FOR_ACCEPT_MS: nextWaitTime,
      // COMPUTED_EXTRA_WAIT: 0,
    });

    const arrow = delta > 0 ? "⬆️" : "⬇️";
    const sign = delta > 0 ? "+" : "";

    await sendTelegramMessage(
      `🆔 caseID: \`${referralId}\`\n` +
        `⏱️ derivedBaseWait: \`${baseWait}\`ms | extraWait: \`${safeExtraWait}\`ms | full: \`${waitTime}\`ms\n` +
        `📋 outcome: \`${outcome}\` | elapsed: \`${elapsedMs}\`ms\n` +
        `${arrow} finalWait: \`${nextWaitTime}\`ms (${sign}${delta}ms)`,
    );
  }

  return {
    success: true,
    outcome,
  };
};

export default handleSetCaseOutcome;
