/*
 *
 * Patients Store
 *
 */
import EventEmitter from "events";
import writePatientData from "./writePatientData.mjs";
import waitMinutesThenRun from "./waitMinutesThenRun.mjs";
import {
  COLLECTD_PATIENTS_FILE_NAME,
  USER_MESSAGES,
  USER_ACTION_TYPES,
} from "./constants.mjs";

async function safeWritePatientData(data, retries = 3, delay = 200) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await writePatientData(
        (data || []).reverse(),
        COLLECTD_PATIENTS_FILE_NAME
      );
      return;
    } catch (err) {
      if (attempt === retries) {
        console.error("❌ Failed to write patient data after retries:", err);
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

class PatientStore extends EventEmitter {
  constructor(initialPatients = [], pauseFetchingPatients) {
    super();
    this.patientsById = new Map();
    this.goingPatientsToBeAccepted = new Set();
    this.goingPatientsToBeRejected = new Set();
    this.patientTimers = new Map();
    this.cachedPatientsArray = null;
    this.pauseFetchingPatients = pauseFetchingPatients;
    this.scoreTourStarted = false;

    for (const patient of initialPatients) {
      if (!patient) continue;
      const key = this.keyExtractor(patient);
      if (!key) continue;
      this.patientsById.set(key, patient);
    }
  }

  keyExtractor(patient = {}) {
    const id = patient.referralId;
    return typeof id === "string" && id.trim() !== "" ? id : null;
  }

  invalidateCache() {
    this.cachedPatientsArray = null;
  }

  getAllPatients() {
    if (!this.cachedPatientsArray) {
      this.cachedPatientsArray = Array.from(this.patientsById.values());
    }
    return this.cachedPatientsArray;
  }

  async scheduleAllInitialPatients() {
    const allPatients = this.getAllPatients();

    if (!allPatients.length) {
      return;
    }

    for (const patient of allPatients) {
      const key = this.keyExtractor(patient);
      if (!key) continue;

      const { userActionName } = patient;

      if (!userActionName) {
        continue;
      }

      const isRejection = userActionName === USER_ACTION_TYPES.REJECT;
      const canProcess = isRejection
        ? true
        : this.calculateCanStillProcessPatient(patient);

      if (!canProcess) continue;

      const { message } = await this.schedulePatientAction({
        actionSet: isRejection
          ? this.goingPatientsToBeRejected
          : this.goingPatientsToBeAccepted,
        eventName: isRejection ? "patientRejected" : "patientAccepted",
        patient,
        skipResetingPatient: true,
        isSuperAcceptance: patient.isSuperAcceptance,
      });

      console.log(`Called From Initial Schedule: ${message}`);
    }
  }

  async addPatients(patients) {
    const newPatients = Array.isArray(patients) ? patients : [patients];
    const added = [];

    for (const patient of newPatients) {
      const key = this.keyExtractor(patient);
      if (key && !this.patientsById.has(key)) {
        const { files, ...patientData } = patient;
        this.patientsById.set(key, patientData);
        added.push(patient);
      }
    }

    if (added.length) {
      this.invalidateCache();
      this.emit("patientsAdded", added);
      await safeWritePatientData(this.getAllPatients());
    }
  }

  async removePatientByReferralId(referralId) {
    const patient = this.patientsById.get(referralId);
    if (!patient) {
      return { success: false, message: USER_MESSAGES.notFound };
    }

    this.patientsById.delete(referralId);
    this.invalidateCache();

    const timer = this.patientTimers.get(referralId);
    if (timer) {
      timer.cancel();
      this.patientTimers.delete(referralId);
    }

    this.goingPatientsToBeAccepted.delete(referralId);
    this.goingPatientsToBeRejected.delete(referralId);

    await safeWritePatientData(this.getAllPatients());
    return {
      success: true,
      message: `✅ Patient with referralId=${referralId} just removed.`,
    };
  }

  findPatientByReferralId(referralId) {
    const patient = this.patientsById.get(referralId);
    return { patient, message: patient ? undefined : USER_MESSAGES.notFound };
  }

  calculateCanStillProcessPatient(patient) {
    const { referralEndDateActionableAtMS } = patient;

    if (
      typeof referralEndDateActionableAtMS !== "number" ||
      !referralEndDateActionableAtMS
    )
      return false;

    const now = Date.now();

    return now < referralEndDateActionableAtMS;
  }

  canStillProcessPatient(referralId) {
    const { patient, message } = this.findPatientByReferralId(referralId);
    if (message) {
      return { success: false, message };
    }

    const canProcess = this.calculateCanStillProcessPatient(patient);
    return {
      success: canProcess,
      message: canProcess ? USER_MESSAGES.canProcess : USER_MESSAGES.expired,
    };
  }

  async schedulePatientAction({
    actionSet,
    eventName,
    patient,
    scheduledAt,
    skipResetingPatient,
    isSuperAcceptance,
  }) {
    const { referralId, referralEndDateActionableAtMS } = patient;
    const isAccepting = eventName === "patientAccepted";

    if (typeof referralEndDateActionableAtMS !== "number") {
      return {
        message: `Invalid = referralEndDateActionableAtMS date: ${referralEndDateActionableAtMS}`,
        success: false,
      };
    }

    if (actionSet.has(referralId) || this.patientTimers.has(referralId)) {
      return {
        success: false,
        message: isAccepting
          ? USER_MESSAGES.alreadyScheduledAccept
          : USER_MESSAGES.alreadyScheduledReject,
      };
    }

    const timer = waitMinutesThenRun(referralEndDateActionableAtMS, () => {
      this.pauseFetchingPatients?.();
      actionSet.delete(referralId);
      this.patientTimers.delete(referralId);
      this.emit(
        eventName,
        isAccepting ? { ...patient, isSuperAcceptance } : patient
      );
    });

    actionSet.add(referralId);
    this.patientTimers.set(referralId, timer);

    if (!skipResetingPatient) {
      const updatedPatient = {
        ...patient,
        scheduledAt,
        isSuperAcceptance,
        userActionName: isAccepting
          ? USER_ACTION_TYPES.ACCEPT
          : USER_ACTION_TYPES.REJECT,
      };

      this.patientsById.set(referralId, updatedPatient);
      this.invalidateCache();

      await safeWritePatientData(this.getAllPatients());
    }

    return {
      success: true,
      message: isAccepting
        ? USER_MESSAGES.scheduleAcceptSuccess
        : USER_MESSAGES.scheduleRejectSuccess,
    };
  }

  async scheduleAcceptedPatient(referralId, scheduledAt, isSuperAcceptance) {
    const { patient, message } = this.findPatientByReferralId(referralId);
    if (message) {
      return { success: false, message };
    }

    return await this.schedulePatientAction({
      actionSet: this.goingPatientsToBeAccepted,
      eventName: "patientAccepted",
      patient,
      scheduledAt,
      isSuperAcceptance,
    });
  }

  async scheduleRejectedPatient(referralId, scheduledAt) {
    const { patient, message } = this.findPatientByReferralId(referralId);
    if (message) {
      return { success: false, message };
    }

    return await this.schedulePatientAction({
      actionSet: this.goingPatientsToBeRejected,
      eventName: "patientRejected",
      patient,
      scheduledAt,
    });
  }

  has(referralId) {
    return this.patientsById.has(referralId);
  }

  cancelPatient(referralId) {
    const isAccepted = this.goingPatientsToBeAccepted.has(referralId);
    const isRejected = this.goingPatientsToBeRejected.has(referralId);

    if (!isAccepted && !isRejected) {
      return { success: false, message: USER_MESSAGES.noAction };
    }

    const timer = this.patientTimers.get(referralId);
    if (timer) {
      timer.cancel();
      this.patientTimers.delete(referralId);
    }

    [this.goingPatientsToBeAccepted, this.goingPatientsToBeRejected].forEach(
      (set) => set.delete(referralId)
    );

    return { success: true, message: USER_MESSAGES.cancelSuccess };
  }

  size() {
    return this.patientsById.size;
  }

  clear() {
    this.patientsById.clear();
    this.goingPatientsToBeAccepted.clear();
    this.goingPatientsToBeRejected.clear();
    this.patientTimers.forEach((timer) => timer.cancel());
    this.patientTimers.clear();
  }

  // cancelHomePageForceReload() {
  //   this.removeAllListeners("forceReloadHomePage");
  // }

  hasReloadListener() {
    return this.listenerCount("forceReloadHomePage") > 0;
  }

  forceReloadHomePage() {
    this.emit("forceReloadHomePage", true);
  }

  startScoreTour() {
    if (!this.scoreTourStarted) {
      this.scoreTourStarted = true;
      this.emit("scoreTourStarted");
    }
  }

  endScoreTour() {
    this.scoreTourStarted = false;
    this.removeAllListeners("scoreTourStarted");
  }

  isScoreTourAlreadyStarted() {
    return this.scoreTourStarted;
  }

  toJSON() {
    return {
      patients: this.getAllPatients(),
    };
  }

  static fromJSON(json) {
    return new PatientStore(json.patients || []);
  }
}

export default PatientStore;
